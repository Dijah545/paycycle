
function localIso(d){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function isWeekend(d){return d.getDay()===0||d.getDay()===6}
function easterSunday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),
        g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,
        l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
        month=Math.floor((h+l-7*m+114)/31)-1,day=((h+l-7*m+114)%31)+1;
  return new Date(year,month,day,12);
}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function nthWeekday(year,monthIndex,weekday,n){const d=new Date(year,monthIndex,1,12),diff=(weekday-d.getDay()+7)%7;d.setDate(1+diff+(n-1)*7);return d}
function observedFixed(year,monthIndex,day){
  const d=new Date(year,monthIndex,day,12);
  if(d.getDay()===0)return[d,addDays(d,1)];
  if(d.getDay()===6)return[d,addDays(d,2)];
  return[d];
}
export function jamaicaHolidays(year){
  const e=easterSunday(year),dates=[],push=a=>a.forEach(d=>dates.push(localIso(d)));
  push(observedFixed(year,0,1));
  dates.push(localIso(addDays(e,-46)));
  dates.push(localIso(addDays(e,-2)));
  dates.push(localIso(addDays(e,1)));
  push(observedFixed(year,4,23));
  push(observedFixed(year,7,1));
  push(observedFixed(year,7,6));
  dates.push(localIso(nthWeekday(year,9,1,3)));
  push(observedFixed(year,11,25));
  push(observedFixed(year,11,26));
  return[...new Set(dates)].sort();
}
export function allHolidays(year,settings){
  const manual=settings.holidays||[],auto=settings.autoJamaicaHolidays!==false?jamaicaHolidays(year):[];
  return[...new Set([...manual,...auto])].sort();
}
export function adjustedPayday(year,monthIndex,payday,settings){
  let d=new Date(year,monthIndex,payday,12);
  const hs=new Set([...allHolidays(d.getFullYear()-1,settings),...allHolidays(d.getFullYear(),settings),...allHolidays(d.getFullYear()+1,settings)]);
  while(isWeekend(d)||hs.has(localIso(d)))d.setDate(d.getDate()-1);
  return d;
}
export function currentCycle(now,payday,settings){
  const thisMonth=adjustedPayday(now.getFullYear(),now.getMonth(),payday,settings);
  const start=now>=thisMonth?thisMonth:adjustedPayday(now.getFullYear(),now.getMonth()-1,payday,settings);
  const next=adjustedPayday(start.getFullYear(),start.getMonth()+1,payday,settings);
  const end=new Date(next);end.setDate(end.getDate()-1);
  return{start,end,next};
}
export function inCycle(dateString,cycle){const d=new Date(dateString+'T12:00:00');return d>=cycle.start&&d<=cycle.end}
