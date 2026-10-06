#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyse,SAMPLE_CONFIG,compactReport,markdownReport} from '../lib/research/engine.mjs';
import {fetchYahoo,parseCSV,dataCSV} from '../lib/research/data.mjs';
import {makeWorkbook} from '../lib/research/workbook.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args={};for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(['--sample','--help'].includes(key))args[key]=true;else if(['--config','--csv','--data','--out'].includes(key)){if(!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error(`Missing value for ${key}`);args[key]=process.argv[++i];}else throw Error(`Unknown option ${key}. Use --help.`);}
if(args['--help']){console.log('Stock Time Lab\n\nnode scripts/analyse.mjs --sample --out outputs/dbs\nnode scripts/analyse.mjs --config examples/sgx.json --out outputs/live\nnode scripts/analyse.mjs --config study-config.json --csv prices.csv --out outputs/import\n\n--sample uses the frozen original DBS study. Without --sample/--csv/--data, prices are downloaded. --data accepts the JSON dataset schema. Node.js 22+; no API key or AI calls.');process.exit(0);}
try{
 if([args['--sample'],args['--csv'],args['--data']].filter(Boolean).length>1)throw Error('Choose one input: --sample, --csv or --data.');
 const config=args['--config']?JSON.parse(await fs.readFile(args['--config'],'utf8')):structuredClone(SAMPLE_CONFIG);
 let dataset;if(args['--sample'])dataset=JSON.parse(await fs.readFile(path.join(root,'public/data/sg-banks.json'),'utf8'));else if(args['--csv'])dataset=parseCSV(await fs.readFile(args['--csv'],'utf8'));else if(args['--data'])dataset=JSON.parse(await fs.readFile(args['--data'],'utf8'));else dataset=await fetchYahoo(config);
 const r=analyse(dataset,config),out=path.resolve(args['--out']||'outputs/study');await fs.mkdir(out,{recursive:true});
 const artifacts={'summary.md':markdownReport(r),'results.json':JSON.stringify(compactReport(r),null,2),'config.json':JSON.stringify(r.config,null,2),'source-prices.csv':dataCSV(dataset,r.config.market),'dataset.json':JSON.stringify(dataset),'study.xlsx':makeWorkbook(r,dataset)};
 for(const [name,body] of Object.entries(artifacts))await fs.writeFile(path.join(out,name),body);
 console.log(`${r.config.tickers[0]}: ${r.n} matching sessions, ${r.start} to ${r.end}\n${r.findings.join('\n')}\n\nSaved ${Object.keys(artifacts).join(', ')} to ${out}`);
}catch(e){console.error(`Study failed: ${e.message}`);process.exitCode=1;}
