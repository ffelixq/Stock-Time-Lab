import {localParts,validateConfig,MARKETS} from './engine.mjs';
export async function fetchYahoo(config,fetcher=fetch){
 const c=validateConfig(config),m=MARKETS[c.market],tickers=[...new Set([...c.tickers,c.benchmark].filter(Boolean))];
 const start=Math.floor(Date.parse(c.start+'T00:00:00Z')/1000)-86400,end=Math.floor(Date.parse(c.end+'T00:00:00Z')/1000)+2*86400;
 if((end-start)/86400>735)throw Error('Hourly download is limited to approximately two years. Use CSV import for longer licensed history.');
 const dataset={source:'Yahoo Finance chart endpoint · hourly OHLC · unadjusted dividends',retrievedAt:new Date().toISOString(),actionsAvailable:true,bars:[],actions:[],meta:[]};
 for(const ticker of tickers){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1h&period1=${start}&period2=${Math.min(end,Math.floor(Date.now()/1000))}&includePrePost=false&events=div%2Csplits`;
  let response;try{response=await fetcher(url,{headers:{'User-Agent':'StockTimeLab/1.0 personal-research'},signal:AbortSignal.timeout(20000)});}catch{throw Error(`Could not reach the price provider for ${ticker}. Try a shorter period or import CSV.`);}
  if(!response.ok)throw Error(`Price provider returned ${response.status} for ${ticker}. It may be rate-limited or the requested history unavailable. Try a shorter range or CSV import.`);
  const body=await response.json(),result=body.chart?.result?.[0];
  if(!result||body.chart?.error)throw Error(body.chart?.error?.description||`No hourly history for ${ticker}.`);
  const zone=result.meta?.exchangeTimezoneName;
  if(zone!==m.zone)throw Error(`${ticker} trades in ${zone||'an unknown timezone'}, but ${m.zone} was selected. Choose the matching market. Cross-market studies are not supported in this version.`);
  dataset.meta.push({ticker,zone,currency:result.meta?.currency,providerInterval:result.meta?.dataGranularity});
  const q=result.indicators?.quote?.[0];if(!q||!result.timestamp?.length)throw Error(`No hourly bars for ${ticker} in the requested period.`);
  result.timestamp.forEach((t,i)=>dataset.bars.push({ticker,...localParts(t*1000,m.zone),timestamp:new Date(t*1000).toISOString(),open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]??null}));
  const acts=new Map();for(const [key,items] of Object.entries(result.events||{}))for(const event of Object.values(items)){const date=localParts(event.date*1000,m.zone).date;if(!acts.has(date))acts.set(date,{ticker,date});acts.get(date)[key==='dividends'?'dividend':'split']=true;}
  dataset.actions.push(...acts.values());
 }return dataset;
}
export function parseCSV(text){
 if(typeof text!=='string'||text.length>25*1024*1024)throw Error('CSV must be under 25 MB.');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=ch;}
 if(quoted)throw Error('CSV contains an unclosed quoted field.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw Error('CSV needs a header and at least one data row.');
 const header=rows.shift().map(x=>x.trim().replace(/^\uFEFF/,'').toLowerCase());
 for(const key of ['ticker','open','high','low','close'])if(!header.includes(key))throw Error(`CSV is missing the ${key} column.`);
 if(!header.includes('timestamp')&&(!header.includes('date')||!header.includes('time')))throw Error('CSV needs date and time columns in exchange local time, or an ISO timestamp with a timezone.');
 const actions=[];const bars=rows.map((row,i)=>{if(row.length!==header.length)throw Error(`CSV row ${i+2} has ${row.length} fields; expected ${header.length}.`);const raw=Object.fromEntries(header.map((key,k)=>[key,row[k].trim()]));const b={ticker:raw.ticker.toUpperCase()};for(const key of ['open','high','low','close','volume'])b[key]=raw[key]!==undefined&&raw[key]!==''?Number(raw[key]):null;
  if(raw.date&&raw.time){b.date=raw.date;b.time=raw.time.slice(0,5);}else{if(!raw.timestamp||!/(Z|[+-]\d{2}:\d{2})$/.test(raw.timestamp)||!Number.isFinite(Date.parse(raw.timestamp)))throw Error(`CSV row ${i+2} needs an ISO timestamp with Z or a UTC offset.`);b.timestamp=raw.timestamp;}
  if(raw.dividend==='1'||raw.split==='1'){if(!b.date)throw Error('Corporate-action flags require a local date column.');actions.push({ticker:b.ticker,date:b.date,dividend:raw.dividend==='1',split:raw.split==='1'});}return b;});
 return {source:'Imported CSV · user supplied price basis',retrievedAt:new Date().toISOString(),actionsAvailable:header.includes('dividend')&&header.includes('split'),actions,bars};
}
const safeCSV=x=>{const s=String(x??'');const safe=typeof x==='string'&&/^[=+\-@\t\r]/.test(s)?"'"+s:s;return '"'+safe.replaceAll('"','""')+'"';};
export function dataCSV(dataset,market='SGX'){const columns=['ticker','date','time','open','high','low','close','volume'];const actionCols=dataset.actionsAvailable?['dividend','split']:[];const act=new Map((dataset.actions||[]).map(a=>[a.ticker+'|'+a.date,a]));return [...columns,...actionCols].join(',')+'\n'+dataset.bars.map(raw=>{const b=raw.date?raw:{...raw,...localParts(raw.timestamp,MARKETS[market].zone)};const a=act.get(b.ticker+'|'+b.date)||{};return [...columns.map(k=>b[k]),...actionCols.map(k=>a[k]?1:0)].map(safeCSV).join(',');}).join('\n');}
