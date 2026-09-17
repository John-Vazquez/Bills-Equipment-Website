import {mkdir,cp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {generatePages,pageNames} from './pages.mjs';
import {RELEASE} from '../js/store/config.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const publicPaths=[...pageNames,'assets','js/store','js/supabase-config.js','styles/store','favicon.ico','apple-touch-icon.png','web-app-manifest-192x192.png','web-app-manifest-512x512.png'];
export async function build(){
 const dist=join(root,'dist');await generatePages(root);await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
 for(const p of publicPaths){const out=join(dist,p);await mkdir(dirname(out),{recursive:true});await cp(join(root,p),out,{recursive:true});}
 await writeFile(join(dist,'site.webmanifest'),JSON.stringify({name:"Bill's Equipment & Rentals",short_name:"Bill's Equipment",start_url:'/',display:'browser',background_color:'#ffffff',theme_color:'#d9000c',icons:[{src:'/web-app-manifest-192x192.png',sizes:'192x192',type:'image/png'},{src:'/web-app-manifest-512x512.png',sizes:'512x512',type:'image/png'}]},null,2)+'\n');
 const canonical='https://www.billsequipmentandrentals.com';
 await writeFile(join(dist,'robots.txt'),`User-agent: *\nDisallow: /admin.html\nDisallow: /admin-login.html\nDisallow: /preview.html\nDisallow: /cart.html\nSitemap: ${canonical}/sitemap.xml\n`);
 await writeFile(join(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+['','products.html','rentals.html','about.html','contact.html','brands.html'].map(p=>`  <url><loc>${canonical}/${p}</loc></url>`).join('\n')+'\n</urlset>\n');
 const csp="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests";
 await writeFile(join(dist,'_headers'),`/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Cache-Control: public, max-age=0, must-revalidate\n/admin.html\n  X-Robots-Tag: noindex, nofollow\n/preview.html\n  X-Robots-Tag: noindex, nofollow\n`);
 const files=[];
 async function walk(dir,prefix=''){for(const entry of(await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=prefix+entry.name;if(entry.isDirectory())await walk(join(dir,entry.name),path+'/');else files.push({path,sha256:createHash('sha256').update(await readFile(join(dir,entry.name))).digest('hex')});}}
 await walk(dist);
 await writeFile(join(dist,'version.json'),JSON.stringify({release:RELEASE,build:new Date().toISOString(),content_sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex')},null,2)+'\n');
 console.log(`Built ${files.length+1} public files in ${dist}. No database, hosting or Git changes were made.`);return dist;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
