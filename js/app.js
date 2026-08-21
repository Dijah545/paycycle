
import {loadState,saveState} from './database.js';
import {currentCycle,inCycle,adjustedPayday,jamaicaHolidays} from './paycycle.js';

const currency=new Intl.NumberFormat('en-JM',{style:'currency',currency:'JMD',maximumFractionDigits:2});
const uid=()=>crypto.randomUUID();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=d=>d.toLocaleDateString('en-JM',{day:'numeric',month:'short',year:'numeric'});
const cycleKey=c=>`${c.start.getFullYear()}-${String(c.start.getMonth()+1).padStart(2,'0')}-${String(c.start.getDate()).padStart(2,'0')}`;

let state=await loadState()||{};
state.settings||={payday:25,holidays:[],autoJamaicaHolidays:true};
if(state.settings.autoJamaicaHolidays===undefined) state.settings.autoJamaicaHolidays=true;
state.accounts||=[];state.transactions||=[];state.budgets||=[];state.commitments||=[];state.funds||=[];state.billStatus||={};
let periodOffset=0;

function cycleFromOffset(offset){
  const base=currentCycle(new Date(),state.settings.payday,state.settings);
  if(offset===0)return base;
  const anchor=new Date(base.start.getFullYear(),base.start.getMonth()+offset,15,12);
  const start=adjustedPayday(anchor.getFullYear(),anchor.getMonth(),state.settings.payday,state.settings);
  const next=adjustedPayday(start.getFullYear(),start.getMonth()+1,state.settings.payday,state.settings);
  const end=new Date(next);end.setDate(end.getDate()-1);return{start,end,next};
}
const selectedCycle=()=>cycleFromOffset(periodOffset);

function accountBalance(id,asOf=null){
  const a=state.accounts.find(x=>x.id===id);if(!a)return 0;
  let bal=Number(a.openingBalance);
  for(const t of state.transactions){
    if(asOf&&new Date(t.date+'T12:00:00')>asOf)continue;
    if(t.type==='income'&&t.accountId===id)bal+=Number(t.amount);
    if(t.type==='expense'&&t.accountId===id)bal-=Number(t.amount);
    if(t.type==='transfer'){
      if(t.fromAccountId===id)bal-=Number(t.amount);
      if(t.toAccountId===id)bal+=Number(t.amount);
    }
  }return bal;
}
const accountName=id=>state.accounts.find(a=>a.id===id)?.name||'Unknown account';

function ensurePeriodOptions(){
  $('#periodSelect').innerHTML=Array.from({length:19},(_,k)=>k-12).map(i=>{
    const c=cycleFromOffset(i);
    return `<option value="${i}" ${i===periodOffset?'selected':''}>${fmtDate(c.start)} – ${fmtDate(c.end)}</option>`;
  }).join('');
}
function fillAccountSelects(){
  const o=state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  $$('select[name=accountId],select[name=fromAccountId],select[name=toAccountId]').forEach(s=>s.innerHTML=o);
}
function fillCategories(){
  $('#expenseCategory').innerHTML=['<option value="">Uncategorised</option>',...state.budgets.map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`)].join('');
}
function periodCommitments(cycle){
  return state.commitments.map(c=>{
    let due=new Date(cycle.start.getFullYear(),cycle.start.getMonth(),Number(c.dueDay),12);
    if(due<cycle.start)due=new Date(cycle.end.getFullYear(),cycle.end.getMonth(),Number(c.dueDay),12);
    return {...c,due,inPeriod:due>=cycle.start&&due<=cycle.end};
  }).filter(x=>x.inPeriod);
}
function isBillPaid(commitmentId,cycle){return !!state.billStatus[`${cycleKey(cycle)}|${commitmentId}`];}
function setBillPaid(commitmentId,cycle,paid){state.billStatus[`${cycleKey(cycle)}|${commitmentId}`]=paid;}

function render(){
  ensurePeriodOptions();fillAccountSelects();fillCategories();
  const cycle=selectedCycle(),cyc=state.transactions.filter(t=>inCycle(t.date,cycle));
  const balances=state.accounts.map(a=>({...a,balance:accountBalance(a.id)}));
  const total=balances.reduce((s,a)=>s+a.balance,0);
  const income=cyc.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const spent=cyc.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const commitments=periodCommitments(cycle);
  const unpaid=commitments.filter(c=>!isBillPaid(c.id,cycle));
  const commitmentsTotal=unpaid.reduce((s,c)=>s+Number(c.amount),0);
  const reserved=state.funds.reduce((s,f)=>s+Number(f.amount),0);
  const free=total-commitmentsTotal-reserved;

  $('#totalPosition').textContent=currency.format(total);
  $('#incomeCycle').textContent=currency.format(income);
  $('#spentCycle').textContent=currency.format(spent);
  $('#commitmentsTotal').textContent=currency.format(commitmentsTotal);
  $('#reservedSavings').textContent=currency.format(reserved);
  $('#freeToSpend').textContent=currency.format(free);

  $('#accountsList').innerHTML=balances.length?balances.map(a=>`
    <div class="account"><div><strong>${esc(a.name)}</strong><div class="tx-meta">Opening ${currency.format(a.openingBalance)}</div></div>
    <div class="item-actions"><strong>${currency.format(a.balance)}</strong><button class="mini secondary" data-edit-account="${a.id}">Edit</button></div></div>`).join('')
    :'<p class="muted">Add your first account.</p>';

  $('#budgetList').innerHTML=state.budgets.length?state.budgets.map(b=>{
    const used=cyc.filter(t=>t.type==='expense'&&t.category===b.name).reduce((s,t)=>s+Number(t.amount),0);
    const rem=Number(b.amount)-used,pct=Math.min(100,Math.max(0,(used/Math.max(Number(b.amount),1))*100));
    return `<div class="budget-row"><div style="flex:1"><div class="row"><strong>${esc(b.name)}</strong><span>${currency.format(rem)} left</span></div>
    <div class="tx-meta">${currency.format(used)} of ${currency.format(b.amount)} used</div><div class="progress"><i style="width:${pct}%"></i></div></div>
    <div class="item-actions"><button class="mini secondary" data-edit-budget="${b.id}">Edit</button><button class="mini danger" data-delete-budget="${b.id}">Delete</button></div></div>`;
  }).join(''):'<p class="muted">Add categories such as Groceries, Transportation, Utilities, or Entertainment.</p>';

  $('#commitmentsList').innerHTML=commitments.length?commitments.map(c=>{
    const paid=isBillPaid(c.id,cycle);
    return `<div class="bill-row"><div><strong>${esc(c.name)}</strong><div class="tx-meta">Due ${fmtDate(c.due)} • ${paid?'Paid':'Unpaid'}</div></div>
    <div class="item-actions"><strong>${currency.format(c.amount)}</strong>
    <button class="mini ${paid?'secondary':''}" data-toggle-paid="${c.id}">${paid?'Mark unpaid':'Mark paid'}</button>
    <button class="mini secondary" data-edit-commitment="${c.id}">Edit</button>
    <button class="mini danger" data-delete-commitment="${c.id}">Delete</button></div></div>`;
  }).join(''):'<p class="muted">No recurring commitments fall in this selected period.</p>';

  $('#fundsList').innerHTML=state.funds.length?state.funds.map(f=>`
    <div class="fund-row"><div><strong>${esc(f.name)}</strong><div class="tx-meta">Reserved from available money</div></div>
    <div class="item-actions"><strong>${currency.format(f.amount)}</strong><button class="mini secondary" data-edit-fund="${f.id}">Edit</button><button class="mini danger" data-delete-fund="${f.id}">Delete</button></div></div>`).join('')
    :'<p class="muted">Create funds for emergencies, travel, car maintenance, Christmas, and other goals.</p>';

  const sorted=[...cyc].sort((a,b)=>b.date.localeCompare(a.date));
  $('#transactionsList').innerHTML=sorted.length?sorted.map(t=>{
    let title='',meta='',amt='';
    if(t.type==='income'){title=t.description;meta=`Income → ${accountName(t.accountId)}`;amt='+'+currency.format(t.amount)}
    if(t.type==='expense'){title=t.description;meta=`${t.category||'Expense'} • ${accountName(t.accountId)}`;amt='−'+currency.format(t.amount)}
    if(t.type==='transfer'){title='Transfer';meta=`${accountName(t.fromAccountId)} → ${accountName(t.toAccountId)}`;amt=currency.format(t.amount)}
    return `<div class="tx"><div style="flex:1"><strong>${esc(title)}</strong><div class="tx-meta">${esc(meta)} • ${esc(t.date)}</div></div>
    <strong>${amt}</strong><div class="item-actions"><button class="mini secondary" data-edit="${t.id}">Edit</button><button class="mini danger" data-delete="${t.id}">Delete</button></div></div>`;
  }).join(''):'<p class="muted">No transactions in this period.</p>';

  $('#paydayInput').value=state.settings.payday;
  $('#holidayInput').value=(state.settings.holidays||[]).join('\n');
  $('#jamaicaHolidayToggle').checked=state.settings.autoJamaicaHolidays!==false;
  const y=cycle.start.getFullYear();
  $('#holidayPreview').innerHTML=state.settings.autoJamaicaHolidays!==false
    ? `<strong>Automatic Jamaica holidays for ${y}</strong><div class="small muted">${jamaicaHolidays(y).join(' • ')}</div>`
    : '';
  attachDynamicHandlers();
}
async function commit(){await saveState(state);render();}

function resetForm(form){form.reset();form.querySelectorAll('input[type=hidden]').forEach(i=>i.value='');}

$$('[data-open]').forEach(btn=>btn.addEventListener('click',()=>{
  if(!state.accounts.length&&!['accountModal','budgetModal','commitmentModal','fundModal'].includes(btn.dataset.open)){alert('Add at least one account first.');return}
  const modal=$('#'+btn.dataset.open),form=modal.querySelector('form');resetForm(form);
  modal.querySelectorAll('input[type=date]').forEach(i=>i.value=today());
  if(btn.dataset.open==='accountModal')$('#accountModalTitle').textContent='Add Account';
  if(btn.dataset.open==='budgetModal')$('#budgetModalTitle').textContent='Add Budget Category';
  if(btn.dataset.open==='commitmentModal')$('#commitmentModalTitle').textContent='Add Recurring Commitment';
  if(btn.dataset.open==='fundModal')$('#fundModalTitle').textContent='Add Savings Fund';
  modal.showModal();
}));

$('#periodSelect').onchange=e=>{periodOffset=Number(e.target.value);render()};
$('#prevPeriodBtn').onclick=()=>{periodOffset=Math.max(-12,periodOffset-1);render()};
$('#nextPeriodBtn').onclick=()=>{periodOffset=Math.min(6,periodOffset+1);render()};

$('#accountForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id');if(id){const a=state.accounts.find(x=>x.id===id);a.name=f.get('name').trim();a.openingBalance=Number(f.get('balance'))}else state.accounts.push({id:uid(),name:f.get('name').trim(),openingBalance:Number(f.get('balance'))});$('#accountModal').close();await commit()};
$('#budgetForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id');if(id){const b=state.budgets.find(x=>x.id===id),old=b.name;b.name=f.get('name').trim();b.amount=Number(f.get('amount'));state.transactions.filter(t=>t.type==='expense'&&t.category===old).forEach(t=>t.category=b.name)}else state.budgets.push({id:uid(),name:f.get('name').trim(),amount:Number(f.get('amount'))});$('#budgetModal').close();await commit()};
$('#commitmentForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id');if(id){const c=state.commitments.find(x=>x.id===id);c.name=f.get('name').trim();c.amount=Number(f.get('amount'));c.dueDay=Number(f.get('dueDay'))}else state.commitments.push({id:uid(),name:f.get('name').trim(),amount:Number(f.get('amount')),dueDay:Number(f.get('dueDay'))});$('#commitmentModal').close();await commit()};
$('#fundForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),id=f.get('id');if(id){const x=state.funds.find(z=>z.id===id);x.name=f.get('name').trim();x.amount=Number(f.get('amount'))}else state.funds.push({id:uid(),name:f.get('name').trim(),amount:Number(f.get('amount'))});$('#fundModal').close();await commit()};

$('#incomeForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.transactions.push({id:uid(),type:'income',description:f.get('description').trim(),amount:Number(f.get('amount')),accountId:f.get('accountId'),date:f.get('date')});$('#incomeModal').close();await commit()};
$('#expenseForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.transactions.push({id:uid(),type:'expense',description:f.get('description').trim(),category:f.get('category'),amount:Number(f.get('amount')),accountId:f.get('accountId'),date:f.get('date')});$('#expenseModal').close();await commit()};
$('#transferForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);if(f.get('fromAccountId')===f.get('toAccountId')){alert('Choose two different accounts.');return}state.transactions.push({id:uid(),type:'transfer',amount:Number(f.get('amount')),fromAccountId:f.get('fromAccountId'),toAccountId:f.get('toAccountId'),date:f.get('date')});$('#transferModal').close();await commit()};

function attachDynamicHandlers(){
  $$('[data-edit-account]').forEach(b=>b.onclick=()=>{const a=state.accounts.find(x=>x.id===b.dataset.editAccount),f=$('#accountForm');f.elements.id.value=a.id;f.elements.name.value=a.name;f.elements.balance.value=a.openingBalance;$('#accountModalTitle').textContent='Edit Account';$('#accountModal').showModal()});
  $$('[data-edit-budget]').forEach(b=>b.onclick=()=>{const x=state.budgets.find(v=>v.id===b.dataset.editBudget),f=$('#budgetForm');f.elements.id.value=x.id;f.elements.name.value=x.name;f.elements.amount.value=x.amount;$('#budgetModalTitle').textContent='Edit Budget Category';$('#budgetModal').showModal()});
  $$('[data-edit-commitment]').forEach(b=>b.onclick=()=>{const x=state.commitments.find(v=>v.id===b.dataset.editCommitment),f=$('#commitmentForm');f.elements.id.value=x.id;f.elements.name.value=x.name;f.elements.amount.value=x.amount;f.elements.dueDay.value=x.dueDay;$('#commitmentModalTitle').textContent='Edit Recurring Commitment';$('#commitmentModal').showModal()});
  $$('[data-edit-fund]').forEach(b=>b.onclick=()=>{const x=state.funds.find(v=>v.id===b.dataset.editFund),f=$('#fundForm');f.elements.id.value=x.id;f.elements.name.value=x.name;f.elements.amount.value=x.amount;$('#fundModalTitle').textContent='Edit Savings Fund';$('#fundModal').showModal()});
  $$('[data-toggle-paid]').forEach(b=>b.onclick=async()=>{const c=selectedCycle(),id=b.dataset.togglePaid;setBillPaid(id,c,!isBillPaid(id,c));await commit()});
  $$('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this transaction?')){state.transactions=state.transactions.filter(t=>t.id!==b.dataset.delete);await commit()}});
  $$('[data-delete-budget]').forEach(b=>b.onclick=async()=>{state.budgets=state.budgets.filter(x=>x.id!==b.dataset.deleteBudget);await commit()});
  $$('[data-delete-commitment]').forEach(b=>b.onclick=async()=>{state.commitments=state.commitments.filter(x=>x.id!==b.dataset.deleteCommitment);await commit()});
  $$('[data-delete-fund]').forEach(b=>b.onclick=async()=>{state.funds=state.funds.filter(x=>x.id!==b.dataset.deleteFund);await commit()});
  $$('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}
function openEdit(id){
  const t=state.transactions.find(x=>x.id===id);if(!t)return;$('#editForm [name=id]').value=t.id;
  if(t.type==='income')$('#editFields').innerHTML=`<label>Description<input name="description" required value="${esc(t.description)}"></label><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label>`;
  else if(t.type==='expense')$('#editFields').innerHTML=`<label>Description<input name="description" required value="${esc(t.description)}"></label><label>Category<input name="category" value="${esc(t.category||'')}"></label><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label>`;
  else $('#editFields').innerHTML=`<p class="muted small">Transfer accounts remain unchanged here.</p><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label>`;
  $('#editModal').showModal();
}
$('#editForm').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget),t=state.transactions.find(x=>x.id===f.get('id'));if(!t)return;t.amount=Number(f.get('amount'));t.date=f.get('date');if(t.type==='income')t.description=f.get('description').trim();if(t.type==='expense'){t.description=f.get('description').trim();t.category=f.get('category').trim()}$('#editModal').close();await commit()};

$('#saveSettingsBtn').onclick=async()=>{state.settings.payday=Math.max(1,Math.min(28,Number($('#paydayInput').value)||25));state.settings.autoJamaicaHolidays=$('#jamaicaHolidayToggle').checked;state.settings.holidays=[...new Set($('#holidayInput').value.split(/\s+/).map(x=>x.trim()).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort();periodOffset=0;await commit()};
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`paycycle-budget-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href)};
$('#importInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{state=JSON.parse(await file.text());state.accounts||=[];state.transactions||=[];state.budgets||=[];state.commitments||=[];state.funds||=[];state.billStatus||={};state.settings||={payday:25,holidays:[],autoJamaicaHolidays:true};await commit();alert('Backup restored.')}catch{alert('Could not restore this backup file.')}e.target.value=''};

let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js');
render();
