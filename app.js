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


let currentLudoRoomId = null;
let ludoChatChannel = null;
let ludoChatChannelRoomId = null;
let ludoRoomMembers = [];
let ludoGameSnapshot = null;
let ludoBoardBusy = false;

const LUDO_TRACK = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],
  [7,0],[6,0],[5,0],[4,0]
];
const LUDO_HOME_LANES = {
  1:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  2:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  3:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  4:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
};
const LUDO_YARDS = {
  1:[[2,2],[2,4],[4,2],[4,4]],
  2:[[2,10],[2,12],[4,10],[4,12]],
  3:[[10,10],[10,12],[12,10],[12,12]],
  4:[[10,2],[10,4],[12,2],[12,4]]
};
const LUDO_COLORS = {1:"red",2:"green",3:"yellow",4:"blue"};

function ludoCoord(seat,pos,index){
  if(pos===-1) return LUDO_YARDS[seat]?.[index] || [7,7];
  if(pos>=52) return LUDO_HOME_LANES[seat]?.[Math.min(5,pos-52)] || [7,7];
  return LUDO_TRACK[((seat-1)*13+pos)%52] || [7,7];
}
function renderLudoBoard(snapshot){
  const board=$("ludoBoard");
  if(!board) return;
  if(!snapshot?.state){
    board.innerHTML='<p class="muted ludo-board-empty">Miandry ny hanombohan’ny lalao...</p>';
    $("ludoDiceValue").textContent="–";
    $("ludoTurnInfo").textContent=snapshot?.status==="waiting"?"Miandry mpilalao":"Tsy misy lalao";
    $("ludoRollBtn").disabled=true;
    return;
  }
  const state=snapshot.state;
  const players=snapshot.players||[];
  const ownSeat=players.find(p=>p.member_id===currentMember?.id)?.seat_number;
  const myTurn=Number(state.current_turn_seat)===Number(ownSeat);
  const cells=[];
  const safeTrack=[0,8,13,21,26,34,39,47];
  for(let r=0;r<15;r++) for(let c=0;c<15;c++){
    let base="";
    if(r<6&&c<6) base="yard-red";
    else if(r<6&&c>8) base="yard-green";
    else if(r>8&&c>8) base="yard-yellow";
    else if(r>8&&c<6) base="yard-blue";
    const inYard=(r<6&&c<6)||(r<6&&c>8)||(r>8&&c>8)||(r>8&&c<6);
    const innerYard=inYard&&((r>=1&&r<=4&&(c<=4||c>=10))||(c>=1&&c<=4&&(r>=10&&r<=13))||(c>=10&&c<=13&&(r>=10&&r<=13)));
    const trackIndex=LUDO_TRACK.findIndex(([rr,cc])=>rr===r&&cc===c);
    const laneSeat=Object.entries(LUDO_HOME_LANES).find(([s,coords])=>coords.some(([rr,cc])=>rr===r&&cc===c))?.[0];
    let cls="ludo-cell "+base;
    if(innerYard) cls+=" yard-inner";
    if(trackIndex>=0) cls+=" track"+(safeTrack.includes(trackIndex)?" safe":"");
    if(laneSeat) cls+=" lane lane-"+laneSeat;
    if(r===6&&c===1) cls+=" start-red";
    if(r===1&&c===8) cls+=" start-green";
    if(r===8&&c===13) cls+=" start-yellow";
    if(r===13&&c===6) cls+=" start-blue";
    cells.push('<div class="'+cls+'"></div>');
  }
  const homes='<div class="ludo-home home-red"><i></i><i></i><i></i><i></i></div>'+
    '<div class="ludo-home home-green"><i></i><i></i><i></i><i></i></div>'+
    '<div class="ludo-home home-yellow"><i></i><i></i><i></i><i></i></div>'+
    '<div class="ludo-home home-blue"><i></i><i></i><i></i><i></i></div>';
  board.innerHTML=cells.join("")+homes+'<div class="ludo-center" aria-hidden="true"><span class="center-red"></span><span class="center-green"></span><span class="center-yellow"></span><span class="center-blue"></span></div>';
  players.forEach(player=>{
    const seat=Number(player.seat_number);
    const positions=state.pawns?.[String(seat)]?.pawns||[-1,-1,-1,-1];
    positions.forEach((pos,index)=>{
      const [r,c]=ludoCoord(seat,Number(pos),index);
      const pawn=document.createElement("button");
      pawn.type="button";
      pawn.className="ludo-pawn "+(LUDO_COLORS[seat]||"red");
      pawn.setAttribute("aria-label","Pion "+(index+1)+" de "+(player.full_name||("Seat "+seat)));
      const pawnGradients={1:["#ff9a9e","#ed1c2b","#8f0712"],2:["#a7f3b0","#08a84a","#075c2c"],3:["#fff39a","#ffd51b","#a87800"],4:["#8de2ff","#159bd7","#07518a"]};
      const pg=pawnGradients[seat]||pawnGradients[1];
      const gid="pawn-gradient-"+seat+"-"+index;
      pawn.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+pg[0]+'"/><stop offset=".48" stop-color="'+pg[1]+'"/><stop offset="1" stop-color="'+pg[2]+'"/></linearGradient></defs><ellipse cx="50" cy="85" rx="31" ry="10" fill="'+pg[2]+'" opacity=".55"/><path class="pawn-shape" fill="url(#'+gid+')" d="M50 5C32 5 21 19 23 35c1 11 8 19 19 23L13 80c-5 7 0 15 9 15h56c9 0 14-8 9-15L58 58c11-4 18-12 19-23C79 19 68 5 50 5Z"/><ellipse cx="50" cy="29" rx="17" ry="19" fill="white" opacity=".18"/><path d="M35 17c-6 8-5 19 1 25" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/><path d="M25 79h50" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/></svg>';
      pawn.style.gridRow=String(r+1);
      pawn.style.gridColumn=String(c+1);
      pawn.title=(player.full_name||("Seat "+seat))+" · pion "+(index+1)+" · position "+pos;
      pawn.dataset.pawnIndex=String(index);
      pawn.dataset.seat=String(seat);
      pawn.disabled=!myTurn||!state.dice_rolled||ludoBoardBusy;
      pawn.addEventListener("click",()=>moveLudoPawn(index));
      board.appendChild(pawn);
    });
  });
  $("ludoDiceValue").textContent=state.dice_value==null?"–":String(state.dice_value);
  const active=players.find(p=>Number(p.seat_number)===Number(state.current_turn_seat));
  $("ludoTurnInfo").textContent="Tour: "+(active?.full_name||(active?.is_bot?"BOT":"Seat "+state.current_turn_seat))+(myTurn?" — ANJARANAO":" — Miandry");
  $("ludoRollBtn").disabled=!myTurn||Boolean(state.dice_rolled)||ludoBoardBusy||snapshot.status!=="playing";
}
async function loadLudoGameState(){
  if(!currentLudoRoomId) { renderLudoBoard(null); return; }
  try{
    const {data,error}=await db.rpc("get_ludo_game_state",{p_room_id:currentLudoRoomId});
    if(error) throw error;
    ludoGameSnapshot=data;
    renderLudoBoard(data);
  }catch(error){
    $("ludoBoard").innerHTML='<p class="error ludo-board-empty">Tsy afaka mamaky ny lalao: '+esc(error?.message||String(error))+'</p>';
  }
}
async function rollLudoDice(){
  if(!currentLudoRoomId||ludoBoardBusy) return;
  ludoBoardBusy=true;
  $("ludoRollBtn").disabled=true;
  if(ludoGameSnapshot) renderLudoBoard(ludoGameSnapshot);
  try{
    const {data,error}=await db.rpc("roll_ludo_dice",{p_room_id:currentLudoRoomId});
    if(error) throw error;
    await loadLudoGameState();
    const state=ludoGameSnapshot?.state;
    if(state&&!state.dice_rolled){
      msg("ludoSocialMsg","Nahazo "+data+" ny dés, saingy tsy misy pion azo afindra. Nifindra ho azy ny tour.");
    }else{
      msg("ludoSocialMsg","Nahazo "+data+" tamin'ny dés. Safidio ny pion hafindra.");
    }
  }catch(error){
    msg("ludoSocialMsg","Erreur dés: "+(error?.message||String(error)),true);
  }finally{
    ludoBoardBusy=false;
    if(ludoGameSnapshot) renderLudoBoard(ludoGameSnapshot);
  }
}
async function moveLudoPawn(index){
  if(!currentLudoRoomId||ludoBoardBusy) return;
  ludoBoardBusy=true;
  if(ludoGameSnapshot) renderLudoBoard(ludoGameSnapshot);
  try{
    const {data,error}=await db.rpc("move_ludo_pawn",{p_room_id:currentLudoRoomId,p_pawn_index:index});
    if(error) throw error;
    msg("ludoSocialMsg",data?.winner?"🎉 Nandresy ianao!":("Pion nafindra. Voasambotra: "+Number(data?.captured_count||0)+". "+(data?.extra_turn?"Mahazo tour fanampiny ianao!":"")));
    await loadLudoGameState();
  }catch(error){
    msg("ludoSocialMsg","Tsy afaka mamindra pion: "+(error?.message||String(error)),true);
  }finally{
    ludoBoardBusy=false;
    if(ludoGameSnapshot) renderLudoBoard(ludoGameSnapshot);
  }
}
$("ludoRollBtn").addEventListener("click",rollLudoDice);


async function initializeLudoVirtualBalance(){
  if(!currentMember?.id || String(currentMember.status).toLowerCase()!=="active"){
    throw new Error("Mpikambana ACTIVE ihany no mahazo bonus Ludo.");
  }
  const {data,error}=await db.rpc("initialize_ludo_virtual_balance");
  if(error) throw error;
  const balance=Number(data||0);
  msg("ludoSocialMsg","Solde Ludo virtuel: "+balance.toLocaleString("fr-FR")+" SC. Bonus 5 000 SC indray mandeha ihany.");
  return balance;
}

$("ludoRefreshBtn").addEventListener("click", loadLudoRooms);
$("ludoCreateRoomBtn").addEventListener("click", async () => {
  const button=$("ludoCreateRoomBtn");
  if(!currentMember?.id || String(currentMember.status).toLowerCase()!=="active"){
    msg("ludoSocialMsg","Kaonty ACTIVE ihany no afaka mamorona room.",true); return;
  }
  button.disabled=true;
  msg("ludoSocialMsg","Mamorona room...");
  try{
    const {data,error}=await db.rpc("create_ludo_room",{
      p_game_mode:$("ludoGameMode").value,
      p_player_count:Number($("ludoPlayerCount").value)
    });
    if(error) throw error;
    currentLudoRoomId=data;
    await initializeLudoVirtualBalance();
    msg("ludoSocialMsg","Voaforona ny room! Solde Ludo virtuel voamarina.");
    await loadLudoRooms();
    $("ludoRoomSelect").value=data;
    await loadLudoRoomMembers();
    await loadLudoChat();
  }catch(error){
    msg("ludoSocialMsg","Tsy nahomby ny famoronana room: "+(error?.message||String(error)),true);
  }finally{button.disabled=false;}
});
$("ludoJoinRoomBtn").addEventListener("click", async () => {
  const roomId=$("ludoOpenRoomSelect").value;
  const button=$("ludoJoinRoomBtn");
  if(!roomId){msg("ludoSocialMsg","Safidio aloha ny room ONLINE.",true);return;}
  button.disabled=true;
  msg("ludoSocialMsg","Miditra ao amin'ny room...");
  try{
    const {data,error}=await db.rpc("join_ludo_room",{p_room_id:roomId});
    if(error) throw error;
    currentLudoRoomId=data;
    await initializeLudoVirtualBalance();
    msg("ludoSocialMsg","Tafiditra soa aman-tsara ao amin'ny room! Solde Ludo virtuel voamarina.");
    await loadLudoRooms();
    $("ludoRoomSelect").value=data;
    await loadLudoRoomMembers();
    await loadLudoChat();
  }catch(error){
    msg("ludoSocialMsg","Tsy tafiditra ao amin'ny room: "+(error?.message||String(error)),true);
    await loadLudoRooms();
  }finally{button.disabled=false;}
});
$("ludoRoomSelect").addEventListener("change", async e => {
  currentLudoRoomId = e.target.value || null;
  if(currentLudoRoomId){
    try{ await initializeLudoVirtualBalance(); }
    catch(error){ msg("ludoSocialMsg","Tsy afaka nanamarina ny solde Ludo: "+(error?.message||String(error)),true); }
  }
  await loadLudoRoomMembers();
  await loadLudoChat();
});
$("ludoChatForm").addEventListener("submit", async e => {
  e.preventDefault();
  const content=$("ludoChatInput").value.trim();
  if(!currentLudoRoomId || !content) return;
  const button=e.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true;
  msg("ludoSocialMsg","Alefa ny hafatra...");
  try{
    const {error}=await db.rpc("send_ludo_chat_message",{
      p_room_id:currentLudoRoomId,
      p_message_type:"text",
      p_content:content,
      p_audio_path:null,
      p_recipient_member_id:null
    });
    if(error) throw error;
    $("ludoChatInput").value="";
    msg("ludoSocialMsg","Voaray ny hafatra.");
    await loadLudoChat();
  }catch(error){
    msg("ludoSocialMsg","Tsy tafavoaka ny hafatra: "+(error?.message||String(error)),true);
  }finally{button.disabled=false;}
});
$("ludoSendGiftBtn").addEventListener("click", async () => {
  const recipient=$("ludoGiftRecipient").value;
  const gift=$("ludoGiftCode").value;
  if(!currentLudoRoomId || !recipient || !gift){
    msg("ludoSocialMsg","Safidio aloha ny room, ny mpandray ary ny cadeau.",true);
    return;
  }
  const button=$("ludoSendGiftBtn");
  button.disabled=true;
  msg("ludoSocialMsg","Alefa ny cadeau...");
  try{
    const {error}=await db.rpc("send_ludo_visual_gift",{
      p_room_id:currentLudoRoomId,
      p_recipient_member_id:recipient,
      p_gift_code:gift
    });
    if(error) throw error;
    msg("ludoSocialMsg","Voaray ny cadeau visuel! Tsy nisy SC nafindra.");
    await loadLudoChat();
  }catch(error){
    msg("ludoSocialMsg","Tsy tafavoaka ny cadeau: "+(error?.message||String(error)),true);
  }finally{button.disabled=false;}
});

let ludoJoinedRoomCache = [];
let ludoOpenRoomCache = [];
function renderLudoRoomOptions(){
  const term=String($("ludoRoomSearch")?.value||"").trim().toLowerCase();
  const select=$("ludoRoomSelect");
  const openSelect=$("ludoOpenRoomSelect");
  const matches=r=>{
    const id=String(r.id||"").toLowerCase();
    const shortId=id.slice(0,8);
    return !term || id.includes(term) || shortId.includes(term) ||
      String(r.game_mode||"").toLowerCase().includes(term) ||
      String(r.status||"").toLowerCase().includes(term) ||
      String(r.search_names||"").toLowerCase().includes(term);
  };
  const joined=ludoJoinedRoomCache.filter(matches);
  const open=ludoOpenRoomCache.filter(matches);
  select.innerHTML='<option value="">Safidio ny room efa nidiranao ('+joined.length+')</option>'+joined.map(r=>
    '<option value="'+esc(r.id)+'">Room '+esc(String(r.id).slice(0,8))+' · '+esc(r.game_mode)+' · '+esc(r.status)+'</option>'
  ).join("");
  openSelect.innerHTML='<option value="">Safidio ny room ONLINE misokatra ('+open.length+')</option>'+open.map(r=>
    '<option value="'+esc(r.id)+'">Room '+esc(String(r.id).slice(0,8))+' · '+r.player_count+' joueurs · miandry</option>'
  ).join("");
  if(term && !joined.length && !open.length){
    msg("ludoRoomStatus","Tsy nahitana room mifanaraka amin'ny recherche: "+esc(term));
  }
}
async function loadLudoRooms(){
  const select=$("ludoRoomSelect");
  const openSelect=$("ludoOpenRoomSelect");
  select.innerHTML='<option value="">Mitady room...</option>';
  openSelect.innerHTML='<option value="">Mitady room...</option>';
  $("ludoChatFeed").innerHTML='<p class="muted">Ampidirina...</p>';
  if(!currentMember?.id){
    select.innerHTML='<option value="">Tsy mbola misy profil membre</option>';
    openSelect.innerHTML='<option value="">Tsy mbola misy profil membre</option>';
    msg("ludoRoomStatus","Mila kaonty membre ianao vao afaka miditra amin'ny chat.",true);
    return;
  }
  try{
    const [{data:joined,error:joinedError},{data:openRooms,error:openError}]=await Promise.all([
      db.from("ludo_room_players").select("room_id").eq("member_id",currentMember.id),
      db.from("ludo_rooms").select("id,game_mode,player_count,status,created_at")
        .eq("game_mode","online").eq("status","waiting")
        .order("created_at",{ascending:false}).limit(100)
    ]);
    if(joinedError) throw joinedError;
    if(openError) throw openError;
    const ids=[...new Set((joined||[]).map(x=>x.room_id).filter(Boolean))];
    const {data:rooms,error:roomError}=ids.length
      ? await db.from("ludo_rooms").select("id,game_mode,player_count,status,created_at")
          .in("id",ids).in("status",["waiting","playing"]).order("created_at",{ascending:false})
      : {data:[],error:null};
    if(roomError) throw roomError;
    ludoJoinedRoomCache=rooms||[];
    ludoOpenRoomCache=(openRooms||[]).filter(r=>!ids.includes(r.id));
    const searchableRoomIds=[...new Set([...ludoJoinedRoomCache,...ludoOpenRoomCache].map(r=>r.id))];
    if(searchableRoomIds.length){
      const {data:roomPlayers,error:playersError}=await db.from("ludo_room_players")
        .select("room_id,member_id").in("room_id",searchableRoomIds);
      if(playersError) throw playersError;
      const memberIds=[...new Set((roomPlayers||[]).map(p=>p.member_id).filter(Boolean))];
      let memberNames=[];
      if(memberIds.length){
        const {data:names,error:namesError}=await db.from("members").select("id,full_name").in("id",memberIds);
        if(namesError) throw namesError;
        memberNames=names||[];
      }
      const namesById=new Map(memberNames.map(m=>[m.id,m.full_name||""]));
      const namesByRoom=new Map();
      (roomPlayers||[]).forEach(p=>{
        if(!p.member_id) return;
        const list=namesByRoom.get(p.room_id)||[];
        const name=namesById.get(p.member_id);
        if(name) list.push(name);
        namesByRoom.set(p.room_id,list);
      });
      [...ludoJoinedRoomCache,...ludoOpenRoomCache].forEach(room=>{
        room.search_names=(namesByRoom.get(room.id)||[]).join(" ");
      });
    }
    renderLudoRoomOptions();
    if(currentLudoRoomId && ludoJoinedRoomCache.some(r=>r.id===currentLudoRoomId)){
      select.value=currentLudoRoomId;
      await loadLudoRoomMembers();
      await loadLudoChat();
    }else{
      currentLudoRoomId=null;
      msg("ludoRoomStatus","Mitadiava room amin'ny code/ID, na safidio amin'ny lisitra.");
      $("ludoChatFeed").innerHTML='<p class="muted">Tsy mbola nisafidy room ianao.</p>';
      $("ludoGiftRecipient").innerHTML='<option value="">Tsy misy mpandray</option>';
    }
  }catch(error){
    select.innerHTML='<option value="">Tsy afaka mamaky room</option>';
    openSelect.innerHTML='<option value="">Tsy afaka mamaky room</option>';
    msg("ludoRoomStatus","Erreur room: "+(error?.message||String(error)),true);
  }
}
$("ludoRoomSearch").addEventListener("input",renderLudoRoomOptions);
async function loadLudoRoomMembers(){
  const target=$("ludoGiftRecipient");
  target.innerHTML='<option value="">Ampidirina...</option>';
  if(!currentLudoRoomId) return;
  try{
    const {data:members,error}=await db.rpc("get_ludo_room_members",{
      p_room_id:currentLudoRoomId
    });
    if(error) throw error;
    ludoRoomMembers=members||[];
    target.innerHTML='<option value="">Safidio ny mpandray</option>'+ludoRoomMembers
      .filter(m=>m.id!==currentMember?.id)
      .map(m=>'<option value="'+esc(m.id)+'">'+esc(m.full_name||"Membre")+'</option>').join("");
    const debugNames=ludoRoomMembers.map(m=>m.full_name||"Membre").join(", ");
    msg("ludoRoomStatus","Room voafidy. Mpikambana hitan'ny navigateur: "+ludoRoomMembers.length+(debugNames?" — "+debugNames:" — Tsy nisy anarana naverin'ny RPC."));
  }catch(error){
    ludoRoomMembers=[];
    target.innerHTML='<option value="">Tsy afaka mamaky mpilalao</option>';
    msg("ludoRoomStatus","Erreur mpilalao: "+(error?.message||String(error)),true);
  }
}
async function loadLudoChat(){
  const feed=$("ludoChatFeed");
  if(!currentLudoRoomId){
    if(ludoChatChannel){await db.removeChannel(ludoChatChannel);ludoChatChannel=null;ludoChatChannelRoomId=null;}
    feed.innerHTML='<p class="muted">Safidio aloha ny room.</p>';return;
  }
  if(ludoChatChannelRoomId!==currentLudoRoomId){
    if(ludoChatChannel) await db.removeChannel(ludoChatChannel);
    const roomId=currentLudoRoomId;
    ludoChatChannel=db.channel("ludo-chat-"+roomId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"ludo_chat_messages",filter:"room_id=eq."+roomId},()=>{if(currentLudoRoomId===roomId) loadLudoChat();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"ludo_chat_gift_events",filter:"room_id=eq."+roomId},()=>{if(currentLudoRoomId===roomId) loadLudoChat();})
      .subscribe();
    ludoChatChannelRoomId=roomId;
  }
  feed.innerHTML='<p class="muted">Ampidirina ny chat...</p>';
  try{
    await loadLudoRoomMembers();
    const [{data:messages,error:messageError},{data:gifts,error:giftError},{data:catalog,error:catalogError}]=await Promise.all([
      db.from("ludo_chat_messages").select("id,sender_member_id,message_type,content,created_at")
        .eq("room_id",currentLudoRoomId).order("created_at",{ascending:true}).limit(100),
      db.from("ludo_chat_gift_events").select("id,sender_member_id,recipient_member_id,gift_code,created_at")
        .eq("room_id",currentLudoRoomId).order("created_at",{ascending:true}).limit(100),
      db.from("ludo_gift_catalog").select("gift_code,gift_name,price_sc").eq("active",true)
    ]);
    if(messageError) throw messageError;
    if(giftError) throw giftError;
    if(catalogError) throw catalogError;
    const names=new Map((ludoRoomMembers||[]).map(m=>[m.id,m.full_name||"Membre"]));
    const items=[
      ...(messages||[]).map(x=>({...x,kind:"message"})),
      ...(gifts||[]).map(x=>({...x,kind:"gift"}))
    ].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    if(!items.length){feed.innerHTML='<p class="muted">Mbola tsy misy hafatra. Afaka manomboka ianao!</p>';}
    else feed.innerHTML=items.map(x=>{
      const sender=esc(names.get(x.sender_member_id)||"Membre");
      const time=esc(new Date(x.created_at).toLocaleString());
      if(x.kind==="gift"){
        const g=(catalog||[]).find(c=>c.gift_code===x.gift_code);
        const recipient=esc(names.get(x.recipient_member_id)||"Membre");
        return '<div class="ludo-chat-item gift"><strong>🎁 '+sender+'</strong> nandefa <b>'+esc(g?.gift_name||x.gift_code)+'</b> ho an’i <strong>'+recipient+'</strong><small>'+time+'</small></div>';
      }
      return '<div class="ludo-chat-item"><strong>'+sender+'</strong><p>'+esc(x.content||"")+'</p><small>'+time+'</small></div>';
    }).join("");
    feed.scrollTop=feed.scrollHeight;
    await loadLudoGameState();
    $("ludoGiftCode").innerHTML='<option value="">Safidio ny cadeau</option>'+(catalog||[]).map(g=>
      '<option value="'+esc(g.gift_code)+'">'+esc(g.gift_name)+' · '+Number(g.price_sc||0)+' SC (visuel)</option>'
    ).join("");
  }catch(error){
    feed.innerHTML='<p class="error">Tsy afaka mamaky chat: '+esc(error?.message||String(error))+'</p>';
  }
}

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
  await loadLudoRooms();
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
  const status=String(member?.status||"").toLowerCase();
  const pending=status==="pending";
  const active=status==="active";

  const combinedOption=select.querySelector('option[value="combined"]');
  const contributionOption=select.querySelector('option[value="contribution"]');

  if(combinedOption) combinedOption.hidden=!pending;
  if(contributionOption) contributionOption.hidden=!active;

  if(pending){
    select.value="combined";
    $("depositAmount").value=4;
  }else if(active){
    select.value="contribution";
    $("depositAmount").value=3;
  }else{
    select.value="";
    $("depositAmount").value="";
    select.disabled=true;
  }
  if(pending||active) select.disabled=false;
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
    const withdrawalBase=(w||[]).filter(x=>x.status==="completed").reduce((sum,x)=>sum+Number(x.amount||0),0);
    const {data:paidTurnTotal,error:turnTotalError}=await db.rpc("get_my_paid_turn_total");
    if(turnTotalError) msg("globalMsg","Retrait total tour: "+turnTotalError.message,true);
    const withdrawalTotal=withdrawalBase+Number(paidTurnTotal||0);
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
  else renderTable("publicTurnList",["Tour","Daty","Mpandray","Sata","FaucetPay TxID","Daty nandoavana"],(turns||[]).map(x=>[x.turn_number,dateOnly(x.scheduled_date),x.receiver_name,x.turn_status,x.faucetpay_tx_id||"—",date(x.paid_at)]));
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
  const status=String(currentMember?.status||"").toLowerCase();
  const expectedType=status==="pending"?"combined":status==="active"?"contribution":null;
  const expectedAmount=status==="pending"?4:status==="active"?3:null;
  if(!expectedType || $("depositType").value!==expectedType || Number($("depositAmount").value)!==expectedAmount){
    depositMessage("Tsy mifanaraka amin'ny sata-nao ny dépôt. Havaozy ny pejy ary jereo ny vola tokony haloanao.",true);
    return;
  }
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
  await loadAdminTurns();
}
async function loadAdminTurns(){
  const {data,error}=await db.from("member_turns").select("id,turn_number,scheduled_date,status,faucetpay_tx_id,paid_at,members(full_name)").order("turn_number",{ascending:true});
  if(error){msg("globalMsg","Lisitra tour admin: "+error.message,true);return;}
  const rows=(data||[]).map(t=>({id:t.id,status:t.status,values:[t.turn_number,dateOnly(t.scheduled_date),t.members?.full_name||"—",t.status,t.faucetpay_tx_id||"—",date(t.paid_at)]}));
  $("adminTurns").innerHTML=tableWithActions(["Tour","Daty","Mpandray","Sata","FaucetPay TxID","Daty nandoavana"],rows,"turn");
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
  return "<table><thead><tr>"+heads.map(h=>`<th>${esc(h)}</th>`).join("")+"<th>Action</th></tr></thead><tbody>"+rows.map(r=>`<tr>${r.values.map(v=>`<td>${esc(String(v??""))}</td>`).join("")}<td>${r.status==="pending"?`<button class="action" data-action="approve" data-type="${type}" data-id="${r.id}">Ekena</button><button class="action reject" data-action="reject" data-type="${type}" data-id="${r.id}">Lavina</button>`:type==="withdrawal"&&r.status==="approved"?`<button class="action" data-action="complete-withdrawal" data-type="${type}" data-id="${r.id}">MARQUER COMME PAYÉ</button>`:type==="turn"&&r.status==="waiting"?`<button class="action" data-action="mark-turn-paid" data-type="turn" data-id="${r.id}">CONFIRMER PAIEMENT + TxID</button>`:"—"}</td></tr>`).join("")+"</tbody></table>";
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
  if(decision==="mark-turn-paid"){
    if(type!=="turn")return;
    const txid=prompt("Ampidiro ny FaucetPay Transaction ID rehefa avy nandefa ny vola tamin’ny mpandray tour:");
    if(txid===null)return;
    if(!txid.trim())return alert("Tsy maintsy ampidirina ny FaucetPay Transaction ID.");
    if(!confirm("Efa nalefanao tokoa ve ny vola ho an’ity mpandray tour ity? Rehefa manamarina ianao dia hiseho ho PAID amin’ny mpikambana rehetra."))return;
    b.disabled=true;
    const {error}=await db.rpc("admin_mark_turn_paid",{p_turn_id:id,p_tx_id:txid.trim()});
    if(error){msg("globalMsg",error.message,true);b.disabled=false;return;}
    msg("globalMsg","Voamarika ho PAID ny tour ary voatahiry ny FaucetPay TxID.");
    await loadAdminData();await loadCommunityLists();
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
