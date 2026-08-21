
function iso(d){ return d.toISOString().slice(0,10); }
function isWeekend(d){ return d.getDay()===0 || d.getDay()===6; }

export function adjustedPayday(year, monthIndex, payday, holidays=[]){
  let d=new Date(year,monthIndex,payday,12,0,0);
  const holidaySet=new Set(holidays);
  while(isWeekend(d) || holidaySet.has(iso(d))){
    d.setDate(d.getDate()-1);
  }
  return d;
}

export function currentCycle(now, payday, holidays=[]){
  let thisMonth=adjustedPayday(now.getFullYear(),now.getMonth(),payday,holidays);
  let start;
  if(now >= thisMonth){
    start=thisMonth;
  } else {
    start=adjustedPayday(now.getFullYear(),now.getMonth()-1,payday,holidays);
  }
  let next=adjustedPayday(start.getFullYear(),start.getMonth()+1,payday,holidays);
  let end=new Date(next);
  end.setDate(end.getDate()-1);
  return {start,end,next};
}

export function inCycle(dateString, cycle){
  const d=new Date(dateString+'T12:00:00');
  return d>=cycle.start && d<=cycle.end;
}
