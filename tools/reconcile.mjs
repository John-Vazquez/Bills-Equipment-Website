/** Read-only inventory reconciliation. No credentials and no network writes. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function parseCSV(input){
 const rows=[];let row=[],value='',quoted=false;const s=input.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(value);if(row.some(x=>x!==''))rows.push(row);row=[];value='';}else value+=c;}
 if(quoted)throw new Error('CSV has an unterminated quoted field.');if(value||row.length){row.push(value);rows.push(row);}if(!rows.length)return [];
 const headers=rows.shift().map(x=>x.trim());return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]||''])));
}
const normal=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function reconcile(snapshot,legacy){
 if(!Array.isArray(snapshot.products)||!Array.isArray(snapshot.categories))throw new Error('Use the inventory JSON exported from Website Manager.');
 const products=snapshot.products,categories=new Set(snapshot.categories.map(c=>c.id));
 const names=new Map(),external=new Map();for(const p of products){const name=normal(p.name);names.set(name,[...(names.get(name)||[]),p.id]);if(p.external_id){const key=String(p.source||'')+':'+p.external_id;external.set(key,[...(external.get(key)||[]),p.id]);}}
 const review=products.map(p=>({id:p.id,name:p.name,flags:[!(p.category_ids||[p.category_id]).some(id=>categories.has(id))?'uncategorized':'',!p.product_images?.length?'no_images':'',!p.website?.stock_verified_at?'stock_unverified':'',!p.call_for_price&&(p.price===null||!Number.isFinite(Number(p.price)))?'invalid_price':'',names.get(normal(p.name))?.length>1?'similar_name':''].filter(Boolean)})).filter(p=>p.flags.length);
 const rows=legacy.map(r=>{const name=r.name||r.product_name||r.Name||r.title||'',model=r.model||r.Model||'',eid=r.external_id||'',source=r.source||'manual';const exact=eid?external.get(source+':'+eid)||[]:[];const similar=names.get(normal(name))||[];const modelMatches=model?products.filter(p=>normal(p.model)===normal(model)).map(p=>p.id):[];return {legacy_name:name,legacy_model:model,legacy_url:r.url||r.source_url||'',matched_product_ids:exact.length?exact:[...new Set([...similar,...modelMatches])],classification:exact.length?'external_id_match':similar.length||modelMatches.length?'candidate_review_required':'no_match_found'};});
 return {generated_at:new Date().toISOString(),read_only:true,notice:'Candidate matches are not proof of duplication. Nothing was inserted, merged, deleted, repriced or published.',current_product_count:products.length,legacy_row_count:legacy.length,duplicate_external_ids:[...external].filter(([,ids])=>ids.length>1).map(([key,ids])=>({key,ids})),products_needing_review:review,legacy_comparison:rows};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);const val=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};const snapshot=val('--snapshot'),legacy=val('--legacy'),out=val('--out')||'inventory-reconciliation.json';
 if(!snapshot||!legacy){console.error('Usage: node tools/reconcile.mjs --snapshot inventory.json --legacy legacy.csv [--out report.json]');process.exitCode=1;}
 else{const report=reconcile(JSON.parse(await readFile(snapshot,'utf8')),parseCSV(await readFile(legacy,'utf8')));await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(`Read-only report written to ${resolve(out)}. No website or database changes.`);}
}
