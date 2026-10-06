import {mean,stats,holm,correlation,difference,quantile} from './stats.mjs';
export const VERSION='1.0.0';
export const MARKETS={
 SGX:{name:'Singapore · SGX',zone:'Asia/Singapore',currency:'SGD',slots:['09:00','10:00','11:00','13:00','14:00','15:00','16:00'],ends:['10:00','11:00','12:00','14:00','15:00','16:00','17:00'],a:3,aLabel:'Morning',bLabel:'Afternoon',aTime:'09:00–12:00',bTime:'13:00–17:00',aHours:3,bHours:4,break:true},
 US:{name:'US · NYSE / Nasdaq',zone:'America/New_York',currency:'USD',slots:['09:30','10:30','11:30','12:30','13:30','14:30','15:30'],ends:['10:30','11:30','12:30','13:30','14:30','15:30','16:00'],a:3,aLabel:'First 3 hours',bLabel:'Final 3½ hours',aTime:'09:30–12:30',bTime:'12:30–16:00',aHours:3,bHours:3.5,break:false}
};
export const DEFAULT_FEES={notional:10000,brokerPercent:0,brokerMinimum:0,exchangePercent:0,settlement:0,taxPercent:0,slippageBps:0};
export const SAMPLE_CONFIG={market:'SGX',tickers:['D05.SI','O39.SI','U11.SI'],benchmark:'',start:'2024-09-26',end:'2026-09-24',eventDate:'2025-01-21',eventName:'First SGX session after inauguration',excludeDates:[],holdoutPercent:20,fees:{...DEFAULT_FEES,exchangePercent:.04,settlement:.35,taxPercent:9}};
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const TICKER=/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/;
export function validateConfig(input){
 const c={...SAMPLE_CONFIG,...input,fees:{...DEFAULT_FEES,...input?.fees}};
 if(!MARKETS[c.market])throw Error('Choose SGX or US market.');
 c.tickers=[...new Set((c.tickers||[]).map(x=>String(x).trim().toUpperCase()).filter(Boolean))];
 c.benchmark=String(c.benchmark||'').trim().toUpperCase();
 if(c.tickers.length<1||c.tickers.length>5||[...c.tickers,c.benchmark].filter(Boolean).some(x=>!TICKER.test(x)))throw Error('Enter 1–5 valid ticker symbols, plus an optional benchmark.');
 for(const key of ['start','end'])if(!DATE.test(c[key]||'')||!Number.isFinite(Date.parse(c[key]))||new Date(c[key]).toISOString().slice(0,10)!==c[key])throw Error('Use valid start and end dates.');
 if(c.start>c.end)throw Error('Start date must be before end date.');
 if(c.eventDate&&(!DATE.test(c.eventDate)||new Date(c.eventDate).toISOString().slice(0,10)!==c.eventDate))throw Error('Use a valid event date.');
 c.excludeDates=Array.isArray(c.excludeDates)?c.excludeDates:[];
 if(c.excludeDates.some(x=>!DATE.test(x)||!Number.isFinite(Date.parse(x))))throw Error('Excluded dates must use YYYY-MM-DD.');
 if(!Number.isFinite(c.holdoutPercent)||c.holdoutPercent<10||c.holdoutPercent>40)throw Error('Later-period share must be between 10% and 40%.');
 for(const [k,v] of Object.entries(c.fees))if(!Number.isFinite(v)||v<0)throw Error(`Fee setting ${k} must be a non-negative number.`);
 if(c.fees.notional<=0||c.fees.notional>1e9)throw Error('Trade size must be greater than 0 and at most 1 billion.');
 if(c.fees.slippageBps>1000||c.fees.taxPercent>100||c.fees.brokerPercent>10||c.fees.exchangePercent>10)throw Error('Fee or slippage setting is outside the supported range.');
 return c;
}
export function localParts(timestamp,zone){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp)).map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
const pct=(a,b)=>b/a-1;
export function prepareData(dataset,config){
 const c=validateConfig(config),m=MARKETS[c.market],tickers=[...new Set([...c.tickers,c.benchmark].filter(Boolean))],today=localParts(Date.now(),m.zone).date;
 const diagnostics=[],daily=[],allBars=dataset.bars||[];
 if(!Array.isArray(allBars)||allBars.length>200000)throw Error('The dataset must contain at most 200,000 hourly bars.');
 for(const ticker of tickers){
  const input=allBars.filter(b=>b.ticker===ticker),groups=new Map(),seen=new Set();
  const q={ticker,inputBars:input.length,invalidBars:0,duplicates:0,outsideSession:0,incompleteDays:0,currentOrFutureDays:0,completeDays:0,matchedDays:0,excludedDays:[],missingByDate:[]};
  for(const raw of input){
   let b={...raw};if(b.timestamp&&!b.date){try{b={...b,...localParts(b.timestamp,m.zone)}}catch{q.invalidBars++;continue;}}
   if(!DATE.test(b.date||'')||!Number.isFinite(Date.parse(b.date))||![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close,b.high)){q.invalidBars++;continue;}
   if(b.date<c.start||b.date>c.end)continue;
   const key=`${b.date} ${b.time}`;
   if(seen.has(key)){q.duplicates++;throw Error(`Duplicate bar for ${ticker} at ${key}. Remove duplicates before analysing.`);}seen.add(key);
   if(!m.slots.includes(b.time)){q.outsideSession++;continue;}
   if(!groups.has(b.date))groups.set(b.date,new Map());groups.get(b.date).set(b.time,b);
  }
  let previous=null;
  for(const [date,byTime] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
   if(date>=today){q.currentOrFutureDays++;continue;}
   const absent=m.slots.filter(t=>!byTime.has(t));
   if(absent.length){q.incompleteDays++;q.missingByDate.push({date,missing:absent});previous=null;continue;}
   const bars=m.slots.map(t=>byTime.get(t)),open=bars[0].open,aClose=bars[m.a-1].close,bOpen=bars[m.a].open,close=bars.at(-1).close;
   const action=(dataset.actions||[]).find(x=>x.ticker===ticker&&x.date===date);
   const row={ticker,date,weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(date+'T12:00:00Z').getUTCDay()],open,aClose,bOpen,close,a:pct(open,aClose),b:pct(bOpen,close),gap:pct(aClose,bOpen),day:pct(open,close),between:previous&&!action?.split?pct(previous.close,open):null,previousDate:previous?.date||null,hours:bars.map(b=>pct(b.open,b.close)),volume:bars.every(x=>Number.isFinite(x.volume))?bars.reduce((s,b)=>s+b.volume,0):null,dividend:!!action?.dividend,split:!!action?.split,bars};
   previous=row;q.completeDays++;
   if(c.excludeDates.includes(date)){q.excludedDays.push(date);continue;}
   daily.push(row);
  }
  diagnostics.push(q);
 }
 const dateSets=tickers.map(t=>new Set(daily.filter(d=>d.ticker===t).map(d=>d.date)));
 const dates=[...dateSets[0]].filter(d=>dateSets.every(s=>s.has(d))).sort();
 const common=new Set(dates),matched=daily.filter(d=>common.has(d.date));
 for(const q of diagnostics)q.matchedDays=dates.length;
 if(!dates.length)throw Error('No matching complete sessions. Check the market, hourly bar timestamps, date range and selected tickers.');
 return {config:c,market:m,tickers,dates,daily:matched,diagnostics};
}
export function costs(rows,fees){
 const f={...DEFAULT_FEES,...fees},N=f.notional,entry=(Math.max(N*f.brokerPercent/100,f.brokerMinimum)+N*f.exchangePercent/100+f.settlement)*(1+f.taxPercent/100);
 const results=rows.map(r=>{const proceeds=N*(1+r.a),exit=(Math.max(proceeds*f.brokerPercent/100,f.brokerMinimum)+proceeds*f.exchangePercent/100+f.settlement)*(1+f.taxPercent/100),execution=(N+proceeds)*f.slippageBps/10000,gross=N*r.a,fees=entry+exit;return {date:r.date,gross,fees,execution,net:gross-fees-execution};});
 return {notional:N,n:results.length,gross:mean(results.map(x=>x.gross)),fees:mean(results.map(x=>x.fees)),execution:mean(results.map(x=>x.execution)),net:mean(results.map(x=>x.net)),netWin:results.length?results.filter(x=>x.net>0).length/results.length:null,netStats:stats(results.map(x=>x.net/N)),assumptions:f,rows:results};
}
export function analyse(dataset,inputConfig){
 const p=prepareData(dataset,inputConfig),{config:c,market:m,tickers,dates,daily,diagnostics}=p;
 const summaries=[],hourly=[],periods=[],robustness=[],conditional=[],comparisons=[],events=[],rolling=[],stability=[];
 const cutoff=Math.floor(dates.length*(1-c.holdoutPercent/100)),splitDate=dates[Math.min(cutoff,dates.length-1)];
 for(const ticker of tickers){
  const ds=daily.filter(x=>x.ticker===ticker),a=stats(ds.map(x=>x.a)),b=stats(ds.map(x=>x.b));
  const aUp=ds.filter(x=>x.a>0),aDown=ds.filter(x=>x.a<0);
  summaries.push({ticker,a,b,day:stats(ds.map(x=>x.day)),gap:stats(ds.map(x=>x.gap)),between:stats(ds.map(x=>x.between)),both:ds.filter(x=>x.a>0&&x.b<0).length/ds.length,bothCount:ds.filter(x=>x.a>0&&x.b<0).length,afterUpDown:aUp.length?aUp.filter(x=>x.b<0).length/aUp.length:null,aPerHour:mean(ds.map(x=>Math.log1p(x.a)/m.aHours)),bPerHour:mean(ds.map(x=>Math.log1p(x.b)/m.bHours))});
  m.slots.forEach((time,i)=>hourly.push({ticker,slot:i,interval:`${time}–${m.ends[i]}`,durationMinutes:i===6&&c.market==='US'?30:60,...stats(ds.map(x=>x.hours[i]))}));
  const addPeriod=(group,label,rows)=>{for(const metric of ['a','b'])periods.push({ticker,group,label,metric,start:rows[0]?.date||null,end:rows.at(-1)?.date||null,...stats(rows.map(x=>x[metric]))});};
  for(const year of [...new Set(ds.map(x=>x.date.slice(0,4)))])addPeriod('Year',year,ds.filter(x=>x.date.startsWith(year)));
  for(const month of [...new Set(ds.map(x=>x.date.slice(0,7)))])addPeriod('Month',month,ds.filter(x=>x.date.startsWith(month)));
  for(const day of ['Mon','Tue','Wed','Thu','Fri'])addPeriod('Weekday',day,ds.filter(x=>x.weekday===day));
  for(const n of [20,60,120])addPeriod('Recent',`Last ${n} sessions`,ds.slice(-n));
  for(const metric of ['a','b']){
   const early=ds.filter(x=>x.date<splitDate),late=ds.filter(x=>x.date>=splitDate);
   stability.push({ticker,metric,splitDate,early:stats(early.map(x=>x[metric])),late:stats(late.map(x=>x[metric])),note:'Descriptive chronological split; this report displays both periods, so the later period is not an untouched holdout after review.'});
   robustness.push({ticker,metric,test:'All matched sessions',...stats(ds.map(x=>x[metric]))});
   const ranked=[...ds].sort((x,y)=>Math.abs(y[metric])-Math.abs(x[metric])),remove=Math.min(10,Math.floor(ds.length*.1)),ids=new Set(ranked.slice(0,remove).map(x=>x.date));
   robustness.push({ticker,metric,test:`Remove ${remove} largest absolute moves`,...stats(ds.filter(x=>!ids.has(x.date)).map(x=>x[metric]))});
   if(dataset.actionsAvailable)robustness.push({ticker,metric,test:'Exclude ex-dividend / split dates',...stats(ds.filter(x=>!x.dividend&&!x.split).map(x=>x[metric]))});
   const sorted=ds.map(x=>x[metric]).sort((a,b)=>a-b),k=Math.floor(sorted.length*.05);
   robustness.push({ticker,metric,test:'5% trimmed at each tail (descriptive)',...stats(sorted.slice(k,sorted.length-k)),low:null,high:null,p:null,se:null});
   if(c.eventDate){const pre=ds.filter(x=>x.date<c.eventDate),post=ds.filter(x=>x.date>=c.eventDate),n=Math.min(pre.length,post.length);for(const [label,x,y] of [['All available',pre,post],['Matched length',pre.slice(-n||pre.length),post.slice(0,n)]])events.push({ticker,metric,label,date:c.eventDate,name:c.eventName||'Selected event',before:stats(x.map(r=>r[metric])),after:stats(y.map(r=>r[metric])),...difference(x.map(r=>r[metric]),y.map(r=>r[metric]))});}
  }
  for(const [label,rows] of [['After positive first session',aUp],['After negative first session',aDown],['After flat first session',ds.filter(x=>x.a===0)]])conditional.push({ticker,label,...stats(rows.map(x=>x.b))});
  const threshold=quantile(ds.map(x=>Math.abs(x.a)),.75);
  conditional.push({ticker,label:'After top-quartile absolute first-session move (exploratory)',...stats(ds.filter(x=>Math.abs(x.a)>=threshold).map(x=>x.b))});
  for(let i=19;i<ds.length;i++)rolling.push({ticker,date:ds[i].date,a20:mean(ds.slice(i-19,i+1).map(x=>x.a)),b20:mean(ds.slice(i-19,i+1).map(x=>x.b)),a60:i>=59?mean(ds.slice(i-59,i+1).map(x=>x.a)):null,b60:i>=59?mean(ds.slice(i-59,i+1).map(x=>x.b)):null});
 }
 holm(hourly);holm(summaries.flatMap(s=>[s.a,s.b]));holm(events);
 const primary=c.tickers[0],primaryDays=daily.filter(x=>x.ticker===primary),byTicker=Object.fromEntries(tickers.map(t=>[t,new Map(daily.filter(x=>x.ticker===t).map(x=>[x.date,x]))]));
 for(const other of tickers.filter(t=>t!==primary))for(const metric of ['a','b']){const left=primaryDays.map(x=>x[metric]),right=primaryDays.map(x=>byTicker[other].get(x.date)[metric]);comparisons.push({ticker:primary,other,metric,correlation:correlation(left,right),...stats(left.map((v,i)=>v-right[i]))});}
 const peers=c.tickers.filter(t=>t!==primary);if(peers.length>1)for(const metric of ['a','b'])comparisons.push({ticker:primary,other:'Equal-weight peers',metric,correlation:null,...stats(primaryDays.map(x=>x[metric]-mean(peers.map(t=>byTicker[t].get(x.date)[metric]))))});
 holm(comparisons);
 const warnings=[
  'Hourly OHLC observations are price measurements, not guaranteed executable prices. Returns exclude dividends.',
  'Only matching complete sessions are retained. Entirely missing dates cannot be distinguished from exchange holidays without an external calendar.',
  'Session templates exclude off-session bars and incomplete/short sessions. Current local trading day is always excluded.',
  '95% intervals use a Newey–West estimate (5 lags) and a large-sample normal approximation; inference is suppressed below 20 observations or at zero variance.',
  'Holm corrections are separate families: all hourly tests, all session means, peer excess tests and event differences. Subgroup searches remain exploratory.',
  'The chronological split is a stability check, not proof of an independently validated strategy. Freeze a hypothesis before collecting unseen future data.',
  'Provider hourly bucket boundaries must match the selected session template. SGX noon/closing bars are excluded; the final US interval is 30 minutes.',
  'Between-session gaps use the previous observed complete session close, not the official auction close. Splits suppress this gap on the event date.',
  'No factor regression, news attribution, historical spread reconstruction or automated trade execution is performed.'
 ];
 if(!dataset.actionsAvailable)warnings.push('Corporate-action dates were not supplied. Dividend/split exclusion checks are unavailable; price basis must be verified by the data supplier.');
 if(dates.length<60)warnings.push('Fewer than 60 matching days: estimates are especially unstable.');
 if(diagnostics.some(q=>q.invalidBars))warnings.push('Invalid OHLC rows were discarded; review the data-quality counts.');
 if(dataset.meta?.some(x=>x.currency&&x.currency!==m.currency))throw Error('Selected instruments have different quote currencies. Choose stocks from the same market/currency.');
 const result={version:VERSION,createdAt:new Date().toISOString(),source:dataset.source||'User supplied',retrievedAt:dataset.retrievedAt||null,config:c,market:m,tickers,start:dates[0],end:dates.at(-1),n:dates.length,summaries,hourly,periods,conditional,robustness,comparisons,events,rolling,stability,costs:costs(primaryDays,c.fees),diagnostics,warnings,daily};
 result.findings=makeFindings(result);return result;
}
export const formatPct=(x,digits=3)=>x===null||!Number.isFinite(x)?'—':`${x>0?'+':''}${(x*100).toFixed(digits)}%`;
export function makeFindings(r){const s=r.summaries[0],findings=[];findings.push(`${s.ticker}: ${r.market.aLabel.toLowerCase()} average ${formatPct(s.a.mean)}; ${r.market.bLabel.toLowerCase()} average ${formatPct(s.b.mean)} across ${r.n} matched sessions.`);findings.push(`First session up and second session down: ${s.bothCount}/${r.n} days (${(s.both*100).toFixed(1)}%). After a positive first session, the second fell ${s.afterUpDown===null?'on no measurable sample':(s.afterUpDown*100).toFixed(1)+'% of the time'}.`);const sig=r.hourly.filter(x=>x.adjustedP!==null&&x.adjustedP<.05);findings.push(sig.length?`${sig.length} hourly comparison(s) survive the within-study Holm correction; verify stability and costs before interpreting.`:'No hourly mean clears the 5% threshold after correction across the selected instruments and hours.');const rob=r.robustness.find(x=>x.ticker===s.ticker&&x.metric==='a'&&x.test.startsWith('Remove'));if(rob)findings.push(`After removing the largest moves, first-session mean is ${formatPct(rob.mean)} (original ${formatPct(s.a.mean)}).`);findings.push(`At ${r.market.currency} ${r.costs.notional.toLocaleString()}, estimated average first-session net P/L is ${r.market.currency} ${r.costs.net.toFixed(2)} under the entered costs.`);return findings;}
export function compactReport(r){const {daily,rolling,costs,...rest}=r;const {rows,...compactCosts}=costs;return {...rest,costs:compactCosts,rollingLatest:r.tickers.map(t=>rolling.filter(x=>x.ticker===t).at(-1)),followUp:['Check whether the effect persists on unseen future sessions.','Review data gaps, provider price adjustments and the economic relevance of the chosen peers.','Choose stock-specific events or factors only after distinguishing exploratory findings from predeclared tests.']};}
export function markdownReport(r){return `# Stock Time Lab — ${r.config.tickers[0]}\n\n${r.start} to ${r.end} · ${r.n} matching complete sessions · ${r.market.zone}\n\nSource: ${r.source}\nEngine: ${r.version}\n\n## Findings\n\n${r.findings.map(x=>'- '+x).join('\n')}\n\n## Sessions\n\n| Instrument | First-session mean | Second-session mean | Pattern share |\n|---|---:|---:|---:|\n${r.summaries.map(s=>`| ${s.ticker} | ${formatPct(s.a.mean)} | ${formatPct(s.b.mean)} | ${(100*s.both).toFixed(1)}% |`).join('\n')}\n\nFirst: ${r.market.aTime}. Second: ${r.market.bTime}. Price returns; no dividend reinvestment.\n\n## Limits and method\n\n${r.warnings.map(x=>'- '+x).join('\n')}\n\n## Next research questions\n\n- Are the selected peers and benchmark economically appropriate?\n- Does the result persist after realistic execution costs and on unseen future data?\n- Which stock-specific events or factors warrant a predeclared follow-up test?\n\nThe JSON report contains confidence intervals, corrected p-values, subgroup sample sizes, settings and provenance. Raw data remain in the companion CSV.\n`;}
