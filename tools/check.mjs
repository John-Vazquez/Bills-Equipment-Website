import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {pageNames} from './pages.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');let checked=0;
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(/\.(js|mjs)$/.test(e.name)){const result=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(result.status)throw new Error(result.stderr);checked++;}}}
for(const d of ['js/store','tools','supabase/functions','tests'])await walk(join(root,d));
for(const page of pageNames){const html=await readFile(join(root,page),'utf8');if(/\son\w+=/i.test(html))throw new Error('Inline JavaScript in '+page);for(const match of html.matchAll(/(?:src|href)="([^"?#]+)[^"]*"/g)){const path=match[1];if(/^(?:https?:|mailto:|tel:|#|data:)/i.test(path))continue;await access(join(root,path)).catch(()=>{throw new Error(`Missing ${path} in ${page}`);});}}
const config=await readFile(join(root,'js/supabase-config.js'),'utf8');if(/sb_secret_|service_role\s*[:=]|eyJ[a-zA-Z0-9_-]{100}/.test(config))throw new Error('Possible secret in public configuration.');
console.log(`Syntax checked ${checked} JavaScript modules; checked ${pageNames.length} page asset links and public key configuration.`);
