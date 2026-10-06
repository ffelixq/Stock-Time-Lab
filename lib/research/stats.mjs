export const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
export function quantile(a,p) { if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),i=(x.length-1)*p,k=Math.floor(i);return x[k]+(x[Math.min(k+1,x.length-1)]-x[k])*(i-k); }
export function normalCDF(x) { const t=1/(1+.2316419*Math.abs(x));const q=.3989422804014327*Math.exp(-x*x/2)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?1-q:q; }
export function stats(values,lags=5) {
 const a=values.filter(Number.isFinite),n=a.length;if(!n)return {n:0,mean:null,median:null,sd:null,se:null,low:null,high:null,p:null,up:null,down:null,flat:null,p05:null,p95:null,trimmed:null};
 const m=a.every(x=>x===a[0])?a[0]:mean(a),e=a.map(x=>x-m),ss=e.reduce((s,x)=>s+x*x,0);let long=ss;
 for(let l=1;l<=Math.min(lags,n-1);l++){let s=0;for(let i=l;i<n;i++)s+=e[i]*e[i-l];long+=2*(1-l/(lags+1))*s;}
 const se=n>1?Math.sqrt(Math.max(0,long))/n:null;
 const inference=n>=20&&se>0;const k=Math.floor(.05*n),sorted=[...a].sort((a,b)=>a-b);
 return {n,mean:m,median:quantile(a,.5),sd:n>1?Math.sqrt(ss/(n-1)):null,se,low:inference?m-1.95996398454*se:null,high:inference?m+1.95996398454*se:null,p:inference?Math.min(1,2*(1-normalCDF(Math.abs(m/se)))):null,up:a.filter(x=>x>0).length/n,down:a.filter(x=>x<0).length/n,flat:a.filter(x=>x===0).length/n,p05:quantile(a,.05),p95:quantile(a,.95),trimmed:mean(sorted.slice(k,n-k)),lags:Math.min(lags,n-1)};
}
export function holm(rows,key='p',out='adjustedP') {const valid=rows.filter(r=>Number.isFinite(r[key])).sort((a,b)=>a[key]-b[key]);let last=0;for(let i=0;i<valid.length;i++){last=Math.max(last,Math.min(1,valid[i][key]*(valid.length-i)));valid[i][out]=last;}for(const row of rows)if(!Number.isFinite(row[key]))row[out]=null;return rows;}
export function correlation(a,b){if(a.length<3)return null;const ma=mean(a),mb=mean(b);let xx=0,yy=0,xy=0;for(let i=0;i<a.length;i++){xx+=(a[i]-ma)**2;yy+=(b[i]-mb)**2;xy+=(a[i]-ma)*(b[i]-mb);}return xx&&yy?xy/Math.sqrt(xx*yy):null;}
export function difference(before,after){const a=stats(before),b=stats(after);const d=a.n&&b.n?b.mean-a.mean:null,se=a.se!==null&&b.se!==null?Math.sqrt(a.se*a.se+b.se*b.se):null;const valid=a.n>=20&&b.n>=20&&se>0;return {difference:d,low:valid?d-1.96*se:null,high:valid?d+1.96*se:null,p:valid?2*(1-normalCDF(Math.abs(d/se))):null};}
