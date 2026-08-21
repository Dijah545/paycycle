
function localIso(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function isWeekend(d){return d.getDay()===0||d.getDay()===6;}

function easterSunday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31)-1;
  const day=((h+l-7*m+114)%31)+1;
  return new Date(year,month,day,12);
}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function nthWeekday(year,monthIndex,weekday,n){
  const d=new Date(year,monthIndex,1,12);
  const diff=(weekday-d.getDay()+7)%7;
  d.setDate(1+diff+(n-1)*7);
  return d;
}
function observedFixed(year,monthIndex,day){
  const d=new Date(year,monthIndex,day,12);
  // For budgeting purposes, weekend holidays are represented with the nearest following weekday.
  // Users can override/add official observed dates manually if payroll treatment differs.
  if(d.getDay()===0) return [d,addDays(d,1)];
  if(d.getDay()===6) return [d,addDays(d,2)];
  return [d];
}

export function jamaicaHolidays(year){
  const easter=easterSunday(year);
  const dates=[];
  const pushAll=arr=>arr.forEach(d=>dates.push(localIso(d)));

  pushAll(observedFixed(year,0,1));      // New Year's Day
  dates.push(localIso(addDays(easter,-46))); // Ash Wednesday
  dates.push(localIso(addDays(easter,-2)));  // Good Friday
  dates.push(localIso(addDays(easter,1)));   // Easter Monday
  pushAll(observedFixed(year,4,23));     // Labour Day
  pushAll(observedFixed(year,7,1));      // Emancipation Day
  pushAll(observedFixed(year,7,6));      // Independence Day
  dates.push(localIso(nthWeekday(year,9,1,3))); // National Heroes Day: 3rd Monday Oct
  pushAll(observedFixed(year,11,25));    // Christmas Day
  pushAll(observedFixed(year,11,26));    // Boxing Day

  return [...new Set(dates)].sort();
}

export function allHolidays(year,settings){
  const manual=settings.holidays||[];
  const auto=settings.autoJamaicaHolidays!==false ? jamaicaHolidays(year) : [];
  return [...new Set([...manual,...auto])].sort();
}

export function adjustedPayday(year,monthIndex,payday,settings){
  let d=new Date(year,monthIndex,payday,12,0,0);
  // Month arithmetic can cross year boundaries, so include adjacent-year holiday lists.
  const holidaySet=new Set([
    ...allHolidays(d.getFullYear()-1,settings),
    ...allHolidays(d.getFullYear(),settings),
    ...allHolidays(d.getFullYear()+1,settings)
  ]);
  while(isWeekend(d)||holidaySet.has(localIso(d))){
    d.setDate(d.getDate()-1);
  }
  return d;
}

export function currentCycle(now,payday,settings){
  let thisMonth=adjustedPayday(now.getFullYear(),now.getMonth(),payday,settings);
  let start;
  if(now>=thisMonth) start=thisMonth;
  else start=adjustedPayday(now.getFullYear(),now.getMonth()-1,payday,settings);
  const next=adjustedPayday(start.getFullYear(),start.getMonth()+1,payday,settings);
  const end=new Date(next);end.setDate(end.getDate()-1);
  return {start,end,next};
}

export function inCycle(dateString,cycle){
  const d=new Date(dateString+'T12:00:00');
  return d>=cycle.start&&d<=cycle.end;
}
