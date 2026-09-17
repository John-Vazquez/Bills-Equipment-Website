import {getClient} from './client.js';
import {checkStaff} from './data.js';
import {messageBox} from './ui.js';
const form=document.getElementById('loginForm'),button=document.getElementById('loginButton'),message=document.getElementById('loginMessage');
const show=text=>{message.hidden=false;message.innerHTML=messageBox(text);};
(async()=>{try{if(await checkStaff())location.replace('admin.html');}catch{/* Form stays available when the initial network check fails. */}})();
form.addEventListener('submit',async event=>{
 event.preventDefault();if(button.disabled)return;const username=form.username.value.trim().toLowerCase();if(username!=='billsadmin'){show('Invalid username or password.');return;}
 button.disabled=true;button.textContent='Signing in…';message.hidden=true;
 try{
  const c=await getClient();const {data,error}=await c.auth.signInWithPassword({email:'billsadmin@auth.billsequipmentandrentals.com',password:form.password.value});
  if(error||!data.user)throw new Error('Invalid username or password.');
  if(!await checkStaff()){await c.auth.signOut();throw new Error('This account is not authorized for the website manager.');}
  form.password.value='';location.replace('admin.html');
 }catch(error){show(error.message||'Unable to sign in. Check your connection.');}finally{button.disabled=false;button.textContent='Sign In';}
});
if(new URLSearchParams(location.search).get('reason')==='unauthorized')show('Your employee session has ended or is no longer authorized.');
