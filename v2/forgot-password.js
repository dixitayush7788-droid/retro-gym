import{createClient}from'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL='https://zfvkvrhuovvbfbrutpph.supabase.co',KEY='sb_publishable_bFbeqpwaWmp0aioDVSkLAg_J7X4lzWk';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'nexus-v2-recovery-auth'}});
const email=document.querySelector('#email'),send=document.querySelector('#send'),status=document.querySelector('#status');
const returnSurface=new URLSearchParams(window.location.search).get('return')==='owner'?'owner':'superadmin';
const recoveryUrl=window.location.origin+window.location.pathname+'?return='+encodeURIComponent(returnSurface);
function message(text,bad=false){const el=document.querySelector('#status');if(!el)return;el.textContent=text;el.className='errorbox'+(bad?' bad':'');}
function showRecoveryForm(){
  const h=document.querySelector('h1'),m=document.querySelector('.muted'),form=document.querySelector('.form');
  if(!h||!m||!form)return;
  h.textContent='Set new password';
  m.textContent='Create a new password for your NEXUS account.';
  form.innerHTML='<label>New password<input id="newpass" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirm password<input id="confirm" type="password" minlength="8" autocomplete="new-password" required></label><button id="save">UPDATE PASSWORD</button><div id="status" class="errorbox"></div>';
  document.querySelector('#save').onclick=async()=>{
    const p=document.querySelector('#newpass').value,c=document.querySelector('#confirm').value;
    if(p.length<8)return message('Password must be at least 8 characters.',true);
    if(p!==c)return message('Passwords do not match.',true);
    const save=document.querySelector('#save');save.disabled=true;save.textContent='UPDATING…';
    try{
      const{error}=await sb.auth.updateUser({password:p});
      if(error)throw error;
      message('Password updated successfully. Redirecting to Super Admin login…');
      setTimeout(()=>{window.location.href='./index.html?surface='+encodeURIComponent(returnSurface)},1000);
    }catch(error){message(error?.message||'Password update failed. Please request a new reset link.',true);save.disabled=false;save.textContent='UPDATE PASSWORD';}
  };
}
async function finishRecovery(){
  try{
    const{data:{session}}=await sb.auth.getSession();
    if(session)showRecoveryForm();
  }catch(error){message(error?.message||'Recovery session could not be verified.',true);}
}
const back=document.querySelector('a[href^="./index.html"]');if(back)back.href='./index.html?surface='+encodeURIComponent(returnSurface);
finishRecovery();
send.onclick=async()=>{
  const value=email.value.trim();
  if(!value)return message('Enter your email address.',true);
  send.disabled=true;send.textContent='SENDING…';message('');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(SUPABASE_URL+'/auth/v1/recover',{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({email:value,redirect_to:recoveryUrl}),signal:controller.signal});
    let payload=null;try{payload=await response.json()}catch{}
    if(!response.ok)throw new Error(payload?.msg||payload?.message||'Password reset request failed.');
    message('Reset link sent. Check your email inbox and spam folder.');
  }catch(error){
    message(error?.name==='AbortError'?'Password reset service timed out. Please try again in a moment.':error?.message||'Password reset request failed.',true);
  }finally{clearTimeout(timer);send.disabled=false;send.textContent='SEND RESET LINK';}
};