import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_KEY='sb_publishable_bFbeqpwaWmp0aioDVSkLAg_J7X4lzWk';

const app=document.querySelector('#app');
const status=document.querySelector('#status');

const surface = new URLSearchParams(location.search).get('surface') || 'member';
const gymSlug = (new URLSearchParams(location.search).get('gym') || '').trim().toLowerCase();

function renderBoot(message,error=false){
  status.textContent=message;
  if(error) status.classList.add('error');
}

function renderMember(){
  app.innerHTML='<div class="shell"><div class="top"><div><div class="eyebrow">NEXUS MEMBER</div><div class="title">Your Baithak</div></div><div class="eyebrow">LIVE</div></div><section class="card"><div class="eyebrow">MEMBERSHIP</div><h2 id="memberName">Member</h2><p id="membershipStatus">Loading membership…</p></section><div class="grid"><div class="stat"><b id="attendance">—</b><span>Attendance</span></div><div class="stat"><b id="days">—</b><span>Days left</span></div></div><section class="card"><button id="checkin">CHECK IN</button></section><nav><button class="active">HOME</button><button>PROGRESS</button><button>CHECK-IN</button><button>REFERRAL</button><button>NUTRITION</button></nav></div>';
}

function renderOwner(){
  app.innerHTML='<div class="shell"><div class="top"><div><div class="eyebrow">NEXUS COMMAND</div><div class="title">Owner Console</div></div><div class="eyebrow">SECURE</div></div><section class="card"><div class="eyebrow">GYM</div><h2 id="gymName">Loading…</h2><p id="ownerEmail"></p></section><div class="grid"><div class="stat"><b id="members">—</b><span>Members</span></div><div class="stat"><b id="today">—</b><span>Today</span></div></div><section class="card"><button>ONBOARD ATHLETE</button></section><nav><button class="active">COMMAND</button><button>TITANS</button><button>ATTEND.</button><button>LEDGER</button><button>BROADCAST</button></nav></div>';
}

async function main(){
  const client=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:surface==='owner'?'nexus-v2-owner-auth':'nexus-v2-member-auth',storage:localStorage}});
  window.NEXUS=client;
  const {data:{session},error}=await client.auth.getSession();
  if(error) throw error;
  if(!session){renderBoot(surface==='owner'?'OWNER LOGIN REQUIRED':'MEMBER LOGIN REQUIRED');return;}
  if(surface==='owner') renderOwner(); else renderMember();
  renderBoot('');
}
main().catch(e=>{console.error(e);renderBoot(e?.message||'Application could not start',true)});
