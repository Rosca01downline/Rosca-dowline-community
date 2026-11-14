// Public Supabase configuration. The publishable key is intended for browser use.
// Keep RLS enabled. NEVER put service_role or private API secrets in this file.
const SUPABASE_URL = "https://zdnlwgqodtiieewxzoda.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KgimutZrYi9tI4ixcbaTvA_0KwxihZ7";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
const show = (id, yes=true) => $(id).classList.toggle("hidden", !yes);
const msg = (id, text, error=false) => { $(id).textContent=text; $(id).classList.toggle("error",error); };
const fmt = (n) => `${Number(n||0).toFixed(8)} USDT`;
let currentUser = null, currentProfile = null, currentMember = null;
let miningTicker = null;
let miningDisplayState = null;

function startMiningTicker(serverBalance, bonusActive, bonusUntil, referralCount, savings, commission){
  if(miningTicker) clearInterval(miningTicker);
  const startedAt = Date.now();
  const bonusEnd = bonusUntil ? new Date(bonusUntil).getTime() : 0;
  miningDisplayState = {
    balance: Number(serverBalance || 0),
    startedAt,
    bonusActive: Boolean(bonusActive),
    bonusEnd,
    referralCount: Number(referralCount || 0),
    savings: Number(savings || 0),
    commission: Number(commission || 0)
  };
  const render = () => {
    if(!miningDisplayState) return;
    const now = Date.now();
    const elapsed = Math.max(0, (now - miningDisplayState.startedAt) / 1000);
    const baseGain = elapsed * (0.0055555 / 86400);
    const bonusSeconds = miningDisplayState.bonusActive && miningDisplayState.bonusEnd
      ? Math.max(0, (Math.min(now, miningDisplayState.bonusEnd) - miningDisplayState.startedAt) / 1000)
      : 0;
    const bonusGain = bonusSeconds * (0.088888 * miningDisplayState.referralCount / 86400);
    const liveMining = miningDisplayState.balance + baseGain + bonusGain;
    $("miningBalance").textContent = fmt(liveMining);
    $("totalBalance").textContent = fmt(miningDisplayState.savings + miningDisplayState.commission + liveMining);
    const status = $("miningLiveStatus");
    if(status){
      status.textContent = miningDisplayState.bonusActive && now < miningDisplayState.bonusEnd
        ? "Mining automatique + bonus parrainage · miakatra izao"
        : "Mining automatique · miakatra izao";
    }
  };
  render();
  miningTicker = setInterval(render, 1000);
}

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  show("loginForm",b.dataset.tab==="login"); show("signupForm",b.dataset.tab==="signup"); msg("authMsg","");
}));

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); msg("authMsg","Miditra...");
  const {error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
  if(error) return msg("authMsg",error.message,true);
  await boot();
});
$("signupForm").addEventListener("submit",async e=>{
  e.preventDefault(); msg("authMsg","Mamorona kaonty...");
  const full_name=$("fullName").value.trim();
  const {data,error}=await db.auth.signUp({email:$("signupEmail").value.trim(),password:$("signupPassword").value,options:{data:{full_name,...(new URLSearchParams(window.location.search).get("ref")?{sponsor_id:new URLSearchParams(window.location.search).get("ref")}: {})}}});
  if(error) return msg("authMsg",error.message,true);
  if(data.session){
    await boot();
  } else {
    msg("authMsg","Jereo ny email-nao hanamafisana ny fisoratana anarana. Rehefa voamarina dia midira.");
  }
});
$("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();currentUser=null;show("appView",false);show("authView",true);show("logoutBtn",false);});
$("refreshBtn").addEventListener("click",loadMemberData);
$("challengeCard").addEventListener("click",async()=>{
  show("challengePanel",true);
  await loadChallengeData();
  $("challengePanel").scrollIntoView({behavior:"smooth",block:"start"});
});
$("closeChallengeBtn").addEventListener("click",()=>show("challengePanel",false));
$("holdingsWingsCard").addEventListener("click",async()=>{
  show("holdingsWingsPanel",true);
  await loadHoldingsWingsHistory(currentMember);
  $("holdingsWingsPanel").scrollIntoView({behavior:"smooth",block:"start"});
});
$("closeHoldingsWingsBtn").addEventListener("click",()=>show("holdingsWingsPanel",false));

$("activateMiningBonusBtn").addEventListener("click",async()=>{
  const button=$("activateMiningBonusBtn");
  if(!currentUser || !currentMember || String(currentMember.status).toLowerCase()!=="active") return;
  button.disabled=true;
  msg("miningBonusInfo","Activation du bonus en cours...");
  try{
    const {data,error}=await db.rpc("activate_referral_mining");
    if(error) throw error;
    if(data?.error==="no_active_referrals"){
      msg("miningBonusInfo","Tsy mbola manana filleul ACTIVE ianao. Rehefa misy dia afaka manetsika ny bonus.");
    }else if(data?.error==="bonus_already_active"){
      msg("miningBonusInfo","Efa mandeha ny bonus parrainage-nao. Mbola tsy tapitra ny 24 ora.");
    }else if(data?.success){
      msg("miningBonusInfo","Vo activation! Filleul ACTIVE voaisa: "+Number(data.referral_count||0)+". Miasa mandritra ny 24 ora ny bonus.");
      await loadMemberData();
    }else{
      msg("miningBonusInfo","Tsy nahomby ny activation. Havaozy ny pejy ary andramo indray.",true);
    }
  }catch(error){
    msg("miningBonusInfo","Erreur activation: "+(error?.message||String(error)),true);
  }finally{
    button.disabled=false;
  }
});
$("openDepositBtn").addEventListener("click",()=>{show("transactionForms",true);show("depositPanel",true);show("withdrawPanel",false);show("historyPanel",false);});
$("openWithdrawBtn").addEventListener("click",()=>{show("transactionForms",true);show("depositPanel",false);show("withdrawPanel",true);show("historyPanel",false);});
$("openHistoryBtn").addEventListener("click",()=>{show("transactionForms",false);show("historyPanel",true);});
document.querySelectorAll("[data-close-forms]").forEach(b=>b.addEventListener("click",()=>show("transactionForms",false)));

$("adminRefresh").addEventListener("click",loadAdminData);
$("communityRefresh").addEventListener("click",loadCommunityLists);
$("rolePill").addEventListener("click",()=>{
  const section=document.querySelector(".community-lists");
  if(section){section.scrollIntoView({behavior:"smooth",block:"start"});$("memberRoster").focus?.({preventScroll:true});}
});

async function boot(){
  const {data:{user}}=await db.auth.getUser();
  if(!user){show("authView",true);show("appView",false);show("logoutBtn",false);return;}
  currentUser=user;
  const {data:profile,error:pErr}=await db.from("profiles").select("id,full_name,email,role").eq("id",user.id).single();
  if(pErr){msg("globalMsg","Tsy afaka mamaky profil: "+pErr.message,true);return;}
  currentProfile=profile;
  const {data:member}=await db.from("members").select("id,full_name,phone,status,membership_fee_paid").eq("auth_user_id",user.id).maybeSingle();
  currentMember=member;
  show("authView",false);show("appView",true);show("logoutBtn",true);
  $("welcomeName").textContent=profile.full_name||user.email;
  $("welcomeEmail").textContent=user.email;
  $("rolePill").textContent=profile.role==="admin"?"ADMIN":"MEMBRE";
  show("adminView",profile.role==="admin");
  await loadMemberData();
  await loadCommunityLists();
  if(profile.role==="admin") await loadAdminData();
}

function renderReferralLink(member){
  const panel=$("referralPanel");
  if(!member || member.status!=="active"){show("referralPanel",false);return;}
  const link=new URL(window.location.pathname,window.location.origin);
  link.searchParams.set("ref",member.id);
  $("referralLink").value=link.toString();
  show("referralPanel",true);
}
$("copyReferralBtn").addEventListener("click",async()=>{
  const value=$("referralLink").value;
  try{await navigator.clipboard.writeText(value);$("referralMsg").textContent="Voacopy ilay lien. Azonao zaraina amin’ny namanao izao.";}
  catch(e){$("referralLink").focus();$("referralLink").select();const ok=document.execCommand("copy");$("referralMsg").textContent=ok?"Voacopy ilay lien.":"Tsindrio ela ilay lien dia safidio Copier.";}
});
$("shareReferralBtn").addEventListener("click",async()=>{
  const value=$("referralLink").value;
  if(navigator.share){try{await navigator.share({title:"ROSCA & DOWNLINE COMMUNITY",text:"Midira amin'ny ROSCA amin'ity lien de parrainage ity:",url:value});}catch(e){}}
  else {try{await navigator.clipboard.writeText(value);$("referralMsg").textContent="Voacopy ilay lien; azonao apetaka amin’ny WhatsApp na Messenger."; }catch(e){$("referralLink").focus();$("referralLink").select();$("referralMsg").textContent="Adikao ilay lien dia zarao amin’ny namanao.";}}
});

function configureDepositOptions(member){
  const select=$("depositType");
  const feeAlreadyPaid=member?.membership_fee_paid===true;

  const feeOption=select.querySelector('option[value="membership_fee"]');
  const combinedOption=select.querySelector('option[value="combined"]');
  const contributionOption=select.querySelector('option[value="contribution"]');

  if(feeOption) feeOption.hidden=true;
  if(combinedOption) combinedOption.hidden=feeAlreadyPaid;
  if(contributionOption) contributionOption.hidden=!feeAlreadyPaid;

  select.value=feeAlreadyPaid?"contribution":"combined";

  const amounts={
    contribution:3,
    combined:4
  };

  $("depositAmount").value=amounts[select.value];
}
async function loadHoldingsWingsHistory(member){
  const targets=["holdingsWingsHistory","myHoldingsWingsHistory"];
  if(!member){
    targets.forEach(id=>{ if($(id)) $(id).innerHTML='<p class="muted">Tsy mbola misy angona.</p>'; });
    return;
  }
  const {data,error}=await db.from("holdings_wings_rewards")
    .select("first_month,second_month,third_month,first_rank,second_rank,third_rank,reward_amount,status,awarded_at")
    .eq("member_id",member.id)
    .order("third_month",{ascending:false});
  if(error){
    targets.forEach(id=>{ if($(id)) $(id).innerHTML='<p class="error">Tsy afaka mamaky ny historique HOLDINGS WINGS: '+esc(error.message)+'</p>'; });
    return;
  }
  const rows=(data||[]).map(x=>[
    [x.first_month,x.second_month,x.third_month].map(m=>m?new Date(m+"T12:00:00").toLocaleDateString("fr-FR",{month:"short",year:"numeric"}):"—").join(" → "),
    [x.first_rank,x.second_rank,x.third_rank].map(r=>r?"Top "+r:"—").join(" / "),
    fmt(x.reward_amount),
    String(x.status||"pending").toUpperCase(),
    date(x.awarded_at)
  ]);
  const markup=rows.length
    ? "<table><thead><tr>"+["Volana 3 misesy","Laharana","Valisoa","Sata historique","Daty"].map(h=>"<th>"+esc(h)+"</th>").join("")+"</tr></thead><tbody>"+rows.map(row=>"<tr>"+row.map(v=>"<td>"+esc(String(v??""))+"</td>").join("")+"</tr>").join("")+"</tbody></table>"
    : '<p class="muted">Mbola tsy nahazo HOLDINGS WINGS ianao.</p>';
  targets.forEach(id=>{ if($(id)) $(id).innerHTML=markup; });
}

async function loadMemberData(){
  if(!currentUser)return;
  const {data:member,error:memberError}=await db.from("members").select("id,status,membership_fee_paid").eq("auth_user_id",currentUser.id).maybeSingle();
  if(memberError){msg("globalMsg","Erreur lecture membre: "+memberError.message,true);return;}
  currentMember=member;
  configureDepositOptions(member);
  await loadHoldingsWingsHistory(member);
  if(member)msg("globalMsg","Membre trouvé dans l’application : "+member.status);
  renderReferralLink(member);
  if(member){
    const {data:b}=await db.from("member_balances").select("savings_balance,commission_balance,reserved_savings,reserved_commission").eq("member_id",member.id).maybeSingle();
    const savings=Number(b?.savings_balance||0), commission=Number(b?.commission_balance||0);
    let mining=0;
    show("miningBonusPanel",String(member.status).toLowerCase()==="active");
    if(String(member.status).toLowerCase()==="active"){
      const {data:mine,error:miningError}=await db.rpc("get_my_mining");
      if(miningError){
        msg("miningBonusInfo","Tsy afaka mamaky ny Mining: "+miningError.message,true);
      }else if(mine?.error){
        msg("miningBonusInfo","Mining: "+mine.error,true);
      }else{
        mining=Number(mine?.mining_balance||0);
        startMiningTicker(mining, mine?.bonus_active, mine?.bonus_until, mine?.bonus_referral_count, savings, commission);
        if(mine?.bonus_active && mine?.bonus_until){
          msg("miningBonusInfo","Bonus parrainage mandeha hatramin'ny "+new Date(mine.bonus_until).toLocaleString()+" · Filleul ACTIVE voaisa: "+Number(mine.bonus_referral_count||0));
        }else{
          msg("miningBonusInfo","Base Mining mandeha ho azy. Azonao alefa mandritra ny 24 ora ny bonus raha manana filleul ACTIVE.");
        }
      }
    }else{
      if(miningTicker) clearInterval(miningTicker);
      miningTicker=null; miningDisplayState=null;
      msg("miningBonusInfo","Miandry activation ho ACTIVE ny kaontinao vao manomboka ny Mining.");
    }
    await loadMyReferrals(member);
    $("savings").textContent=fmt(savings);$("commission").textContent=fmt(commission);
    $("miningBalance").textContent=fmt(mining);
    $("totalBalance").textContent=fmt(savings+commission+mining);
    $("reservedSavings").textContent="Voatokana: "+fmt(b?.reserved_savings);
    $("reservedCommission").textContent="Voatokana: "+fmt(b?.reserved_commission);
    const {data:d}=await db.from("deposit_requests").select("amount,status,tx_hash,created_at,admin_note").eq("member_id",member.id).order("created_at",{ascending:false});
    const {data:w}=await db.from("withdrawal_requests").select("amount,status,withdrawal_type,faucetpay_email,faucetpay_tx_id,created_at,admin_note").eq("member_id",member.id).order("created_at",{ascending:false});
    const depositTotal=(d||[]).filter(x=>["approved","completed"].includes(x.status)).reduce((sum,x)=>sum+Number(x.amount||0),0);
    const withdrawalTotal=(w||[]).filter(x=>x.status==="completed").reduce((sum,x)=>sum+Number(x.amount||0),0);
    $("totalDeposits").textContent=fmt(depositTotal);
    $("totalWithdrawals").textContent=fmt(withdrawalTotal);
    renderTable("myDeposits",["Vola","Sata","TxID","Daty","Fanamarihana"],(d||[]).map(x=>[fmt(x.amount),x.status,x.tx_hash||"",date(x.created_at),x.admin_note||""]));
    renderTable("myWithdrawals",["Vola","Karazana","Sata","FaucetPay","Transaction ID","Daty","Fanamarihana"],(w||[]).map(x=>[fmt(x.amount),x.withdrawal_type,x.status,x.faucetpay_email,x.faucetpay_tx_id||"Miandry ID",date(x.created_at),x.admin_note||""]));
  } else {
    if(miningTicker) clearInterval(miningTicker);
    miningTicker=null; miningDisplayState=null;
    $("savings").textContent=fmt(0);$("commission").textContent=fmt(0);
    $("miningBalance").textContent=fmt(0);$("totalBalance").textContent=fmt(0);
    show("miningBonusPanel",false);
    $("totalDeposits").textContent=fmt(0);$("totalWithdrawals").textContent=fmt(0);
    renderTable("myDeposits",["Dépôt"],[]);renderTable("myWithdrawals",["Retrait"],[]);
    msg("globalMsg","Tsy mbola mifandray amin'ny kaonty membre ny profil. Mifandraisa amin'ny Admin.",true);
  }
}
async function loadChallengeData(){
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  $("challengeMonthLabel").textContent = "Volana: " + now.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  $("challengeLeaderboard").innerHTML='<p class="muted">Ampidirina...</p>';
  $("challengeWinners").innerHTML='<p class="muted">Ampidirina...</p>';

  const [{data:ranking,error:rankingError},{data:winners,error:winnersError}] = await Promise.all([
    db.rpc("get_monthly_challenge_leaderboard",{p_month:monthStart}),
    db.from("monthly_challenge_results")
      .select("challenge_month,winner_name,rank,qualifying_referrals,prize_amount")
      .order("challenge_month",{ascending:false})
      .order("rank",{ascending:true})
      .limit(3)
  ]);

  if(rankingError){
    $("challengeLeaderboard").innerHTML='<p class="error">Tsy afaka mamaky ny classement: '+esc(rankingError.message)+'</p>';
  }else{
    const rows=(ranking||[]).map(x=>[
      x.challenge_rank,
      x.full_name||"—",
      Number(x.qualifying_referrals||0),
      Number(x.total_active_referrals||0),
      x.eligible?"ÉLIGIBLE":"Tsy mbola eligible"
    ]);
    renderTable("challengeLeaderboard",["Laharana","Anarana","Filleuls ACTIVE tamin’ity volana ity","Total ACTIVE","Sata"],rows);
  }

  if(winnersError){
    $("challengeWinners").innerHTML='<p class="error">Tsy afaka mamaky ny mpandresy: '+esc(winnersError.message)+'</p>';
  }else{
    const rows=(winners||[]).map(x=>[
      new Date(x.challenge_month+"T12:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}),
      x.rank,
      x.winner_name,
      Number(x.qualifying_referrals||0),
      fmt(x.prize_amount)+" · Commission"
    ]);
    renderTable("challengeWinners",["Volana","Laharana","Anarana","Filleuls","Loka"],rows);
  }
}

async function loadMyReferrals(member){
  const panel=$("myReferralsPanel");
  if(!member || String(member.status).toLowerCase()!=="active"){
    show("myReferralsPanel",false);
    return;
  }
  show("myReferralsPanel",true);
  $("myReferralsList").innerHTML='<p class="muted">Ampidirina...</p>';
  const {data:referrals,error}=await db.rpc("get_my_referrals");
  if(error){
    $("myReferralsList").innerHTML='<p class="error">Tsy afaka mamaky ny filleuls: '+esc(error.message)+'</p>';
    $("myReferralsCounts").textContent="";
    return;
  }
  const rows=referrals||[];
  const active=rows.filter(x=>String(x.member_status).toLowerCase()==="active").length;
  const pending=rows.filter(x=>String(x.member_status).toLowerCase()==="pending").length;
  $("myReferralsCounts").textContent="Total: "+rows.length+" · ACTIVE: "+active+" · PENDING: "+pending;
  renderTable("myReferralsList",["Anarana","Sata","Daty nisoratana"],rows.map(x=>[
    x.full_name||"—",
    String(x.member_status||"").toUpperCase(),
    date(x.joined_at)
  ]));
}
async function loadCommunityLists(){
  const rosterEl=$("memberRoster"),turnEl=$("publicTurnList");
  rosterEl.innerHTML='<p class="muted">Ampidirina...</p>';
  turnEl.innerHTML='<p class="muted">Ampidirina...</p>';
  const [{data:roster,error:rosterError},{data:turns,error:turnError}]=await Promise.all([
    db.rpc("get_member_roster"),
    db.rpc("get_public_turn_list")
  ]);
  if(rosterError) rosterEl.innerHTML='<p class="error">Tsy afaka mamaky ny lisitry ny mpikambana: '+esc(rosterError.message)+'</p>';
  else {
    renderTable("memberRoster",["Laharana","Anarana","Sata","Daty nidirana"],(roster||[]).map(x=>[x.member_number,x.full_name,x.member_status,date(x.joined_at)]));
    if(currentProfile?.role!=="admin" && currentMember){
      const myName=currentMember.full_name||currentProfile?.full_name||"";
      const myIndex=(roster||[]).findIndex(x=>String(x.full_name||"").trim().toLowerCase()===String(myName).trim().toLowerCase());
      if(myIndex>=0){
        const myNumber=roster[myIndex].member_number||myIndex+1;
        $("rolePill").textContent=String(myNumber)+"/"+String(roster.length);
      } else {
        $("rolePill").textContent="MEMBRE";
      }
    }
  }
  if(turnError) turnEl.innerHTML='<p class="error">Tsy afaka mamaky ny lisitry ny tours: '+esc(turnError.message)+'</p>';
  else renderTable("publicTurnList",["Tour","Daty","Mpandray","Sata"],(turns||[]).map(x=>[x.turn_number,dateOnly(x.scheduled_date),x.receiver_name,x.turn_status]));
}
function dateOnly(s){
  if(!s)return "";
  const parts=String(s).split("-");
  return parts.length===3?new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2])).toLocaleDateString():String(s);
}
function date(s){return s?new Date(s).toLocaleString():"";}
function renderTable(target,heads,rows){
  const el=$(target); if(!rows.length){el.innerHTML='<p class="muted">Tsy mbola misy angona.</p>';return;}
  el.innerHTML="<table><thead><tr>"+heads.map(h=>`<th>${esc(h)}</th>`).join("")+"</tr></thead><tbody>"+rows.map(r=>"<tr>"+r.map(v=>`<td>${esc(String(v??""))}</td>`).join("")+"</tr>").join("")+"</tbody></table>";
}
function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

$("depositType").addEventListener("change",()=>{
  const amounts={membership_fee:1,contribution:3,combined:4};
  $("depositAmount").value=amounts[$("depositType").value];
});
const depositMessage=(text,error=false)=>{
  msg("depositMsg",text,error);
  msg("globalMsg",text,error);
};
$("depositForm").querySelector('button[type="submit"]').addEventListener("click",()=>{
  depositMessage("Voatsindry ny bokotra. Jerena ny formulaire...");
});
$("depositForm").addEventListener("invalid",()=>{
  depositMessage("Misy saha tsy feno na tsy mety ny format. Hamarino ny email sy TxID.",true);
},true);
$("depositForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const button=form.querySelector('button[type="submit"]');
  if(!currentUser){
    depositMessage("Tsy hita ny session-nao. Mivoaha (Déconnexion), dia midira indray vao mandefa dépôt.",true);
    return;
  }
  if(!form.reportValidity()) return;
  if(button) button.disabled=true;
  depositMessage("Alefa any amin'ny serveur ny fangatahana dépôt...");
  try{
    const {data,error}=await db.rpc("submit_deposit_request",{
      p_amount:Number($("depositAmount").value),
      p_faucetpay_email:$("depositEmail").value.trim(),
      p_tx_hash:$("depositTx").value.trim(),
      p_payment_type:$("depositType").value
    });
    if(error) throw error;
    form.reset();
    configureDepositOptions(currentMember);
    depositMessage("Voaray ny fangatahana dépôt. Mbola miandry fanamarinana.");
    await loadMemberData();
  }catch(error){
    depositMessage("Tsy tafiditra ny fangatahana dépôt: "+(error?.message||String(error)),true);
  }finally{
    if(button) button.disabled=false;
  }
});
$("withdrawForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!currentUser)return;
  msg("globalMsg","Alefa ny fangatahana retrait...");
  const {data,error}=await db.rpc("submit_withdrawal_request",{p_amount:Number($("withdrawAmount").value),p_faucetpay_email:$("withdrawEmail").value.trim(),p_withdrawal_type:$("withdrawType").value});
  if(error)return msg("globalMsg",error.message,true);
  e.target.reset();msg("globalMsg","Voaray ny fangatahana retrait. Ny vola dia voatokana mandra-pitsarana.");
  await loadMemberData();
});

async function loadAdminData(){
  const {data:d,error:de}=await db.from("deposit_requests").select("id,member_id,amount,payment_type,status,tx_hash,faucetpay_email,created_at").order("created_at",{ascending:false});
  if(de){msg("globalMsg","Dépôt admin: "+de.message,true);return;}
  $("adminDeposits").innerHTML=tableWithActions(["Vola","Karazana","Sata","TxID","Email FaucetPay","Daty"],(d||[]).map(x=>({id:x.id,status:x.status,values:[fmt(x.amount),x.payment_type,x.status,x.tx_hash||"",x.faucetpay_email,date(x.created_at)]})), "deposit");
  const {data:w,error:we}=await db.from("withdrawal_requests").select("id,member_id,amount,status,withdrawal_type,faucetpay_email,faucetpay_tx_id,created_at").order("created_at",{ascending:false});
  if(we){msg("globalMsg","Retrait admin: "+we.message,true);return;}
  $("adminWithdrawals").innerHTML=tableWithActions(["Vola","Karazana","Sata","Email FaucetPay","Transaction ID","Daty"],(w||[]).map(x=>({id:x.id,status:x.status,values:[fmt(x.amount),x.withdrawal_type,x.status,x.faucetpay_email,x.faucetpay_tx_id||"—",date(x.created_at)]})),"withdrawal");
  const {data:m,error:me}=await db.from("members").select("id,full_name,phone,status,created_at").order("created_at",{ascending:false});
  if(me){msg("globalMsg","Membre admin: "+me.message,true);return;}
  renderMemberTable(m||[]);
}
function renderMemberTable(members){
  const el=$("adminMembers");
  if(!members.length){el.innerHTML='<p class="muted">Tsy mbola misy mpikambana.</p>';return;}
  el.innerHTML="<table><thead><tr><th>Anarana</th><th>Finday</th><th>Sata / Action</th><th>Daty</th></tr></thead><tbody>"+
    members.map(x=>`<tr><td>${esc(x.full_name||"")}</td><td>${esc(x.phone||"")}</td><td><span>${esc(x.status||"")}</span> ${x.status==="pending"?`<button class="action" data-action="activate-member" data-type="member" data-id="${x.id}">Activer</button>`:"—"}</td><td>${esc(date(x.created_at))}</td></tr>`).join("")+
    "</tbody></table>";
}
function tableWithActions(heads,rows,type){
  if(!rows.length)return '<p class="muted">Tsy mbola misy fangatahana.</p>';
  return "<table><thead><tr>"+heads.map(h=>`<th>${esc(h)}</th>`).join("")+"<th>Action</th></tr></thead><tbody>"+rows.map(r=>`<tr>${r.values.map(v=>`<td>${esc(String(v??""))}</td>`).join("")}<td>${r.status==="pending"?`<button class="action" data-action="approve" data-type="${type}" data-id="${r.id}">Ekena</button><button class="action reject" data-action="reject" data-type="${type}" data-id="${r.id}">Lavina</button>`:type==="withdrawal"&&r.status==="approved"?`<button class="action" data-action="complete-withdrawal" data-type="${type}" data-id="${r.id}">MARQUER COMME PAYÉ</button>`:"—"}</td></tr>`).join("")+"</tbody></table>";
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("button[data-action]");if(!b)return;
  const decision=b.dataset.action;const type=b.dataset.type;const id=b.dataset.id;
  if(decision==="activate-member"){
    if(!confirm("Hampavitrika ity mpikambana ity ve?"))return;
    b.disabled=true;
    const {data,error}=await db.rpc("admin_activate_member",{p_member_id:id});
    if(error){msg("globalMsg",error.message,true);b.disabled=false;return;}
    if(data!==true){msg("globalMsg","Tsy niova ny sata. Mety efa active ilay mpikambana na tsy pending intsony.",true);}
    else {msg("globalMsg","Voavitrika soa aman-tsara ny mpikambana.");}
    await loadAdminData();
    return;
  }
  if(decision==="complete-withdrawal"){
    if(type!=="withdrawal")return;
    if(!confirm("Efa nalefanao tamin’ny FaucetPay ve ny vola? Tsindrio OK raha efa vita tokoa ny transfert. Ity hetsika ity no hanala ny vola amin’ny solde."))return;
    const txid=prompt("OBLIGATOIRE: Ampidiro ny FaucetPay Transaction ID:");
    if(txid===null)return;
    if(!txid.trim()){alert("Tsy maintsy ampidirina ny FaucetPay Transaction ID vao afaka mamita retrait.");return;}
    b.disabled=true;
    const {error}=await db.rpc("finalize_withdrawal_request",{p_request_id:id,p_faucetpay_tx_id:txid.trim()});
    if(error){msg("globalMsg",error.message,true);b.disabled=false;return;}
    msg("globalMsg","Retrait voamarika ho completed; voava ny solde sy ny réservation.");
    await loadAdminData();await loadMemberData();
    return;
  }
  let note="";
  if(decision==="reject"){note=prompt("Antony handavana (tsy maintsy fenoina):")||"";if(!note.trim())return alert("Ilaina ny antony.");}
  else if(!confirm("Hanova ny sata ho approved ve? Tsy midika izany fa voamarina na nalefa ny vola."))return;
  const rpc=type==="deposit"?"review_deposit_request":"review_withdrawal_request";
  const {error}=await db.rpc(rpc,{p_request_id:id,p_decision:decision==="approve"?"approved":"rejected",p_admin_note:note||null});
  if(error){msg("globalMsg",error.message,true);return;}
  msg("globalMsg","Voavaova ny sata fangatahana.");await loadAdminData();await loadMemberData();
});

db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){show("appView",false);show("authView",true);show("logoutBtn",false);} });
boot();

if ("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
