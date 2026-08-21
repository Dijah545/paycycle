
import {loadState,saveState} from './database.js';
import {currentCycle,inCycle,adjustedPayday} from './paycycle.js';

const currency = new Intl.NumberFormat('en-JM',{style:'currency',currency:'JMD',maximumFractionDigits:2});
const uid = () => crypto.randomUUID();
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const today = () => new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=d=>d.toLocaleDateString('en-JM',{day:'numeric',month:'short',year:'numeric'});
const iso=d=>{const x=new Date(d); return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,10)};

let state = await loadState() || {};
state.settings ||= {payday:25,holidays:[]};
state.accounts ||= [];
state.transactions ||= [];
state.budgets ||= [];
state.commitments ||= [];
state.funds ||= [];

let periodOffset = 0;

function cycleFromOffset(offset){
  const base=currentCycle(new Date(),state.settings.payday,state.settings.holidays);
  if(offset===0) return base;
  const anchor=new Date(base.start.getFullYear(),base.start.getMonth()+offset,15,12);
  const start=adjustedPayday(anchor.getFullYear(),anchor.getMonth(),state.settings.payday,state.settings.holidays);
  const next=adjustedPayday(start.getFullYear(),start.getMonth()+1,state.settings.payday,state.settings.holidays);
  const end=new Date(next); end.setDate(end.getDate()-1);
  return {start,end,next};
}

function accountBalance(id, asOf=null){
  const a=state.accounts.find(x=>x.id===id); if(!a) return 0;
  let bal=Number(a.openingBalance);
  for(const t of state.transactions){
    if(asOf && new Date(t.date+'T12:00:00')>asOf) continue;
    if(t.type==='income'&&t.accountId===id) bal+=Number(t.amount);
    if(t.type==='expense'&&t.accountId===id) bal-=Number(t.amount);
    if(t.type==='transfer'){
      if(t.fromAccountId===id) bal-=Number(t.amount);
      if(t.toAccountId===id) bal+=Number(t.amount);
    }
  }
  return bal;
}

function accountName(id){return state.accounts.find(a=>a.id===id)?.name||'Unknown account';}

function selectedCycle(){return cycleFromOffset(periodOffset);}

function ensurePeriodOptions(){
  const sel=$('#periodSelect');
  const opts=[];
  for(let i=-12;i<=6;i++){
    const c=cycleFromOffset(i);
    opts.push(`<option value="${i}" ${i===periodOffset?'selected':''}>${fmtDate(c.start)} – ${fmtDate(c.end)}</option>`);
  }
  sel.innerHTML=opts.join('');
}

function fillAccountSelects(){
  const options=state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  $$('select[name=accountId],select[name=fromAccountId],select[name=toAccountId]').forEach(s=>s.innerHTML=options);
}

function fillCategories(){
  const options=['<option value="">Uncategorised</option>',...state.budgets.map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`)].join('');
  $('#expenseCategory').innerHTML=options;
}

function periodCommitments(cycle){
  return state.commitments.map(c=>{
    let due=new Date(cycle.start.getFullYear(),cycle.start.getMonth(),Number(c.dueDay),12);
    if(due<cycle.start) due=new Date(cycle.end.getFullYear(),cycle.end.getMonth(),Number(c.dueDay),12);
    const inPeriod=due>=cycle.start&&due<=cycle.end;
    return {...c,due,inPeriod};
  }).filter(x=>x.inPeriod);
}

function render(){
  ensurePeriodOptions();
  fillAccountSelects();
  fillCategories();
  const cycle=selectedCycle();
  const cyc=state.transactions.filter(t=>inCycle(t.date,cycle));
  const balances=state.accounts.map(a=>({...a,balance:accountBalance(a.id)}));
  const total=balances.reduce((s,a)=>s+a.balance,0);
  const income=cyc.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const spent=cyc.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const commitments=periodCommitments(cycle);
  const commitmentsTotal=commitments.reduce((s,c)=>s+Number(c.amount),0);
  const reserved=state.funds.reduce((s,f)=>s+Number(f.amount),0);
  const free=total-commitmentsTotal-reserved;

  $('#totalPosition').textContent=currency.format(total);
  $('#incomeCycle').textContent=currency.format(income);
  $('#spentCycle').textContent=currency.format(spent);
  $('#commitmentsTotal').textContent=currency.format(commitmentsTotal);
  $('#reservedSavings').textContent=currency.format(reserved);
  $('#freeToSpend').textContent=currency.format(free);

  $('#accountsList').innerHTML=balances.length?balances.map(a=>`
    <div class="account"><div><strong>${esc(a.name)}</strong><div class="tx-meta">Opening ${currency.format(a.openingBalance)}</div></div><strong>${currency.format(a.balance)}</strong></div>`).join('')
    :'<p class="muted">Add your first account.</p>';

  $('#budgetList').innerHTML=state.budgets.length?state.budgets.map(b=>{
    const used=cyc.filter(t=>t.type==='expense'&&t.category===b.name).reduce((s,t)=>s+Number(t.amount),0);
    const remaining=Number(b.amount)-used;
    const pct=Math.min(100,Math.max(0,(used/Math.max(Number(b.amount),1))*100));
    return `<div class="budget-row"><div style="flex:1"><div class="row"><strong>${esc(b.name)}</strong><span>${currency.format(remaining)} left</span></div>
      <div class="tx-meta">${currency.format(used)} of ${currency.format(b.amount)} used</div><div class="progress"><i style="width:${pct}%"></i></div></div>
      <button class="mini danger" data-delete-budget="${b.id}">Delete</button></div>`;
  }).join(''):'<p class="muted">Add categories such as Groceries, Transportation, Utilities, or Entertainment.</p>';

  $('#commitmentsList').innerHTML=commitments.length?commitments.map(c=>`
    <div class="bill-row"><div><strong>${esc(c.name)}</strong><div class="tx-meta">Due ${fmtDate(c.due)}</div></div>
    <div class="item-actions"><strong>${currency.format(c.amount)}</strong><button class="mini danger" data-delete-commitment="${c.id}">Delete</button></div></div>`).join('')
    :'<p class="muted">No recurring commitments fall in this selected period.</p>';

  $('#fundsList').innerHTML=state.funds.length?state.funds.map(f=>`
    <div class="fund-row"><div><strong>${esc(f.name)}</strong><div class="tx-meta">Reserved from available money</div></div>
    <div class="item-actions"><strong>${currency.format(f.amount)}</strong><button class="mini danger" data-delete-fund="${f.id}">Delete</button></div></div>`).join('')
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
  $('#holidayInput').value=state.settings.holidays.join('\n');
  attachDynamicHandlers();
}

function attachDynamicHandlers(){
  $$('[data-delete]').forEach(b=>b.onclick=async()=>{ if(confirm('Delete this transaction?')){state.transactions=state.transactions.filter(t=>t.id!==b.dataset.delete);await commit();}});
  $$('[data-delete-budget]').forEach(b=>b.onclick=async()=>{state.budgets=state.budgets.filter(x=>x.id!==b.dataset.deleteBudget);await commit();});
  $$('[data-delete-commitment]').forEach(b=>b.onclick=async()=>{state.commitments=state.commitments.filter(x=>x.id!==b.dataset.deleteCommitment);await commit();});
  $$('[data-delete-fund]').forEach(b=>b.onclick=async()=>{state.funds=state.funds.filter(x=>x.id!==b.dataset.deleteFund);await commit();});
  $$('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}

async function commit(){await saveState(state);render();}

$$('[data-open]').forEach(btn=>btn.addEventListener('click',()=>{
  if(!state.accounts.length && !['accountModal','budgetModal','commitmentModal','fundModal'].includes(btn.dataset.open)){alert('Add at least one account first.');return}
  const modal=$('#'+btn.dataset.open);
  modal.querySelectorAll('input[type=date]').forEach(i=>i.value=today());
  modal.showModal();
}));

$('#periodSelect').addEventListener('change',e=>{periodOffset=Number(e.target.value);render();});
$('#prevPeriodBtn').addEventListener('click',()=>{periodOffset=Math.max(-12,periodOffset-1);render();});
$('#nextPeriodBtn').addEventListener('click',()=>{periodOffset=Math.min(6,periodOffset+1);render();});

$('#accountForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.accounts.push({id:uid(),name:f.get('name').trim(),openingBalance:Number(f.get('balance'))});e.currentTarget.reset();$('#accountModal').close();await commit();});
$('#incomeForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.transactions.push({id:uid(),type:'income',description:f.get('description').trim(),amount:Number(f.get('amount')),accountId:f.get('accountId'),date:f.get('date')});e.currentTarget.reset();$('#incomeModal').close();await commit();});
$('#expenseForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.transactions.push({id:uid(),type:'expense',description:f.get('description').trim(),category:f.get('category'),amount:Number(f.get('amount')),accountId:f.get('accountId'),date:f.get('date')});e.currentTarget.reset();$('#expenseModal').close();await commit();});
$('#transferForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);if(f.get('fromAccountId')===f.get('toAccountId')){alert('Choose two different accounts.');return}state.transactions.push({id:uid(),type:'transfer',amount:Number(f.get('amount')),fromAccountId:f.get('fromAccountId'),toAccountId:f.get('toAccountId'),date:f.get('date')});e.currentTarget.reset();$('#transferModal').close();await commit();});
$('#budgetForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.budgets.push({id:uid(),name:f.get('name').trim(),amount:Number(f.get('amount'))});e.currentTarget.reset();$('#budgetModal').close();await commit();});
$('#commitmentForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.commitments.push({id:uid(),name:f.get('name').trim(),amount:Number(f.get('amount')),dueDay:Number(f.get('dueDay'))});e.currentTarget.reset();$('#commitmentModal').close();await commit();});
$('#fundForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);state.funds.push({id:uid(),name:f.get('name').trim(),amount:Number(f.get('amount'))});e.currentTarget.reset();$('#fundModal').close();await commit();});

function openEdit(id){
  const t=state.transactions.find(x=>x.id===id); if(!t)return;
  const ef=$('#editFields'); $('#editForm [name=id]').value=t.id;
  if(t.type==='income'){
    ef.innerHTML=`<label>Description<input name="description" required value="${esc(t.description)}"></label><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label>`;
  }else if(t.type==='expense'){
    ef.innerHTML=`<label>Description<input name="description" required value="${esc(t.description)}"></label><label>Category<input name="category" value="${esc(t.category||'')}"></label><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label>`;
  }else{
    ef.innerHTML=`<p class="muted small">Transfer accounts are unchanged in this editor.</p><label>Amount<input name="amount" type="number" step="0.01" value="${t.amount}" required></label><label>Date<input name="date" type="date" value="${t.date}" required></label>`;
  }
  $('#editModal').showModal();
}
$('#editForm').addEventListener('submit',async e=>{
  if(e.submitter?.value==='cancel')return;e.preventDefault();const f=new FormData(e.currentTarget);const t=state.transactions.find(x=>x.id===f.get('id'));if(!t)return;
  t.amount=Number(f.get('amount'));t.date=f.get('date');
  if(t.type==='income')t.description=f.get('description').trim();
  if(t.type==='expense'){t.description=f.get('description').trim();t.category=f.get('category').trim();}
  $('#editModal').close();await commit();
});

$('#saveSettingsBtn').addEventListener('click',async()=>{const payday=Math.max(1,Math.min(28,Number($('#paydayInput').value)||25));const holidays=$('#holidayInput').value.split(/\s+/).map(x=>x.trim()).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x));state.settings={payday,holidays:[...new Set(holidays)].sort()};periodOffset=0;await commit();});
$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`paycycle-budget-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);});
$('#importInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const x=JSON.parse(await file.text());state=x;state.budgets||=[];state.commitments||=[];state.funds||=[];await commit();alert('Backup restored.')}catch{alert('Could not restore this backup file.')}e.target.value='';});

let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').classList.add('hidden')});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js');
render();
