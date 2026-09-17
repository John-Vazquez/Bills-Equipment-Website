import {LOCAL_PREVIEW} from './config.js';
import {MAX_IMAGE_BYTES,MAX_IMAGES,PRODUCT_BUCKET,MEDIA_BUCKET} from './config.js';
import {getClient} from './client.js';
const TYPES=new Set(['image/jpeg','image/png','image/webp','image/avif']);
export function validateFiles(files,currentCount=0){
 if(currentCount+files.length>MAX_IMAGES)throw new Error(`Use no more than ${MAX_IMAGES} images per product.`);
 for(const f of files){if(!TYPES.has(f.type))throw new Error(`${f.name}: use JPEG, PNG, WebP or AVIF images.`);if(!f.size||f.size>MAX_IMAGE_BYTES)throw new Error(`${f.name}: images must be smaller than 10 MB.`);}
}
/** Decode/re-encode every new image before uploading anything. This strips metadata and rejects invalid files. */
export async function prepareImage(file,maxDimension=1800){
 validateFiles([file]);const bitmap=await createImageBitmap(file).catch(()=>{throw new Error(`${file.name}: this file could not be read as an image.`);});
 try{
 if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>65000000)throw new Error(`${file.name}: image dimensions are too large.`);
 const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const context=canvas.getContext('2d');if(!context)throw new Error('Image processing is unavailable in this browser.');context.drawImage(bitmap,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.86));if(!blob||blob.type!=='image/webp')throw new Error('This browser cannot prepare WebP images. Use an updated browser.');if(blob.size>MAX_IMAGE_BYTES)throw new Error(`${file.name}: the prepared image is too large.`);return blob;
 }finally{bitmap.close();}
}
async function digest(blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function uploadPrepared(bucket,path,blob){
 if(LOCAL_PREVIEW)throw new Error('Local preview is read-only; image uploads and removal are disabled.');
 const c=await getClient();const {error}=await c.storage.from(bucket).upload(path,blob,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
 if(!error)return;
 if(String(error.statusCode)==='409'||/already exists|duplicate/i.test(error.message||'')){
   // A prior upload may have committed even if its response was lost. Do not overwrite blindly.
   const {data, error:readError}=await c.storage.from(bucket).download(path);
   if(!readError&&data&&await digest(data)===await digest(blob))return;
 }
 throw new Error('Photo upload failed: '+(error.message||'please retry.'));
}
/** Removing a gallery association never destroys shared/legacy bytes. A separate reviewed
 * orphan-storage report is provided; keeping files also makes lost-response retries recoverable. */
export function retainedImageNotice(paths){
 return paths?.length ? 'Removed photos are no longer shown. Original files are retained in storage for safe recovery.' : '';
}
