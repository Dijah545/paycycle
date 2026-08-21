
import {loadState,saveState} from './database.js';
import {currentCycle,inCycle,adjustedPayday,jamaicaHolidays} from './paycycle.js';

const currency=new Intl.NumberFormat('en-JM',{style:'currency',currency:'JMD',maximumFractionDigits:2});
const uid=()=>crypto.randomUUID(),$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=d=>d.toLocaleDateString('en-JM',{day:'numeric',month:'short',year:'numeric'});
const cycleKey=c=>`${c.start.getFullYear()}-${String(c.start.getMonth()+1).padStart(2,'0')}-${String(c.start.getDate()).padStart(2,'0')}`;

let state=await loadState()||{};
state.settings||={payday:25,holidays:[],autoJamaicaHolidays:true};
if(state.settings.autoJamaicaHolidays===undefined)state.settings.autoJamaicaHolidays=true;
for(const [k,v] of Object.entries({accounts:[],transactions:[],budgets:[],commitments:[],funds:[],plannedIncome:[],debts:[]}))state[k]||=v;
state.billStatus||={};
let periodOffset=0;

function selectedCycle(){return cycleFromOffset(periodOffset)}
function cycleFromOffset(offset){
  const base=currentCycle(new Date(),state.settings.payday,state.settings);
  if(offset===0)return base;
  const anchor=new Date(base.start.getFullYear(),base.start.getMonth()+offset,15,12);
  const start=adjustedPayday(anchor.getFullYear(),anchor.getMonth(),state.settings.payday,state.settings);
  const next=adjustedPayday(start.getFullYear(),start.getMonth()+1,state.settings.payday,state.settings);
  const end=new Date(next);end.setDate(end.getDate()-1);return{start,end,next};
}
function accountBalance(id,asOf=null){
  const a=state.accounts.find(x=>x.id===id);if(!a)return 0;let bal=Number(a.openingBalance);
  for(const t of state.transactions){
    if(asOf&&new Date(t.date+'T12:00:00')>asOf)continue;
    if(t.type==='income'&&t.accountId===id)bal+=Number(t.amount);
    if(t.type==='expense'&&t.accountId===id)bal-=Number(t.amount);
    if(t.type==='transfer'){if(t.fromAccountId===id)bal-=Number(t.amount);if(t.toAccountId===id)bal+=Number(t.amount)}
  }return bal;
}
const accountName=id=>state.accounts.find(a=>a.id===id)?.name||'Unknown account';
const budgetName=n=>state.budgets.some(b=>b.name===n)?n:(n||'Uncategorised');
const debtTotal=()=>state.debts.reduce((s,d)=>s+Number(d.balance||0),0);

function ensurePeriodOptions(){
  $('#periodSelect').innerHTML=Array.from({length:31},(_,k)=>k-18).map(i=>{
    const c=cycleFromOffset(i);return`<option value="${i}" ${i===periodOffset?'selected':''}>${fmtDate(c.start)} – ${fmtDate(c.end)}</option>`
  }).join('');
}
function accountOptions(includeBlank=false){
  return `${includeBlank?'<option value="">Select account</option>':''}${state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}`;
}
function fillSelects(){
  const ao=accountOptions();
  $$('select[name=accountId],select[name=fromAccountId],select[name=toAccountId]').forEach(s=>s.innerHTML=ao);
  $('#txAccountFilter').innerHTML='<option value="all">All accounts</option>'+state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  const cats='<option value="">Uncategorised</option>'+state.budgets.map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
  $('#expenseCategory').innerHTML=cats;$('#commitmentCategory').innerHTML=cats;
}
function periodCommitments(cycle){
  return state.commitments.map(c=>{
    let due=new Date(cycle.start.getFullYear(),cycle.start.getMonth(),Math.min(Number(c.dueDay),31),12);
    if(due<cycle.start)due=new Date(cycle.end.getFullYear(),cycle.end.getMonth(),Math.min(Number(c.dueDay),31),12);
    // normalize invalid dates (e.g. Feb 31) to last day of target month
    if(due.getMonth()!==cycle.start.getMonth()&&due<cycle.start){due=new Date(cycle.end.getFullYear(),cycle.end.getMonth()+1,0,12)}
    return{...c,due,inPeriod:due>=cycle.start&&due<=cycle.end}
  }).filter(x=>x.inPeriod);
}
function billStatus(commitmentId,cycle){return state.billStatus[`${cycleKey(cycle)}|${commitmentId}`]||null}
function isBillPaid(id,c){return billStatus(id,c)?.paid===true}
function markBill(id,c,data){state.billStatus[`${cycleKey(c)}|${id}`]={paid:true,...data}}
function unmarkBill(id,c){
  const key=`${cycleKey(c)}|${id}`,st=state.billStatus[key];
  if(st?.transactionId)state.transactions=state.transactions.filter(t=>t.id!==st.transactionId);
  delete state.billStatus[key];
}
function currentMetrics(){
  const cycle=selectedCycle(),cyc=state.transactions.filter(t=>inCycle(t.date,cycle));
  const assets=state.accounts.reduce((s,a)=>s+accountBalance(a.id),0);
  const liquid=state.accounts.filter(a=>a.liquid!==false).reduce((s,a)=>s+accountBalance(a.id),0);
  const income=cyc.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const spent=cyc.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const commitments=periodCommitments(cycle),unpaid=commitments.filter(c=>!isBillPaid(c.id,cycle));
  const unpaidTotal=unpaid.reduce((s,c)=>s+Number(c.amount),0);
  const reserved=state.funds.reduce((s,f)=>s+Number(f.amount),0);
  const debt=debtTotal(),net=assets-debt,free=liquid-unpaidTotal-reserved;
  return{cycle,cyc,assets,liquid,income,spent,commitments,unpaid,unpaidTotal,reserved,debt,net,free};
}
function render(){
  ensurePeriodOptions();fillSelects();const m=currentMetrics();
  $('#totalPosition').textContent=currency.format(m.net);$('#incomeCycle').textContent=currency.format(m.income);$('#spentCycle').textContent=currency.format(m.spent);
  $('#commitmentsTotal').textContent=currency.format(m.unpaidTotal);$('#reservedSavings').textContent=currency.format(m.reserved);$('#freeToSpend').textContent=currency.format(m.free);

  $('#accountsList').innerHTML=state.accounts.length?state.accounts.map(a=>{
    const bal=accountBalance(a.id);
    return`<div class="account"><div><strong>${esc(a.name)}</strong><div class="tx-meta">${esc(a.type||'bank')} • ${a.liquid!==false?'Available':'Excluded from Free to Spend'}</div></div>
    <div class="item-actions"><strong>${currency.format(bal)}</strong><button class="mini secondary" data-edit-account="${a.id}">Edit</button></div></div>`
  }).join(''):'<p class="muted">Add your bank, savings, cash, or wallet accounts.</p>';

  $('#budgetList').innerHTML=state.budgets.length?state.budgets.map(b=>{
    const used=m.cyc.filter(t=>t.type==='expense'&&t.category===b.name).reduce((s,t)=>s+Number(t.amount),0);
    const rem=Number(b.amount)-used,pct=Math.min(100,Math.max(0,(used/Math.max(Number(b.amount),1))*100));
    return`<div class="budget-row"><div style="flex:1"><div class="row"><strong>${esc(b.name)}</strong><span class="${rem<0?'negative':''}">${currency.format(rem)} left</span></div>
    <div class="tx-meta">${currency.format(used)} of ${currency.format(b.amount)} used</div><div class="progress"><i style="width:${pct}%"></i></div></div>
    <div class="item-actions"><button class="mini secondary" data-edit-budget="${b.id}">Edit</button><button class="mini danger" data-delete-budget="${b.id}">Delete</button></div></div>`
  }).join(''):'<p class="muted">Create spending limits for each pay period.</p>';

  const billHtml=m.commitments.length?m.commitments.map(c=>{
    const st=billStatus(c.id,m.cycle),paid=st?.paid===true;
    return`<div class="bill-row"><div><strong>${esc(c.name)}</strong><div class="tx-meta">Due ${fmtDate(c.due)} • ${esc(c.category||'Uncategorised')} • <span class="pill">${paid?'Paid':'Unpaid'}</span></div></div>
    <div class="item-actions"><strong>${currency.format(c.amount)}</strong>
    ${paid?`<button class="mini secondary" data-unpay-bill="${c.id}">Undo Paid</button>`:`<button class="mini success" data-pay-bill="${c.id}">Pay Bill</button>`}
    <button class="mini secondary" data-edit-commitment="${c.id}">Edit</button><button class="mini danger" data-delete-commitment="${c.id}">Delete</button></div></div>`
  }).join(''):'<p class="muted">No recurring commitments fall in this selected period.</p>';
  $('#commitmentsList').innerHTML=billHtml;$('#planningCommitmentsList').innerHTML=billHtml;

  const fundHtml=state.funds.length?state.funds.map(f=>{
    const target=Number(f.target||0),amt=Number(f.amount||0),pct=target?Math.min(100,(amt/target)*100):0;
    return`<div class="fund-row"><div style="flex:1"><strong>${esc(f.name)}</strong><div class="tx-meta">${target?`${currency.format(amt)} reserved of ${currency.format(target)} target`:`${currency.format(amt)} reserved`}</div>
    ${target?`<div class="progress"><i style="width:${pct}%"></i></div>`:''}</div><div class="item-actions"><button class="mini secondary" data-edit-fund="${f.id}">Edit</button><button class="mini danger" data-delete-fund="${f.id}">Delete</button></div></div>`
  }).join(''):'<p class="muted">No savings funds yet.</p>';
  $('#fundsList').innerHTML=fundHtml;$('#planningFundsList').innerHTML=fundHtml;

  const plannedHtml=state.plannedIncome.length?state.plannedIncome.map(p=>{
    const expected=new Date(m.cycle.start);expected.setDate(expected.getDate()+Number(p.dayOffset||0));
    return`<div class="planned-row"><div><strong>${esc(p.description)}</strong><div class="tx-meta">Expected ${fmtDate(expected)}</div></div>
    <div class="item-actions"><strong>${currency.format(p.amount)}</strong><button class="mini success" data-receive-income="${p.id}">Record Received</button><button class="mini secondary" data-edit-planned="${p.id}">Edit</button><button class="mini danger" data-delete-planned="${p.id}">Delete</button></div></div>`
  }).join(''):'<p class="muted">Add salary or other expected income.</p>';
  $('#plannedIncomeList').innerHTML=plannedHtml;

  $('#debtsList').innerHTML=state.debts.length?state.debts.map(d=>`<div class="debt-row"><div><strong>${esc(d.name)}</strong><div class="tx-meta">${d.minimumPayment?`Minimum ${currency.format(d.minimumPayment)}${d.dueDay?` • due day ${d.dueDay}`:''}`:'Debt balance'}</div></div>
  <div class="item-actions"><strong class="negative">${currency.format(d.balance)}</strong><button class="mini secondary" data-edit-debt="${d.id}">Edit</button><button class="mini danger" data-delete-debt="${d.id}">Delete</button></div></div>`).join('')
  :'<p class="muted">Track credit cards, loans, and other balances you owe.</p>';

  renderTransactions(m);renderReports(m);renderSettings(m);attachDynamicHandlers();
}
function renderTransactions(m){
  let rows=[...m.cyc];
  const tf=$('#txTypeFilter').value,af=$('#txAccountFilter').value,q=$('#txSearch').value.trim().toLowerCase();
  if(tf!=='all')rows=rows.filter(t=>t.type===tf);
  if(af!=='all')rows=rows.filter(t=>t.accountId===af||t.fromAccountId===af||t.toAccountId===af);
  if(q)rows=rows.filter(t=>JSON.stringify(t).toLowerCase().includes(q)||accountName(t.accountId).toLowerCase().includes(q));
  rows.sort((a,b)=>b.date.localeCompare(a.date));
  $('#transactionsList').innerHTML=rows.length?rows.map(t=>{
    let title='',meta='',amt='';
    if(t.type==='income'){title=t.description;meta=`Income → ${accountName(t.accountId)}`;amt='+'+currency.format(t.amount)}
    if(t.type==='expense'){title=t.description;meta=`${budgetName(t.category)} • ${accountName(t.accountId)}`;amt='−'+currency.format(t.amount)}
    if(t.type==='transfer'){title='Transfer';meta=`${accountName(t.fromAccountId)} → ${accountName(t.toAccountId)}`;amt=currency.format(t.amount)}
    return`<div class="tx"><div style="flex:1"><strong>${esc(title)}</strong><div class="tx-meta">${esc(meta)} • ${esc(t.date)}${t.notes?` • ${esc(t.notes)}`:''}</div></div>
    <strong>${amt}</strong><div class="item-actions"><button class="mini secondary" data-edit="${t.id}">Edit</button><button class="mini danger" data-delete="${t.id}">Delete</button></div></div>`
  }).join(''):'<p class="muted">No matching transactions in this period.</p>';
}
function renderReports(m){
  const planned=state.plannedIncome.reduce((s,p)=>s+Number(p.amount),0);
  $('#reportSummary').innerHTML=`
    <div class="metric"><span>Period</span><strong>${fmtDate(m.cycle.start)} – ${fmtDate(m.cycle.end)}</strong></div>
    <div class="metric"><span>Net Cash Flow</span><strong class="${m.income-m.spent>=0?'positive':'negative'}">${currency.format(m.income-m.spent)}</strong></div>
    <div class="metric"><span>Income Received</span><strong>${currency.format(m.income)}</strong></div>
    <div class="metric"><span>Planned Income</span><strong>${currency.format(planned)}</strong></div>
    <div class="metric"><span>Expenses</span><strong>${currency.format(m.spent)}</strong></div>
    <div class="metric"><span>Debt Balances</span><strong>${currency.format(m.debt)}</strong></div>`;
  const cats={};m.cyc.filter(t=>t.type==='expense').forEach(t=>cats[t.category||'Uncategorised']=(cats[t.category||'Uncategorised']||0)+Number(t.amount));
  $('#categoryReport').innerHTML=Object.keys(cats).length?Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="report-row"><span>${esc(k)}</span><strong>${currency.format(v)}</strong></div>`).join(''):'<p class="muted">No expenses to report.</p>';
  const accts={};m.cyc.filter(t=>t.type==='expense').forEach(t=>accts[accountName(t.accountId)]=(accts[accountName(t.accountId)]||0)+Number(t.amount));
  $('#accountReport').innerHTML=Object.keys(accts).length?Object.entries(accts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="report-row"><span>${esc(k)}</span><strong>${currency.format(v)}</strong></div>`).join(''):'<p class="muted">No expenses to report.</p>';
}
function renderSettings(m){
  $('#paydayInput').value=state.settings.payday;$('#holidayInput').value=(state.settings.holidays||[]).join('\n');$('#jamaicaHolidayToggle').checked=state.settings.autoJamaicaHolidays!==false;
  const y=m.cycle.start.getFullYear();$('#holidayPreview').innerHTML=state.settings.autoJamaicaHolidays!==false?`<strong>Automatic Jamaica holidays for ${y}</strong><div class="small muted">${jamaicaHolidays(y).join(' • ')}</div>`:'';
}
async function commit(){await saveState(state);render()}
function resetForm(f){f.reset();f.querySelectorAll('input[type=hidden]').forEach(i=>i.value='')}

$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.tab-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
$('#periodSelect').onchange=e=>{periodOffset=Number(e.target.value);render()};$('#prevPeriodBtn').onclick=()=>{periodOffset=Math.max(-18,periodOffset-1);render()};$('#nextPeriodBtn').onclick=()=>{periodOffset=Math.min(12,periodOffset+1);render()};
$('#txTypeFilter').onchange=render;$('#txAccountFilter').onchange=render;$('#txSearch').oninput=render;

$$('[data-open]').forEach(btn=>btn.addEventListener('click',()=>{
  if(!state.accounts.length&&!['accountModal','budgetModal','commitmentModal','fundModal','plannedIncomeModal','debtModal'].includes(btn.dataset.open)){alert('Add at least one account first.');return}
  const modal=$('#'+btn.dataset.open),form=modal.querySelector('form');resetForm(form);modal.querySelectorAll('input[type=date]').forEach(i=>i.value=today());
  const titles={accountModal:'Add Account',budgetModal:'Add Budget Category',commitmentModal:'Add Recurring Commitment',fundModal:'Add Savings Fund',plannedIncomeModal:'Add Planned Income',debtModal:'Add Debt'};
  if(titles[btn.dataset.open])$('#'+btn.dataset.open+'Title').textContent=titles[btn.dataset.open];
  modal.showModal();
}));

$('#accountForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id'),obj={name:f.get('name').trim(),type:f.get('type'),openingBalance:Number(f.get('balance')),liquid:f.get('liquid')==='on'};if(id)Object.assign(state.accounts.find(x=>x.id===id),obj);else state.accounts.push({id:uid(),...obj});$('#accountModal').close();await commit()};
$('#incomeForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.transactions.push({id:uid(),type:'income',description:f.get('description').trim(),amount:Number(f.get('amount')),accountId:f.get('accountId'),date:f.get('date'),notes:f.get('notes').trim()});$('#incomeModal').close();await commit()};
$('#expenseForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.transactions.push({id:uid(),type:'expense',description:f.get('description').trim(),category:f.get('category'),amount:Number(f.get('amount')),accountId:f.get('accountId'),date:f.get('date'),notes:f.get('notes').trim()});$('#expenseModal').close();await commit()};
$('#transferForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);if(f.get('fromAccountId')===f.get('toAccountId')){alert('Choose two different accounts.');return}state.transactions.push({id:uid(),type:'transfer',amount:Number(f.get('amount')),fromAccountId:f.get('fromAccountId'),toAccountId:f.get('toAccountId'),date:f.get('date'),notes:f.get('notes').trim()});$('#transferModal').close();await commit()};
$('#budgetForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id');if(id){const b=state.budgets.find(x=>x.id===id),old=b.name;b.name=f.get('name').trim();b.amount=Number(f.get('amount'));state.transactions.filter(t=>t.type==='expense'&&t.category===old).forEach(t=>t.category=b.name);state.commitments.filter(c=>c.category===old).forEach(c=>c.category=b.name)}else state.budgets.push({id:uid(),name:f.get('name').trim(),amount:Number(f.get('amount'))});$('#budgetModal').close();await commit()};
$('#commitmentForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id'),obj={name:f.get('name').trim(),amount:Number(f.get('amount')),dueDay:Number(f.get('dueDay')),category:f.get('category'),accountId:f.get('accountId')};if(id)Object.assign(state.commitments.find(x=>x.id===id),obj);else state.commitments.push({id:uid(),...obj});$('#commitmentModal').close();await commit()};
$('#fundForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id'),obj={name:f.get('name').trim(),amount:Number(f.get('amount')),target:Number(f.get('target')||0)};if(id)Object.assign(state.funds.find(x=>x.id===id),obj);else state.funds.push({id:uid(),...obj});$('#fundModal').close();await commit()};
$('#plannedIncomeForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id'),obj={description:f.get('description').trim(),amount:Number(f.get('amount')),dayOffset:Number(f.get('dayOffset')||0)};if(id)Object.assign(state.plannedIncome.find(x=>x.id===id),obj);else state.plannedIncome.push({id:uid(),...obj});$('#plannedIncomeModal').close();await commit()};
$('#debtForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id'),obj={name:f.get('name').trim(),balance:Number(f.get('balance')),minimumPayment:Number(f.get('minimumPayment')||0),dueDay:Number(f.get('dueDay')||0)};if(id)Object.assign(state.debts.find(x=>x.id===id),obj);else state.debts.push({id:uid(),...obj});$('#debtModal').close();await commit()};

$('#payBillForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('commitmentId'),c=state.commitments.find(x=>x.id===id),cycle=selectedCycle();if(!c)return;let txid=null;if(f.get('createExpense')==='on'){txid=uid();state.transactions.push({id:txid,type:'expense',description:c.name,category:c.category||'',amount:Number(f.get('amount')),accountId:f.get('accountId'),date:f.get('date'),notes:'Created from recurring bill'});}markBill(id,cycle,{amount:Number(f.get('amount')),date:f.get('date'),accountId:f.get('accountId'),transactionId:txid});$('#payBillModal').close();await commit()};

function attachDynamicHandlers(){
  $$('[data-edit-account]').forEach(b=>b.onclick=()=>{const a=state.accounts.find(x=>x.id===b.dataset.editAccount),f=$('#accountForm');f.elements.id.value=a.id;f.elements.name.value=a.name;f.elements.type.value=a.type||'bank';f.elements.balance.value=a.openingBalance;f.elements.liquid.checked=a.liquid!==false;$('#accountModalTitle').textContent='Edit Account';$('#accountModal').showModal()});
  $$('[data-edit-budget]').forEach(b=>b.onclick=()=>{const x=state.budgets.find(v=>v.id===b.dataset.editBudget),f=$('#budgetForm');f.elements.id.value=x.id;f.elements.name.value=x.name;f.elements.amount.value=x.amount;$('#budgetModalTitle').textContent='Edit Budget Category';$('#budgetModal').showModal()});
  $$('[data-edit-commitment]').forEach(b=>b.onclick=()=>{const x=state.commitments.find(v=>v.id===b.dataset.editCommitment),f=$('#commitmentForm');f.elements.id.value=x.id;f.elements.name.value=x.name;f.elements.amount.value=x.amount;f.elements.dueDay.value=x.dueDay;f.elements.category.value=x.category||'';f.elements.accountId.value=x.accountId||state.accounts[0]?.id||'';$('#commitmentModalTitle').textContent='Edit Recurring Commitment';$('#commitmentModal').showModal()});
  $$('[data-edit-fund]').forEach(b=>b.onclick=()=>{const x=state.funds.find(v=>v.id===b.dataset.editFund),f=$('#fundForm');f.elements.id.value=x.id;f.elements.name.value=x.name;f.elements.amount.value=x.amount;f.elements.target.value=x.target||'';$('#fundModalTitle').textContent='Edit Savings Fund';$('#fundModal').showModal()});
  $$('[data-edit-planned]').forEach(b=>b.onclick=()=>{const x=state.plannedIncome.find(v=>v.id===b.dataset.editPlanned),f=$('#plannedIncomeForm');f.elements.id.value=x.id;f.elements.description.value=x.description;f.elements.amount.value=x.amount;f.elements.dayOffset.value=x.dayOffset||0;$('#plannedIncomeModalTitle').textContent='Edit Planned Income';$('#plannedIncomeModal').showModal()});
  $$('[data-edit-debt]').forEach(b=>b.onclick=()=>{const x=state.debts.find(v=>v.id===b.dataset.editDebt),f=$('#debtForm');f.elements.id.value=x.id;f.elements.name.value=x.name;f.elements.balance.value=x.balance;f.elements.minimumPayment.value=x.minimumPayment||'';f.elements.dueDay.value=x.dueDay||'';$('#debtModalTitle').textContent='Edit Debt';$('#debtModal').showModal()});
  $$('[data-pay-bill]').forEach(b=>b.onclick=()=>{const c=state.commitments.find(x=>x.id===b.dataset.payBill),f=$('#payBillForm');resetForm(f);f.elements.commitmentId.value=c.id;f.elements.amount.value=c.amount;f.elements.accountId.innerHTML=accountOptions();f.elements.accountId.value=c.accountId||state.accounts[0]?.id||'';f.elements.date.value=today();f.elements.createExpense.checked=true;$('#payBillName').textContent=`${c.name} • expected ${currency.format(c.amount)}`;$('#payBillModal').showModal()});
  $$('[data-unpay-bill]').forEach(b=>b.onclick=async()=>{if(confirm('Mark this bill unpaid? If it created an expense automatically, that expense will also be removed.')){unmarkBill(b.dataset.unpayBill,selectedCycle());await commit()}});
  $$('[data-receive-income]').forEach(b=>b.onclick=()=>{const p=state.plannedIncome.find(x=>x.id===b.dataset.receiveIncome);const f=$('#incomeForm');resetForm(f);f.elements.description.value=p.description;f.elements.amount.value=p.amount;f.elements.date.value=today();$('#incomeModal').showModal()});
  $$('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this transaction?')){state.transactions=state.transactions.filter(t=>t.id!==b.dataset.delete);for(const k of Object.keys(state.billStatus)){if(state.billStatus[k]?.transactionId===b.dataset.delete)delete state.billStatus[k]}await commit()}});
  $$('[data-delete-budget]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this budget category? Existing expenses will remain.')){state.budgets=state.budgets.filter(x=>x.id!==b.dataset.deleteBudget);await commit()}});
  $$('[data-delete-commitment]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this recurring commitment?')){state.commitments=state.commitments.filter(x=>x.id!==b.dataset.deleteCommitment);await commit()}});
  $$('[data-delete-fund]').forEach(b=>b.onclick=async()=>{state.funds=state.funds.filter(x=>x.id!==b.dataset.deleteFund);await commit()});
  $$('[data-delete-planned]').forEach(b=>b.onclick=async()=>{state.plannedIncome=state.plannedIncome.filter(x=>x.id!==b.dataset.deletePlanned);await commit()});
  $$('[data-delete-debt]').forEach(b=>b.onclick=async()=>{state.debts=state.debts.filter(x=>x.id!==b.dataset.deleteDebt);await commit()});
  $$('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}
function openEdit(id){
  const t=state.transactions.find(x=>x.id===id);if(!t)return;$('#editForm [name=id]').value=t.id;
  if(t.type==='income')$('#editFields').innerHTML=`<label>Description<input name="description" required value="${esc(t.description)}"></label><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label><label>Notes<textarea name="notes">${esc(t.notes||'')}</textarea></label>`;
  else if(t.type==='expense')$('#editFields').innerHTML=`<label>Description<input name="description" required value="${esc(t.description)}"></label><label>Category<input name="category" value="${esc(t.category||'')}"></label><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label><label>Notes<textarea name="notes">${esc(t.notes||'')}</textarea></label>`;
  else $('#editFields').innerHTML=`<p class="muted small">Transfer accounts remain unchanged in this editor.</p><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label><label>Notes<textarea name="notes">${esc(t.notes||'')}</textarea></label>`;
  $('#editModal').showModal();
}
$('#editForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),t=state.transactions.find(x=>x.id===f.get('id'));if(!t)return;t.amount=Number(f.get('amount'));t.date=f.get('date');t.notes=f.get('notes')?.trim()||'';if(t.type==='income')t.description=f.get('description').trim();if(t.type==='expense'){t.description=f.get('description').trim();t.category=f.get('category').trim()}$('#editModal').close();await commit()};

$('#saveSettingsBtn').onclick=async()=>{state.settings.payday=Math.max(1,Math.min(28,Number($('#paydayInput').value)||25));state.settings.autoJamaicaHolidays=$('#jamaicaHolidayToggle').checked;state.settings.holidays=[...new Set($('#holidayInput').value.split(/\s+/).map(x=>x.trim()).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort();periodOffset=0;await commit()};
function download(name,text,type){const blob=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
$('#exportBtn').onclick=()=>download(`paycycle-budget-backup-${today()}.json`,JSON.stringify(state,null,2),'application/json');
$('#importInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const x=JSON.parse(await file.text());if(!x.settings||!Array.isArray(x.accounts)||!Array.isArray(x.transactions))throw new Error();state=x;for(const [k,v] of Object.entries({accounts:[],transactions:[],budgets:[],commitments:[],funds:[],plannedIncome:[],debts:[]}))state[k]||=v;state.billStatus||={};await commit();alert('Backup restored.')}catch{alert('Could not restore this backup file.')}e.target.value=''};
$('#resetBtn').onclick=async()=>{if(confirm('This will erase all PayCycle Budget data stored in this browser. Export a backup first if needed. Continue?')){state={settings:{payday:25,holidays:[],autoJamaicaHolidays:true},accounts:[],transactions:[],budgets:[],commitments:[],funds:[],plannedIncome:[],debts:[],billStatus:{}};periodOffset=0;await commit()}};
function csvCell(v){return`"${String(v??'').replaceAll('"','""')}"`}
$('#exportCsvBtn').onclick=()=>{const h=['Date','Type','Description','Category','Amount','Account','From Account','To Account','Notes'],rows=[h,...state.transactions.map(t=>[t.date,t.type,t.description||'',t.category||'',t.amount,t.accountId?accountName(t.accountId):'',t.fromAccountId?accountName(t.fromAccountId):'',t.toAccountId?accountName(t.toAccountId):'',t.notes||''])];download(`paycycle-transactions-${today()}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv')};
$('#exportSummaryCsvBtn').onclick=()=>{const m=currentMetrics(),rows=[['Metric','Value'],['Period',`${fmtDate(m.cycle.start)} - ${fmtDate(m.cycle.end)}`],['Income',m.income],['Expenses',m.spent],['Net Cash Flow',m.income-m.spent],['Unpaid Commitments',m.unpaidTotal],['Reserved Savings',m.reserved],['Debt Balances',m.debt],['Net Financial Position',m.net],['Free to Spend',m.free]];download(`paycycle-period-summary-${cycleKey(m.cycle)}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv')};

let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js');
render();
