
const DB_NAME = 'paycycle-budget-db';
const STORE = 'state';

export function loadState(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{
      const db=req.result;
      const tx=db.transaction(STORE,'readonly');
      const get=tx.objectStore(STORE).get('app');
      get.onsuccess=()=>resolve(get.result || null);
      get.onerror=()=>reject(get.error);
    };
  });
}

export function saveState(state){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{
      const db=req.result;
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put(state,'app');
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
    };
  });
}
