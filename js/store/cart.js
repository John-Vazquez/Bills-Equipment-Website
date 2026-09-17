import {validateCart} from './model.js';
import {MAX_CART_LINES,MAX_QUANTITY} from './config.js';
const KEY='bills.request-cart.v2';let memory=[],storageAvailable=true;
function load(){try{memory=validateCart(JSON.parse(localStorage.getItem(KEY)||'[]'));}catch{storageAvailable=false;}return memory;}
load();
export function getCart(){return memory.map(x=>({...x}));}
export function cartCount(){return memory.reduce((sum,x)=>sum+x.quantity,0);}
export function isCartPersistent(){return storageAvailable;}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(memory));}catch{storageAvailable=false;}globalThis.dispatchEvent?.(new Event('bills:cart'));}
export function addToCart(id,mode='sale',quantity=1){
  const row=validateCart([{id,mode,quantity}])[0];if(!row)throw new Error('Select a whole quantity from 1 to 99.');
  id=row.id;quantity=row.quantity;const found=memory.find(x=>x.id===id&&x.mode===mode);
  if(found){if(found.quantity+quantity>MAX_QUANTITY)throw new Error('The maximum request quantity is 99 per item.');found.quantity+=quantity;}
  else {if(memory.length>=MAX_CART_LINES)throw new Error('The request cart can hold up to 50 different items.');memory.push(row);}persist();
}
export function changeQuantity(id,mode,quantity){if(!Number.isInteger(quantity)||quantity<1||quantity>MAX_QUANTITY)throw new Error('Enter a whole quantity from 1 to 99.');const row=memory.find(x=>x.id===id&&x.mode===mode);if(row){row.quantity=quantity;persist();}}
export function removeItem(id,mode){memory=memory.filter(x=>x.id!==id||x.mode!==mode);persist();}
export function clearCart(){memory=[];persist();}
export function removeSubmittedItems(submitted){
  // Do not clear items added in another tab while an enquiry was in flight.
  for(const line of submitted){const row=memory.find(x=>x.id===line.id&&x.mode===line.mode);if(row)row.quantity-=line.quantity;}
  memory=memory.filter(x=>x.quantity>0);persist();
}
globalThis.addEventListener?.('storage',event=>{if(event.key===KEY){load();globalThis.dispatchEvent(new Event('bills:cart'));}});
