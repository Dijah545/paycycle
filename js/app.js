
import {loadState,saveState} from './database.js';
import {currentCycle,inCycle} from './paycycle.js';

const currency = new Intl.NumberFormat('en-JM',{style:'currency',currency:'JMD',maximumFractionDigits:2});
const today = () => new Date().toISOString().slice(0,10);
const uid = () => crypto.randomUUID();

let state = await loadState() || {
  settings:{payday:25,holidays:[]},
  accounts:[],
  transactions:[]
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function accountBalance(id){
  const a=state.accounts.find(x=>x.id===id);
  if(!a) return 0;
  let bal=Number(a.openingBalance);
  for(const t of state.transactions){
    if(t.type==='income' && t.accountId===id) bal += Number(t.amount);
    if(t.type==='expense' && t.accountId===id) bal -= Number(t.amount);
    if(t.type==='transfer'){
      if(t.fromAccountId===id) bal -= Number(t.amount);
      if(t.toAccountId===id) bal += Number(t.amount);
    }
  }
  return bal;
}

function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function fmtDate(d){return d.toLocaleDateString('en-JM',{day:'numeric',month:'short',year:'numeric'});}

function fillAccountSelects(){
  const options=state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  $$('select').forEach(s=>s.innerHTML=options);
}

function render(){
  const cycle=currentCycle(new Date(),state.settings.payday,state.settings.holidays);
  $('#cycleLabel').textContent=`Current cycle: ${fmtDate(cycle.start)} – ${fmtDate(cycle.end)}`;

  const balances=state.accounts.map(a=>({ ...a,balance:accountBalance(a.id)}));
  const total=balances.reduce((s,a)=>s+a.balance,0);
  const cyc=state.transactions.filter(t=>inCycle(t.date,cycle));
  const income=cyc.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const spent=cyc.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  $('#totalPosition').textContent=currency.format(total);
  $('#incomeCycle').textContent=currency.format(income);
  $('#spentCycle').textContent=currency.format(spent);

  $('#accountsList').innerHTML=balances.length ? balances.map(a=>`
    <div class="account"><div><strong>${esc(a.name)}</strong><div class="tx-meta">Opening ${currency.format(a.openingBalance)}</div></div><strong>${currency.format(a.balance)}</strong></div>`).join('')
    : '<p class="muted">Add your first bank, savings, or cash account.</p>';

  const accountName=id=>state.accounts.find(a=>a.id===id)?.name || 'Unknown account';
  const sorted=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
  $('#transactionsList').innerHTML=sorted.length ? sorted.map(t=>{
    let title='',meta='',amt='';
    if(t.type==='income'){title=t.description;meta=`Income → ${accountName(t.accountId)}`;amt='+'+currency.format(t.amount);}
    if(t.type==='expense'){title=t.description;meta=`${t.category||'Expense'} • ${accountName(t.accountId)}`;amt='−'+currency.format(t.amount);}
    if(t.type==='transfer'){title='Transfer';meta=`${accountName(t.fromAccountId)} → ${accountName(t.toAccountId)}`;amt=currency.format(t.amount);}
    return `<div class="tx"><div><strong>${esc(title)}</strong><div class="tx-meta">${esc(meta)} • ${esc(t.date)}</div></div><strong>${amt}</strong></div>`;
  }).join('') : '<p class="muted">No activity yet.</p>';

  $('#paydayInput').value=state.settings.payday;
  $('#holidayInput').value=state.settings.holidays.join('\n');
  fillAccountSelects();
}

async function commit(){ await saveState(state); render(); }

$$('[data-open]').forEach(btn=>btn.addEventListener('click',()=>{
  if(!state.accounts.length && btn.dataset.open!=='accountModal'){
    alert('Add at least one account first.');
    return;
  }
  const modal=$('#'+btn.dataset.open);
  modal.querySelectorAll('input[type=date]').forEach(i=>i.value=today());
  modal.showModal();
}));

$('#accountForm').addEventListener('submit', async e=>{
  if(e.submitter?.value==='cancel') return;
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  state.accounts.push({id:uid(),name:fd.get('name').trim(),openingBalance:Number(fd.get('balance'))});
  e.currentTarget.reset(); $('#accountModal').close(); await commit();
});

$('#incomeForm').addEventListener('submit', async e=>{
  if(e.submitter?.value==='cancel') return;
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  state.transactions.push({id:uid(),type:'income',description:fd.get('description').trim(),amount:Number(fd.get('amount')),accountId:fd.get('accountId'),date:fd.get('date')});
  e.currentTarget.reset(); $('#incomeModal').close(); await commit();
});

$('#expenseForm').addEventListener('submit', async e=>{
  if(e.submitter?.value==='cancel') return;
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  state.transactions.push({id:uid(),type:'expense',description:fd.get('description').trim(),category:fd.get('category').trim(),amount:Number(fd.get('amount')),accountId:fd.get('accountId'),date:fd.get('date')});
  e.currentTarget.reset(); $('#expenseModal').close(); await commit();
});

$('#transferForm').addEventListener('submit', async e=>{
  if(e.submitter?.value==='cancel') return;
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  if(fd.get('fromAccountId')===fd.get('toAccountId')){alert('Choose two different accounts.');return;}
  state.transactions.push({id:uid(),type:'transfer',amount:Number(fd.get('amount')),fromAccountId:fd.get('fromAccountId'),toAccountId:fd.get('toAccountId'),date:fd.get('date')});
  e.currentTarget.reset(); $('#transferModal').close(); await commit();
});

$('#saveSettingsBtn').addEventListener('click',async()=>{
  const payday=Math.max(1,Math.min(28,Number($('#paydayInput').value)||25));
  const holidays=$('#holidayInput').value.split(/\s+/).map(x=>x.trim()).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x));
  state.settings={payday,holidays:[...new Set(holidays)].sort()};
  await commit();
});

$('#exportBtn').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`paycycle-budget-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importInput').addEventListener('change',async e=>{
  const file=e.target.files[0]; if(!file) return;
  try{
    const imported=JSON.parse(await file.text());
    if(!imported.accounts || !imported.transactions || !imported.settings) throw new Error('Invalid backup');
    state=imported; await commit(); alert('Backup restored.');
  }catch(err){alert('Could not restore this backup file.');}
  e.target.value='';
});

let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredPrompt=e; $('#installBtn').classList.remove('hidden');
});
$('#installBtn').addEventListener('click',async()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('#installBtn').classList.add('hidden');
});

if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
render();
