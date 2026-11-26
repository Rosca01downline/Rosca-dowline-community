// Public Supabase configuration. The publishable key is intended for browser use.
// Keep RLS enabled. NEVER put service_role or private API secrets in this file.
const SUPABASE_URL = "https://zdnlwgqodtiieewxzoda.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KgimutZrYi9tI4ixcbaTvA_0KwxihZ7";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);
const show = (id, yes=true) => $(id).classList.toggle("hidden", !yes);
const msg = (id, text, error=false) => { $(id).textContent=text; $(id).classList.toggle("error",error); };
const fmt = (n) => `${Number(n||0).toFixed(8)} USDT`;
const fmtMining = (n) => `${Number(n||0).toFixed(12)} USDT`;
let currentUser = null, currentProfile = null, currentMember = null;
let miningTicker = null;
let communityRosterChannel = null;
let miningDisplayState = null;

let miningAudio = null;
function toggleMiningSound(){
  const button=$("miningSoundBtn");
  if(!button)return;
  if(miningAudio){
    const old=miningAudio;
    old.master.gain.setTargetAtTime(0,old.context.currentTime,0.06);
    miningAudio=null;
    setTimeout(()=>{try{old.context.close()}catch(_){}},180);
    button.classList.remove("is-playing");
    button.setAttribute("aria-pressed","false");
    button.title="Alefaso ny feon'ny machine";
    button.innerHTML='<span aria-hidden="true">🎧</span><span class="sound-label">FEo</span>';
    return;
  }
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx){button.title="Tsy tohanan'ity navigateur ity ny feo";return;}
  try{
    const context=new AudioCtx();
    const master=context.createGain();
    master.gain.value=0.0001;
    master.connect(context.destination);
    const length=context.sampleRate*3;
    const buffer=context.createBuffer(1,length,context.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<length;i++)samples[i]=(Math.random()*2-1)*0.32;
    const noise=context.createBufferSource();
    noise.buffer=buffer;noise.loop=true;
    const fanFilter=context.createBiquadFilter();
    fanFilter.type="bandpass";fanFilter.frequency.value=235;fanFilter.Q.value=0.7;
    const fanGain=context.createGain();fanGain.gain.value=0.24;
    noise.connect(fanFilter).connect(fanGain).connect(master);noise.start();
    const hum=context.createOscillator();hum.type="sawtooth";hum.frequency.value=58;
    const humFilter=context.createBiquadFilter();humFilter.type="lowpass";humFilter.frequency.value=115;
    const humGain=context.createGain();humGain.gain.value=0.035;
    hum.connect(humFilter).connect(humGain).connect(master);hum.start();
    const pulse=context.createOscillator();pulse.type="sine";pulse.frequency.value=116;
    const pulseGain=context.createGain();pulseGain.gain.value=0.012;
    pulse.connect(pulseGain).connect(master);pulse.start();
    context.resume().then(()=>master.gain.setTargetAtTime(0.46,context.currentTime,0.35));
    miningAudio={context,master,noise,hum,pulse};
    button.classList.add("is-playing");
    button.setAttribute("aria-pressed","true");
    button.title="Ajanony ny feon'ny machine";
    button.innerHTML='<span aria-hidden="true">🎧</span><span class="sound-label">MUTE</span>';
  }catch(error){console.warn("Mining audio unavailable:",error);button.title="Tsy afaka manomboka ny feo";}
}


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
    $("miningBalance").textContent = fmtMining(liveMining);
    $("totalBalance").textContent = fmtMining(miningDisplayState.savings + miningDisplayState.commission + liveMining);
    const status = $("miningLiveStatus");
    if(status){
      status.textContent = miningDisplayState.bonusActive && now < miningDisplayState.bonusEnd
        ? "Mining automatique + bonus parrainage · miakatra izao"
        : "Mining automatique · miakatra izao";
    }
  };
  render();
  miningTicker = setInterval(render, 100);
}

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  show("loginForm",b.dataset.tab==="login"); show("signupForm",b.dataset.tab==="signup"); msg("authMsg","");
}));

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("loginEmail").value.trim();
  const password=$("loginPassword").value;
  msg("authMsg","Miditra...");
  const button=$("loginForm").querySelector('button[type="submit"]');
  if(button){button.disabled=true;button.textContent="Miandry...";}
  try{
    if(!window.supabase || !db || !db.auth) throw new Error("Tsy tafiditra ny service de connexion. Havaozy ny pejy ary hamarino ny Internet.");
    const {error}=await db.auth.signInWithPassword({email,password});
    if(error) throw error;
    await boot();
  }catch(error){
    console.error("Login error:",error);
    msg("authMsg",error.message||"Tsy nahomby ny fidirana. Andramo indray.",true);
  }finally{
    if(button){button.disabled=false;button.textContent="Hiditra";}
  }
});
$("signupForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const full_name=$("fullName").value.trim();
  const phone=$("signupPhone").value.trim();
  if(!/^\+[1-9][0-9]{7,14}$/.test(phone)){
    return msg("authMsg","Ampidiro ny numéro amin'ny endrika iraisam-pirenena, ohatra +261341234567.",true);
  }
  msg("authMsg","Mamorona kaonty...");
  const {data,error}=await db.auth.signUp({email:$("signupEmail").value.trim(),password:$("signupPassword").value,options:{data:{full_name,phone,...(new URLSearchParams(window.location.search).get("ref")?{sponsor_id:new URLSearchParams(window.location.search).get("ref")}: {})}}});
  if(error) return msg("authMsg",error.message,true);
  if(data.session){
    await boot();
  } else {
    msg("authMsg","Jereo ny email-nao hanamafisana ny fisoratana anarana. Rehefa voamarina dia midira.");
  }
});
$("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();currentUser=null;show("appView",false);show("authView",true);show("logoutBtn",false);});
$("refreshBtn").addEventListener("click",loadMemberData);
$("miningSoundBtn").addEventListener("click",toggleMiningSound);
$("openPenaltyHistoryBtn").addEventListener("click",()=>{show("penaltyPanel",true);$("penaltyPanel").scrollIntoView({behavior:"smooth",block:"start"});});
$("closePenaltyHistoryBtn").addEventListener("click",()=>show("penaltyPanel",false));
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
let ludoStatePoller = null;
let ludoStateLoading = false;


const LUDO_TRACK = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],
  [14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],
  [8,1],[8,0],[7,0],[6,0]
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
function animateLudoPawnPath(pawn,seat,oldPos,newPos,index){
  if(!pawn || Number(oldPos)===Number(newPos)) return;
  const steps=[];
  if(Number(oldPos)<0){ steps.push(Number(newPos)); }
  else if(Number(newPos)>Number(oldPos) && Number(newPos)<=57){
    for(let p=Number(oldPos)+1;p<=Number(newPos);p++) steps.push(p);
  }else{ steps.push(Number(newPos)); }
  const board=$("ludoBoard");
  if(!board || !steps.length) return;
  const finalCoord=ludoCoord(seat,Number(newPos),index);
  const cellSize=board.clientWidth/15;
  const keyframes=[];
  const startCoord=Number(oldPos)<0?(LUDO_YARDS[seat]?.[index]||finalCoord):ludoCoord(seat,Number(oldPos),index);
  keyframes.push({transform:`translate(${(startCoord[1]-finalCoord[1])*cellSize}px, ${(startCoord[0]-finalCoord[0])*cellSize}px) scale(.78)`});
  steps.forEach((pos,i)=>{
    const coord=ludoCoord(seat,pos,index);
    keyframes.push({transform:`translate(${(coord[1]-finalCoord[1])*cellSize}px, ${(coord[0]-finalCoord[0])*cellSize}px) scale(${i===steps.length-1?1:.86})`});
  });
  keyframes.push({transform:"translate(0,0) scale(1)"});
  pawn.animate(keyframes,{duration:Math.min(650,Math.max(180,steps.length*72)),easing:"linear"});
}
function renderLudoActionFeed(players,moves){
  const host=$("ludoActionFeed");
  if(!host) return;
  const names=new Map((players||[]).map(p=>[Number(p.seat_number),p.full_name||(p.is_bot?"BOT":"Seat "+p.seat_number)]));
  const rows=(moves||[]).slice().reverse();
  if(!rows.length){host.innerHTML='<p class="muted">Mbola tsy misy hetsika.</p>';return;}
  host.innerHTML=rows.map(m=>{
    const d=m.move_data||{};
    const seat=Number(d.seat);
    const who=esc(names.get(seat)||(seat===2?"BOT":"Seat "+seat));
    const dice=d.dice==null?"":(' · 🎲 '+esc(String(d.dice)));
    let detail='Nanao hetsika';
    if(d.passed_turn) detail='Tsy nisy pion azo afindra — nifindra ny tour';
    else if(d.pawn_index!=null) detail='Pion '+(Number(d.pawn_index)+1)+' : '+(d.old_position<0?'Yard':('case '+d.old_position))+' → case '+d.new_position;
    else if(d.action==='move') detail='Namindra pion';
    if(Number(d.captured_count||0)>0) detail+=' · naka pion '+Number(d.captured_count);
    if(d.extra_turn) detail+=' · tour fanampiny';
    const time=new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return '<div class="ludo-action-item"><strong>'+who+'</strong><span>'+esc(detail)+dice+'</span><small>'+esc(time)+'</small></div>';
  }).join("")
}
function renderLudoDiceHistory(players, moves, roundNumber, readError = null) {
  const host = $("ludoDiceHistory");
  if (!host) return;

  const parseMoveData = (move) => {
    let d = move?.move_data || {};
    if (typeof d === "string") {
      try { d = JSON.parse(d); } catch (_) { d = {}; }
    }
    return d;
  };

  const rollRows = (moves || [])
    .map(m => ({ ...m, parsedData: parseMoveData(m) }))
    .filter(m =>
      m.parsedData.action === "roll" &&
      m.parsedData.seat != null &&
      m.parsedData.dice != null
    )
    .sort((a, b) => {
      const byRound = Number(b.round_number || 0) - Number(a.round_number || 0);
      if (byRound !== 0) return byRound;
      const byMove = Number(b.move_number || 0) - Number(a.move_number || 0);
      if (byMove !== 0) return byMove;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  let html =
    '<div class="ludo-dice-history-head">' +
      '<strong>🎲 5 derniers tirages</strong>' +
      '<small>Lalao manontolo</small>' +
    '</div>';

  if (readError) {
    host.innerHTML = html +
      '<p class="error">Tsy afaka mamaky ny tirage: ' +
      esc(readError) + '</p>';
    return;
  }

  if (!players || !players.length) {
    host.innerHTML = html +
      '<p class="muted">Tsy mbola misy mpilalao.</p>';
    return;
  }

  // Lokoina ny chiffre fotsiny: tirage mifanesy an'ny seat iray = loko iray.
  // Ny fanisana dia atao amin'ny filaharana taloha -> vaovao, fa tsy ovaina ny tableau.
  const sequenceColors = ["red", "green", "violet"];
  const sequenceCounts = new Map();
  let previousSeat = null;
  [...rollRows].reverse().forEach(m => {
    const seat = Number(m.parsedData.seat);
    if (seat !== previousSeat) {
      sequenceCounts.set(seat, (sequenceCounts.get(seat) || 0) + 1);
    }
    const sequenceIndex = Math.max(0, (sequenceCounts.get(seat) || 1) - 1);
    m.sequenceColor = sequenceColors[sequenceIndex % sequenceColors.length];
    previousSeat = seat;
  });

  // Mpilalao iray = andalana iray, miaraka amin'ny tirage 5 farany nataony.
  const grouped = new Map();
  rollRows.forEach(m => {
    const seat = Number(m.parsedData.seat);
    if (!grouped.has(seat)) grouped.set(seat, []);
    const playerRolls = grouped.get(seat);
    if (playerRolls.length < 5) playerRolls.push(m);
  });

  const playerGroups = Array.from(grouped.entries())
    .map(([seat, rolls]) => ({
      seat,
      rolls,
      latestMove: rolls[0]
    }))
    // Filaharana raikitra araka ny seat: tsy mihetsika rehefa misy manao tirage.
    .sort((a, b) => a.seat - b.seat);

  if (!playerGroups.length) {
    host.innerHTML = html +
      '<p class="muted">Mbola tsy nisy tirage.</p>';
    return;
  }

  html += '<div class="ludo-dice-history-grid">';
  playerGroups.forEach((group, index) => {
    const seat = group.seat;
    const player = players.find(p => Number(p.seat_number) === seat);
    const who = esc(
      player?.full_name || (player?.is_bot ? "BOT" : "Seat " + seat)
    );
    const latestTime = group.latestMove.created_at
      ? new Date(group.latestMove.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      : "";
    const diceChips = group.rolls.map(m =>
      '<span class="ludo-dice-history-chip">🎲 <b class="ludo-dice-history-number ' +
        esc(m.sequenceColor || "red") + '">' + esc(String(m.parsedData.dice)) + '</b></span>'
    ).join("");

    html +=
      '<div class="ludo-dice-history-player ' + (LUDO_COLORS[seat] || "red") + '">' +
        '<strong>' + String(index + 1) + '. ' + who +
          (player?.is_bot ? ' · BOT' : '') + '</strong>' +
        '<div class="ludo-dice-history-rolls">' +
          diceChips +
          (latestTime ? '<small>' + esc(latestTime) + '</small>' : '') +
        '</div>' +
      '</div>';
  });

  html += '</div>';
  host.innerHTML = html;
}
function renderLudoBoard(snapshot,previousSnapshot=null){
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
  // Filaharana raikitra araka ny seat_number, na dia miova aza ny current turn.
  const players=[...(snapshot.players||[])].sort((a,b)=>Number(a.seat_number)-Number(b.seat_number));
  const ownSeat=players.find(p=>p.member_id===currentMember?.id)?.seat_number;
  const myTurn=Number(state.current_turn_seat)===Number(ownSeat);
  const cells=[];
  const safeTrack=[8,21,33,46];
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
    // Hide the two excess outer-left tiles explicitly marked by the user.
    // Keep LUDO_TRACK coordinates unchanged so pawn movement/history are preserved.
    const userMarkedExcessTile=(c===0&&(r===4||r===5)&&trackIndex<0); // never hide a real pawn-track coordinate
    // No decorative filler tiles: render only real track and home-lane squares.
    // Keep every coordinate in LUDO_TRACK visible as a real square.
    // Outer-track squares stay white even when they pass through a colored yard quadrant.
    if(trackIndex>=0) base="";
    let cls="ludo-cell "+base;
    if(r===7&&c===14) cls+=" entry-yellow";
    // A real track coordinate inside the yard must stay an opaque white tile.
    // Apply transparent yard-inner styling only to non-track yard decoration.
    if(innerYard&&trackIndex<0) cls+=" yard-inner";
    if(trackIndex>=0) cls+=" track"+(safeTrack.includes(trackIndex)?" safe":"");
    if(laneSeat) cls+=" lane lane-"+laneSeat;
    if(r===6&&c===1) cls+=" start-red";
    if(r===1&&c===8) cls+=" start-green";
    if(r===8&&c===13) cls+=" start-yellow";
    if(r===13&&c===6) cls+=" start-blue";

    // Build all four arms as complete 3-by-6 tile grids, matching the blue reference arms.
    const inHorizontalArm=(r>=6&&r<=8&&((c>=0&&c<=5)||(c>=9&&c<=14)));
    const inVerticalArm=(c>=6&&c<=8&&((r>=0&&r<=5)||(r>=9&&r<=14)));
    if(userMarkedExcessTile) continue;
    if(trackIndex<0&&!laneSeat&&!inHorizontalArm&&!inVerticalArm) continue;
    // Missing outer white squares are decorative track tiles, not pawn path coordinates.
    if(trackIndex<0&&!laneSeat&&(inHorizontalArm||inVerticalArm)) cls+=" track";
    // The yellow entry outer tile is white like the other track squares.
    if(r===7&&c===14) cls+=" entry-yellow";
    cells.push('<div class="'+cls+'" style="grid-row:'+(r+1)+';grid-column:'+(c+1)+'"></div>');
  }
  const homes='<div class="ludo-home home-red"><i></i><i></i><i></i><i></i></div>'+
    '<div class="ludo-home home-green"><i></i><i></i><i></i><i></i></div>'+
    '<div class="ludo-home home-yellow"><i></i><i></i><i></i><i></i></div>'+
    '<div class="ludo-home home-blue"><i></i><i></i><i></i><i></i></div>';
  const balances=snapshot.virtualBalances||{};
  const balanceStrip='<div class="ludo-player-balances">'+players.map(p=>{
    const seat=Number(p.seat_number);
    const amount=balances[p.member_id];
    const shown=amount==null?"—":Number(amount).toLocaleString("fr-FR");
    return '<div class="ludo-player-balance '+(LUDO_COLORS[seat]||"red")+'"><strong>'+esc(p.full_name||("Seat "+seat))+'</strong><span>🪙 '+shown+' SC</span></div>';
  }).join("")+'</div>';
  board.innerHTML=cells.join("")+homes+'<div class="ludo-center" aria-hidden="true"><span class="center-red"></span><span class="center-green"></span><span class="center-yellow"></span><span class="center-blue"></span></div>';
  const balanceHost=$("ludoPlayerBalances");
  if(balanceHost) balanceHost.innerHTML=balanceStrip;
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
      const isMyPawn=seat===Number(ownSeat);
      pawn.disabled=!myTurn||!isMyPawn||!state.dice_rolled||ludoBoardBusy;
      pawn.style.pointerEvents=isMyPawn&&myTurn?"auto":"none";
      pawn.style.zIndex=isMyPawn?"5":"3";
      pawn.addEventListener("click",()=>{if(isMyPawn&&myTurn) moveLudoPawn(index);});
      board.appendChild(pawn);
      const oldPos=previousSnapshot?.state?.pawns?.[String(seat)]?.pawns?.[index];
      if(oldPos!==undefined && Number(oldPos)!==Number(pos)) animateLudoPawnPath(pawn,seat,Number(oldPos),Number(pos),index);
    });
  });
  const stackGroups=new Map();
  board.querySelectorAll('.ludo-pawn').forEach(pawn=>{
    const key=pawn.style.gridRow+'|'+pawn.style.gridColumn;
    if(!stackGroups.has(key)) stackGroups.set(key,[]);
    stackGroups.get(key).push(pawn);
  });
  stackGroups.forEach(group=>{
    const count=group.length;
    if(count<2) return;
    const size=count===2?68:count===3?58:50;
    const offsets=count===2?[[-17,0],[17,0]]:count===3?[[-15,-13],[15,-13],[0,15]]:[[-15,-15],[15,-15],[-15,15],[15,15]];
    group.forEach((pawn,i)=>{
      pawn.style.width=size+'%'; pawn.style.height=size+'%';
      pawn.style.translate=offsets[i][0]+'% '+offsets[i][1]+'%';
      pawn.style.zIndex=String(8+i);
    });
  });
  $("ludoDiceValue").textContent=state.dice_value==null?"–":String(state.dice_value);
  const winnerPlayer=players.find(p=>{
    const pp=state.pawns?.[String(p.seat_number)]?.pawns||[];
    return pp.length===4 && pp.every(pos=>Number(pos)===57);
  });
  const winnerPanel=$("ludoWinnerPanel");
  const winnerSeat=winnerPlayer?Number(winnerPlayer.seat_number):null;
  if(winnerPanel){
    const hasWinner=snapshot.status==="completed";
    winnerPanel.classList.toggle("hidden",!hasWinner);
    if(hasWinner){
      $("ludoWinnerTitle").textContent="🏆 WIN !";
      $("ludoWinnerName").textContent=winnerPlayer?.full_name||(winnerPlayer?.is_bot?"BOT MASTER":"Vainqueur");
    }
  }
  if(snapshot.status==="completed" && winnerSeat){
    const crown=document.createElement("div");
    crown.className="ludo-board-winner-crown";
    crown.innerHTML='<span aria-hidden="true">👑</span><strong>WIN</strong>';
    const crownCell={1:[4,4],2:[4,12],3:[12,12],4:[12,4]}[winnerSeat]||[8,8];
    crown.style.gridRow=String(crownCell[0]);
    crown.style.gridColumn=String(crownCell[1]);
    board.appendChild(crown);
  }
  const active=players.find(p=>Number(p.seat_number)===Number(state.current_turn_seat));
  $("ludoTurnInfo").textContent="Tour: "+(active?.full_name||(active?.is_bot?"BOT":"Seat "+state.current_turn_seat))+" — Miandry";
  $("ludoRollBtn").disabled=!myTurn||Boolean(state.dice_rolled)||ludoBoardBusy||snapshot.status!=="playing";
}
async function loadLudoGameState() {
  if (!currentLudoRoomId) {
    renderLudoBoard(null);
    return;
  }

  if (ludoStateLoading) return;

  const roomId = currentLudoRoomId;

  try {
    ludoStateLoading = true;

    const { data, error } = await db.rpc(
      "get_ludo_game_state",
      { p_room_id: roomId }
    );

    if (error) throw error;

    if (roomId !== currentLudoRoomId) return;

    const players = data?.players || [];
    const playerIds = players
      .map(p => p.member_id)
      .filter(Boolean);

    let virtualBalances = {};

    if (playerIds.length) {
      const { data: wallets, error: walletError } = await db
        .from("ludo_virtual_balances")
        .select("member_id,balance_sc")
        .in("member_id", playerIds);

      if (!walletError) {
        (wallets || []).forEach(w => {
          virtualBalances[w.member_id] = Number(w.balance_sc || 0);
        });
      } else {
        console.warn(
          "Ludo virtual balances not readable:",
          walletError.message
        );
      }
    }

    if (roomId !== currentLudoRoomId) return;

    data.virtualBalances = virtualBalances;

    const previous = ludoGameSnapshot;
    ludoGameSnapshot = data;

    renderLudoBoard(data, previous);
    const roundNumber = Number(data?.state?.round_number || 1);

    // Vakio ny historique manontolo ao amin'ny room, amin'ny pejy 1000 rows.
    // Ny pagination dia misoroka ny fetra 1000 rows amin'ny Supabase.
    const moves = [];
    let moveOffset = 0;
    let moveError = null;

    while (true) {
      const { data: page, error } = await db
        .from("ludo_moves")
        .select("round_number,move_number,move_data,created_at")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .order("move_number", { ascending: false })
        .range(moveOffset, moveOffset + 999);

      if (error) {
        moveError = error;
        break;
      }

      moves.push(...(page || []));
      if (!page || page.length < 1000) break;
      moveOffset += 1000;
    }

    if (roomId !== currentLudoRoomId) return;

    if (moveError) {
      console.error("Ludo moves read error:", moveError);

      renderLudoDiceHistory(
        players,
        [],
        roundNumber,
        moveError.message
      );

      return;
    }

    // Ny action feed dia mijanona amin'ny manche ankehitriny; ny dice history kosa manerana ny lalao.
    renderLudoActionFeed(
      players,
      moves.filter(m => Number(m.round_number) === roundNumber)
    );

    renderLudoDiceHistory(
      players,
      moves,
      roundNumber
    );

  } catch (error) {
    console.error("Ludo game state error:", error);

    if (roomId === currentLudoRoomId) {
      $("ludoBoard").innerHTML =
        '<p class="error ludo-board-empty">' +
        'Tsy afaka mamaky ny lalao: ' +
        esc(error?.message || String(error)) +
        '</p>';
    }

  } finally {
    ludoStateLoading = false;
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
$("ludoContinueBtn").addEventListener("click",async()=>{
  if(!currentLudoRoomId || ludoBoardBusy) return;
  const button=$("ludoContinueBtn");
  button.disabled=true;
  msg("ludoSocialMsg","Manomboka manche vaovao ao amin'ity room ity...");
  try{
    const {error}=await db.rpc("continue_ludo_room",{p_room_id:currentLudoRoomId});
    if(error) throw error;
    ludoGameSnapshot=null;
    await loadLudoGameState();
    msg("ludoSocialMsg","Manche vaovao natomboka! Mbola ireo mpilalao sy BOT teo ihany, ary voatahiry ny solde SC sy ny historique.");
  }catch(error){
    msg("ludoSocialMsg","Tsy afaka manohy: "+(error?.message||String(error)),true);
  }finally{button.disabled=false;}
});
$("ludoStopBtn").addEventListener("click",async()=>{
  const stoppedRoom=currentLudoRoomId;
  currentLudoRoomId=null;
  ludoGameSnapshot=null;
  $("ludoRoomSelect").value="";
  renderLudoBoard(null);
  $("ludoWinnerPanel").classList.add("hidden");
  await loadLudoRoomMembers();
  await loadLudoChat();
  msg("ludoSocialMsg","Niala tamin'ny room "+String(stoppedRoom||"").slice(0,8)+". Tsy voafafa ny tantara na ny solde SC.");
});
$("ludoRollBtn").addEventListener("click",rollLudoDice);
if(ludoStatePoller) clearInterval(ludoStatePoller);
ludoStatePoller=setInterval(()=>{if(currentLudoRoomId && !ludoBoardBusy) loadLudoGameState();},1000);


async function loadLudoCrownGiftStats(){
  const sentEl=$("ludoCrownSent");
  const receivedEl=$("ludoCrownReceived");
  if(!sentEl || !receivedEl || !currentMember?.id) return;
  try{
    // Code exact confirmé dans ludo_gift_catalog : couronne
    const [{count:sent,error:sentError},{count:received,error:receivedError}]=await Promise.all([
      db.from("ludo_gift_transfers")
        .select("id",{count:"exact",head:true})
        .eq("gift_code","couronne")
        .eq("sender_member_id",currentMember.id),
      db.from("ludo_gift_transfers")
        .select("id",{count:"exact",head:true})
        .eq("gift_code","couronne")
        .eq("recipient_member_id",currentMember.id)
    ]);
    if(sentError) throw sentError;
    if(receivedError) throw receivedError;
    sentEl.textContent=Number(sent||0).toLocaleString("fr-FR");
    receivedEl.textContent=Number(received||0).toLocaleString("fr-FR");
  }catch(error){
    console.warn("Ludo crown gift history not readable:",error?.message||error);
    sentEl.textContent="—";
    receivedEl.textContent="—";
  }
}

async function loadLudoHeaderBalance(){
  const host=$("ludoHeaderBalance");
  if(!host) return;
  if(!currentMember?.id){
    host.textContent="Solde : — SC";
    return;
  }
  const {data,error}=await db.from("ludo_virtual_balances")
    .select("balance_sc")
    .eq("member_id",currentMember.id)
    .maybeSingle();
  if(error){
    host.textContent="Solde : — SC";
    console.warn("Ludo header balance not readable:",error.message);
    return;
  }
  host.textContent="Solde : "+Number(data?.balance_sc||0).toLocaleString("fr-FR")+" SC";
  await loadLudoCrownGiftStats();
}

async function initializeLudoVirtualBalance(){
  if(!currentMember?.id || String(currentMember.status).toLowerCase()!=="active"){
    throw new Error("Mpikambana ACTIVE ihany no mahazo bonus Ludo.");
  }
  const {data,error}=await db.rpc("initialize_ludo_virtual_balance");
  if(error) throw error;
  const balance=Number(data||0);
  msg("ludoSocialMsg","Solde Ludo virtuel: "+balance.toLocaleString("fr-FR")+" SC. Bonus 5 000 SC indray mandeha ihany.");
  await loadLudoHeaderBalance();
  return balance;
}

$("ludoRefreshBtn").addEventListener("click", loadLudoRooms);
$("ludoSCRequestRefreshBtn").addEventListener("click",loadMyLudoSCRequests);


// Fangatahana SC fanampiny: wallet Ludo ihany.

async function loadLudoWithdrawalData(){
  const statusHost=$("ludoWithdrawalStatus");
  const historyHost=$("myLudoWithdrawals");
  if(!currentMember?.id || !statusHost || !historyHost) return;
  statusHost.innerHTML='<p class="muted">Ampidirina ny fepetra retrait...</p>';
  const emailInput=$("ludoWithdrawalEmail");
  if(emailInput && !emailInput.value) emailInput.value=currentUser?.email||"";
  const [{data:status,error:statusError},{data:rows,error:rowsError}]=await Promise.all([
    db.rpc("get_ludo_withdrawal_status"),
    db.from("ludo_withdrawal_requests")
      .select("id,amount_sc,amount_usdt,faucetpay_email,status,admin_message,faucetpay_tx_id,created_at,reviewed_at,paid_at")
      .eq("member_id",currentMember.id)
      .order("created_at",{ascending:false})
  ]);
  if(statusError){
    statusHost.innerHTML='<p class="error">Statut retrait: '+esc(statusError.message)+'</p>';
  }else{
    const unlocked=Boolean(status?.unlocked);
    const method=status?.unlock_method==="referrals"?"15 filleuls directs L1 ACTIVE":"20 couronnes (envoyées + reçues, avec au moins 1 de chaque)";
    statusHost.innerHTML=
      '<div class="ludo-withdrawal-metrics">'+
        '<div><small>Solde Ludo</small><strong>'+Number(status?.balance_sc||0).toLocaleString("fr-FR")+' SC</strong></div>'+
        '<div><small>Filleuls L1 ACTIVE</small><strong>'+Number(status?.active_l1||0)+'/15</strong></div>'+
        '<div><small>Couronnes envoyées</small><strong>'+Number(status?.crown_sent||0)+'</strong></div>'+
        '<div><small>Couronnes reçues</small><strong>'+Number(status?.crown_received||0)+'</strong></div>'+
      '</div>'+
      (unlocked
        ? '<p class="success-text">Déblocage acquis définitivement · '+esc(method)+'.</p>'
        : '<p class="muted">Premier retrait mbola mihidy. Déblocage raha mahafeno ny iray amin’ireto: 15 filleuls directs L1 ACTIVE, na 20 couronnes total (farafahakeliny 1 nalefa sy 1 voaray).</p>');
    const form=$("ludoWithdrawalForm");
    if(form){
      form.classList.remove("hidden");
      form.dataset.withdrawalUnlocked=unlocked?"true":"false";
      const submit=form.querySelector('button[type="submit"]');
      if(submit) submit.disabled=false;
    }
  }
  if(rowsError){
    historyHost.innerHTML='<p class="error">Historique: '+esc(rowsError.message)+'</p>';
    return;
  }
  if(!rows?.length){
    historyHost.innerHTML='<p class="muted">Mbola tsy misy fangatahana retrait Ludo.</p>';
    return;
  }
  historyHost.innerHTML='<div class="table-wrap"><table><thead><tr><th>SC</th><th>USDT</th><th>Sata</th><th>FaucetPay TxID</th><th>Fanazavana Admin</th><th>Daty</th></tr></thead><tbody>'+
    rows.map(x=>'<tr><td>'+Number(x.amount_sc).toLocaleString("fr-FR")+'</td><td>'+Number(x.amount_usdt).toFixed(3)+'</td><td>'+esc(String(x.status||"").toUpperCase())+'</td><td>'+esc(x.faucetpay_tx_id||"—")+'</td><td>'+esc(x.admin_message||"—")+'</td><td>'+esc(date(x.created_at))+'</td></tr>').join("")+
    '</tbody></table></div>';
}
function updateLudoWithdrawalEstimate(){
  const amount=Number($("ludoWithdrawalAmount")?.value||0);
  const usdt=Number.isSafeInteger(amount)&&amount>0?amount/1000:0;
  const output=$("ludoWithdrawalUsdt");
  if(output) output.textContent=usdt.toFixed(3)+" USDT";
}
$("ludoWithdrawalAmount").addEventListener("input",updateLudoWithdrawalEstimate);
$("ludoWithdrawalRefreshBtn").addEventListener("click",loadLudoWithdrawalData);
$("ludoWithdrawalForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!currentUser||!currentMember?.id) return;
  if(e.currentTarget.dataset.withdrawalUnlocked!=="true"){
    msg("ludoWithdrawalMsg","Tsy mbola nahatratra ny déblocage premier retrait ianao. Fenoy aloha ny iray amin’ireto fepetra ireto: 15 filleuls directs L1 ACTIVE, na 20 couronnes total (farafahakeliny 1 nalefa sy 1 voaray). Tsy nalefa ny demande ary tsy nisy SC nesorina.",true);
    return;
  }
  const amount=Number($("ludoWithdrawalAmount").value);
  const email=$("ludoWithdrawalEmail").value.trim();
  if(!Number.isSafeInteger(amount)||amount<1000){
    msg("ludoWithdrawalMsg","Retrait minimum: 1 000 SC.",true);return;
  }
  if(!email){msg("ludoWithdrawalMsg","Ampidiro ny email FaucetPay.",true);return;}
  const button=e.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true;
  msg("ludoWithdrawalMsg","Alefa ny fangatahana retrait Ludo...");
  try{
    const {data,error}=await db.rpc("request_ludo_withdrawal",{
      p_amount_sc:amount,
      p_faucetpay_email:email
    });
    if(error) throw error;
    e.currentTarget.reset();
    $("ludoWithdrawalEmail").value=currentUser.email||"";
    msg("ludoWithdrawalMsg","Voaray ny fangatahana: "+Number(data?.amount_sc||amount).toLocaleString("fr-FR")+" SC = "+Number(data?.amount_usdt||amount/1000).toFixed(3)+" USDT. Miandry fanamarinana Admin.");
    await loadLudoWithdrawalData();
    await loadLudoHeaderBalance();
  }catch(error){
    msg("ludoWithdrawalMsg","Tsy tafiditra ny fangatahana: "+(error?.message||String(error)),true);
  }finally{button.disabled=false;}
});

async function loadMyLudoSCRequests(){
  if(!currentMember?.id) return;
  const host=$("myLudoSCRequests");
  if(!host) return;
  host.innerHTML='<p class="muted">Ampidirina...</p>';
  const {data,error}=await db.from("ludo_sc_requests")
    .select("id,requested_sc,request_message,status,admin_message,created_at,reviewed_at")
    .eq("member_id",currentMember.id)
    .order("created_at",{ascending:false});
  if(error){host.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  if(!data?.length){host.innerHTML='<p class="muted">Mbola tsy nandefa fangatahana SC ianao.</p>';return;}
  host.innerHTML="<table><thead><tr><th>SC</th><th>Hafatra</th><th>Sata</th><th>Valin'ny Admin</th><th>Daty</th></tr></thead><tbody>"+
    data.map(x=>'<tr><td>'+Number(x.requested_sc).toLocaleString("fr-FR")+'</td><td>'+esc(x.request_message)+'</td><td>'+esc(x.status.toUpperCase())+'</td><td>'+esc(x.admin_message||"—")+'</td><td>'+esc(date(x.created_at))+'</td></tr>').join("")+
    "</tbody></table>";
}
$("ludoSCRequestForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!currentUser||!currentMember?.id){msg("ludoSCRequestMsg","Midira amin'ny kaontinao aloha.",true);return;}
  const form=e.currentTarget,button=form.querySelector('button[type="submit"]');
  const amount=Number($("ludoSCRequestAmount").value);
  const message=$("ludoSCRequestMessage").value.trim();
  if(!Number.isInteger(amount)||amount<5000||amount>100000){msg("ludoSCRequestMsg","5 000 hatramin'ny 100 000 SC ihany no azo angatahina.",true);return;}
  if(!message){msg("ludoSCRequestMsg","Tsy maintsy manoratra hafatra ianao.",true);return;}
  button.disabled=true;
  try{
    const {error}=await db.rpc("request_ludo_sc",{p_requested_sc:amount,p_request_message:message});
    if(error) throw error;
    form.reset();
    msg("ludoSCRequestMsg","Voaray ny fangatahanao. Miandry fanamarinana Admin.");
    await loadMyLudoSCRequests();
  }catch(error){msg("ludoSCRequestMsg","Tsy tafiditra: "+(error?.message||String(error)),true);}
  finally{button.disabled=false;}
});

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
      p_player_count:Number($("ludoPlayerCount").value),
      p_stake_sc:Number($("ludoStakeSC").value)
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
    const {data,error}=await db.rpc("send_ludo_virtual_gift",{
      p_room_id:currentLudoRoomId,
      p_recipient_member_id:recipient,
      p_gift_code:gift
    });
    if(error) throw error;
    const transfer=Array.isArray(data)?data[0]:data;
    if(transfer){
      msg("ludoSocialMsg","Cadeau nalefa! Niala "+Number(transfer.charged_sc||0)+" SC taminao; nahazo "+Number(transfer.recipient_sc||0)+" SC ny mpandray. Sarany: "+Number(transfer.fee_sc||0)+" SC.");
    }else{
      msg("ludoSocialMsg","Cadeau nalefa ary voaisa ny SC.");
    }
    await loadLudoChat();
    await loadLudoHeaderBalance();
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
let ludoUnreadCount=0;
let ludoMessageAudioContext=null;
function updateLudoUnreadBadge(){
  const badge=$("ludoUnreadBadge");
  if(!badge)return;
  badge.textContent=ludoUnreadCount>99?"99+":String(ludoUnreadCount);
  badge.hidden=ludoUnreadCount===0;
}
function playLudoIncomingSound(){
  const choice=$("ludoMessageSound")?.value||"ding";
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return;
  try{
    if(!ludoMessageAudioContext)ludoMessageAudioContext=new AudioCtx();
    const ctx=ludoMessageAudioContext;
    if(ctx.state==="suspended")ctx.resume();
    const patterns={
      ding:[{f:880,t:0,d:.16},{f:1175,t:.12,d:.22}],
      bell:[{f:660,t:0,d:.32},{f:880,t:.18,d:.38}],
      pop:[{f:520,t:0,d:.07},{f:760,t:.08,d:.09}],
      chime:[{f:784,t:0,d:.18},{f:988,t:.16,d:.18},{f:1175,t:.32,d:.28}]
    };
    (patterns[choice]||patterns.ding).forEach(note=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=choice==="pop"?"triangle":"sine";
      osc.frequency.setValueAtTime(note.f,ctx.currentTime+note.t);
      gain.gain.setValueAtTime(.0001,ctx.currentTime+note.t);
      gain.gain.exponentialRampToValueAtTime(.65,ctx.currentTime+note.t+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+note.t+note.d);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(ctx.currentTime+note.t);osc.stop(ctx.currentTime+note.t+note.d+.02);
    });
  }catch(_){}
}
const ludoSocialAccordion=document.querySelector(".ludo-social-accordion");
if(ludoSocialAccordion){
  ludoSocialAccordion.addEventListener("toggle",()=>{
    if(ludoSocialAccordion.open){ludoUnreadCount=0;updateLudoUnreadBadge();}
  });
}
$("ludoMessageSound")?.addEventListener("change",()=>{
  try{localStorage.setItem("roscaLudoMessageSound",$("ludoMessageSound").value);}catch(_){}
  playLudoIncomingSound();
});
try{
  const savedLudoSound=localStorage.getItem("roscaLudoMessageSound");
  if(savedLudoSound&&$("ludoMessageSound")?.querySelector('option[value="'+savedLudoSound+'"]'))$("ludoMessageSound").value=savedLudoSound;
}catch(_){}
updateLudoUnreadBadge();

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
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"ludo_chat_messages",filter:"room_id=eq."+roomId},payload=>{if(currentLudoRoomId!==roomId)return;const incoming=payload?.new;if(incoming?.sender_member_id&&incoming.sender_member_id!==currentMember?.id){if(!ludoSocialAccordion?.open){ludoUnreadCount++;updateLudoUnreadBadge();}playLudoIncomingSound();}loadLudoChat();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"ludo_chat_gift_events",filter:"room_id=eq."+roomId},()=>{if(currentLudoRoomId===roomId) loadLudoChat();})
      .subscribe();
    ludoChatChannelRoomId=roomId;
  }
  feed.innerHTML='<p class="muted">Ampidirina ny chat...</p>';
  try{
    await loadLudoRoomMembers();
    const [{data:messages,error:messageError},{data:visualGifts,error:visualGiftError},{data:gifts,error:giftError},{data:catalog,error:catalogError}]=await Promise.all([
      db.from("ludo_chat_messages").select("id,sender_member_id,message_type,content,created_at")
        .eq("room_id",currentLudoRoomId).order("created_at",{ascending:true}).limit(100),
      db.from("ludo_chat_gift_events").select("id,sender_member_id,recipient_member_id,gift_code,created_at")
        .eq("room_id",currentLudoRoomId).order("created_at",{ascending:true}).limit(100),
      db.from("ludo_gift_transfers").select("id,sender_member_id,recipient_member_id,gift_code,amount_sc,recipient_sc,fee_sc,created_at")
        .eq("room_id",currentLudoRoomId).order("created_at",{ascending:true}).limit(100),
      db.from("ludo_gift_catalog").select("gift_code,gift_name,price_sc").eq("active",true)
    ]);
    if(messageError) throw messageError;
    if(visualGiftError) throw visualGiftError;
    if(giftError) throw giftError;
    if(catalogError) throw catalogError;
    const names=new Map((ludoRoomMembers||[]).map(m=>[m.id,m.full_name||"Membre"]));
    const items=[
      ...(messages||[]).map(x=>({...x,kind:"message"})),
      ...(visualGifts||[]).map(x=>({...x,kind:"gift"})),
      ...(gifts||[]).map(x=>({...x,kind:"gift"}))
    ].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    if(!items.length){feed.innerHTML='<p class="muted">Mbola tsy misy hafatra. Afaka manomboka ianao!</p>';}
    else feed.innerHTML=items.map(x=>{
      const sender=esc(names.get(x.sender_member_id)||"Membre");
      const time=esc(new Date(x.created_at).toLocaleString());
      if(x.kind==="gift"){
        const g=(catalog||[]).find(c=>c.gift_code===x.gift_code);
        const recipient=esc(names.get(x.recipient_member_id)||"Membre");
        const giftAmount=x.amount_sc?(' · '+Number(x.amount_sc)+' SC'): ' · cadeau visuel';
        return '<div class="ludo-chat-item gift"><strong>🎁 '+sender+'</strong> nandefa <b>'+esc(g?.gift_name||x.gift_code)+'</b> ho an’i <strong>'+recipient+'</strong>'+esc(giftAmount)+'<small>'+time+'</small></div>';
      }
      return '<div class="ludo-chat-item"><strong>'+sender+'</strong><p>'+esc(x.content||"")+'</p><small>'+time+'</small></div>';
    }).join("");
    feed.scrollTop=feed.scrollHeight;
    await loadLudoGameState();
    $("ludoGiftCode").innerHTML='<option value="">Safidio ny cadeau</option>'+(catalog||[]).map(g=>
      '<option value="'+esc(g.gift_code)+'">'+esc(g.gift_name)+' · '+Number(g.price_sc||0)+' SC</option>'
    ).join("");
  }catch(error){
    feed.innerHTML='<p class="error">Tsy afaka mamaky chat: '+esc(error?.message||String(error))+'</p>';
  }
}

$("adminRefresh").addEventListener("click",loadAdminData);
$("communityRefresh").addEventListener("click",loadCommunityLists);
$("togglePublicTurnListBtn").addEventListener("click",()=>{
  const button=$("togglePublicTurnListBtn");
  const opening=button.getAttribute("aria-expanded")!=="true";
  button.setAttribute("aria-expanded",String(opening));
  show("publicTurnListPanel",opening);
  $("publicTurnListToggleIcon").textContent=opening?"−":"＋";
  if(opening) $("publicTurnListPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
});
$("rolePill").addEventListener("click",()=>{
  const section=document.querySelector(".community-lists");
  if(section){section.scrollIntoView({behavior:"smooth",block:"start"});$("memberRoster").focus?.({preventScroll:true});}
});

async function boot(){
  const {data:{user}}=await db.auth.getUser();
  if(!user){document.body.classList.remove("admin-mode");show("authView",true);show("appView",false);show("logoutBtn",false);return;}
  currentUser=user;
  const {data:profile,error:pErr}=await db.from("profiles").select("id,full_name,email,role").eq("id",user.id).single();
  if(pErr){msg("globalMsg","Tsy afaka mamaky profil: "+pErr.message,true);return;}
  currentProfile=profile;
  document.body.classList.toggle("admin-mode",profile.role==="admin");
  const {data:member}=await db.from("members").select("id,full_name,phone,status,membership_fee_paid").eq("auth_user_id",user.id).maybeSingle();
  currentMember=member;
  show("authView",false);show("appView",true);show("logoutBtn",true);
  $("welcomeName").textContent=profile.full_name||user.email;
  $("welcomeEmail").textContent=user.email;
  $("rolePill").textContent=profile.role==="admin"?"ADMIN":"MEMBRE";
  show("adminView",profile.role==="admin");
  await loadMemberData();
  await loadCommunityLists();
  subscribeCommunityRoster();
  await loadLudoRooms();
  await loadLudoWithdrawalData();
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

let currentDepositDue = null;

function configureDepositOptions(member){
  const select=$("depositType");
  const status=String(member?.status||"").toLowerCase();
  const pending=status==="pending";
  const active=status==="active";
  const combinedOption=select.querySelector('option[value="combined"]');
  const contributionOption=select.querySelector('option[value="contribution"]');

  if(combinedOption) combinedOption.hidden=!pending;
  if(contributionOption) contributionOption.hidden=!active;
  select.value=pending?"combined":active?"contribution":"";
  select.disabled=!(pending||active);
  $("depositAmount").value="";
  $("depositAmount").step="any";

  const button=$("depositForm").querySelector('button[type="submit"]');
  if(button) button.disabled=true;

  let breakdown=$("depositDueBreakdown");
  if(!breakdown){
    breakdown=document.createElement("div");
    breakdown.id="depositDueBreakdown";
    breakdown.className="muted";
    breakdown.style.margin="8px 0 12px";
    $("depositAmount").closest("label").insertAdjacentElement("afterend",breakdown);
  }
  breakdown.textContent=member?"Kajiana ny vola tokony haloanao...":"Tsy misy kaonty mpikambana.";
}

async function loadDepositDue(member){
  currentDepositDue=null;
  const button=$("depositForm").querySelector('button[type="submit"]');
  const amountInput=$("depositAmount");
  const breakdown=$("depositDueBreakdown");
  if(!member){
    amountInput.value="";
    if(button) button.disabled=true;
    if(breakdown) breakdown.textContent="Tsy misy kaonty mpikambana.";
    return null;
  }

  try{
    const {data,error}=await db.rpc("get_my_deposit_due");
    if(error) throw error;
    const due=typeof data==="string"?JSON.parse(data):data;
    if(!due || !Number.isFinite(Number(due.amount)) || Number(due.amount)<0){
      throw new Error("Valin'ny kajy dépôt tsy marina.");
    }

    const status=String(member.status||"").toLowerCase();
    const expectedType=status==="pending"?"combined":status==="active"?"contribution":null;
    if(!expectedType || due.payment_type!==expectedType){
      throw new Error("Tsy mifanaraka amin'ny sata-nao ny kajy dépôt.");
    }

    currentDepositDue=due;
    $("depositType").value=expectedType;
    amountInput.value=Number(due.amount).toFixed(2);
    if(breakdown){
      if(expectedType==="combined"){
        breakdown.textContent="Droit d’adhésion: 1.00 USDT · Contribution initiale: 3.00 USDT · Total: 4.00 USDT";
      }else{
        const weeks=Array.isArray(due.due_weeks)?due.due_weeks:[];
        breakdown.textContent=
          "Contributions ("+Number(due.week_count||0)+" semaine): "+Number(due.contribution_due||0).toFixed(2)+
          " USDT · Pénalités ("+Number(due.penalty_count||0)+"): "+Number(due.penalty_due||0).toFixed(2)+
          " USDT · Total: "+Number(due.amount).toFixed(2)+" USDT"+
          (weeks.length?" · Herinandro: "+weeks.map(dateOnly).join(", "):"");
      }
    }
    if(button) button.disabled=Number(due.amount)<=0;
    if(Number(due.amount)<=0 && breakdown){
      breakdown.textContent="Tsy misy contribution na pénalité tokony haloanao amin'izao fotoana izao.";
    }
    return due;
  }catch(error){
    amountInput.value="";
    if(button) button.disabled=true;
    if(breakdown) breakdown.textContent="Tsy afaka maka ny vola tokony haloanao: "+(error?.message||String(error));
    console.error("get_my_deposit_due:",error);
    return null;
  }
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
  const {data:member,error:memberError}=await db.from("members").select("id,status,membership_fee_paid,unpaid_weeks,total_penalty").eq("auth_user_id",currentUser.id).maybeSingle();
  if(memberError){msg("globalMsg","Erreur lecture membre: "+memberError.message,true);return;}
  currentMember=member;
  await loadLudoHeaderBalance();
  if(member) await loadMyLudoSCRequests();
  configureDepositOptions(member);
  await loadDepositDue(member);
  await loadHoldingsWingsHistory(member);
  if(member)msg("globalMsg","Membre trouvé dans l’application : "+member.status);
  renderReferralLink(member);
  if(member){
    const {data:b}=await db.from("member_balances").select("savings_balance,commission_balance,reserved_savings,reserved_commission").eq("member_id",member.id).maybeSingle();
    const penaltyTotal=Number(member.total_penalty||0);
    const unpaidWeeks=Number(member.unpaid_weeks||0);
    $("totalPenalty").textContent=fmt(penaltyTotal);
    $("unpaidWeeks").textContent=String(unpaidWeeks)+" semaine(s)";
    const {data:penalties,error:penaltyError}=await db.from("member_penalties").select("week_date,amount,status").eq("member_id",member.id).order("week_date",{ascending:false});
    if(penaltyError){
      msg("penaltyMsg","Tsy afaka mamaky ny historique pénalité: "+penaltyError.message,true);
    }else{
      const penaltyRows=(penalties||[]).map(x=>[
        date(x.week_date),
        fmt(x.amount),
        String(x.status||"").toLowerCase()==="paid"?"Voaloa":String(x.status||"").toLowerCase()==="unpaid"?"Tsy mbola voaloa":x.status||""
      ]);
      renderTable("myPenalties",["Herinandro","Vola","Sata"],penaltyRows);
      msg("penaltyMsg",penaltyTotal>0?"Pénalité voarakitra ao amin'ny kaontinao.":"Tsy mbola misy pénalité voarakitra.");
    }
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
    $("totalPenalty").textContent=fmt(0);$("unpaidWeeks").textContent="0 semaine(s)";
    msg("penaltyMsg","Tsy mbola misy pénalité.");
    renderTable("myPenalties",["Herinandro","Vola","Sata"],[]);
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

$("toggleMyReferralsBtn").addEventListener("click",()=>{
  const content=$("myReferralsContent");
  const opening=content.classList.contains("hidden");
  content.classList.toggle("hidden",!opening);
  $("toggleMyReferralsBtn").setAttribute("aria-expanded",String(opening));
  $("toggleMyReferralsBtn").querySelector(".referrals-toggle-icon").textContent=opening?"−":"＋";
});

async function loadMyReferrals(member){
  const panel=$("myReferralsPanel");
  if(!member || String(member.status).toLowerCase()!=="active"){
    show("myReferralsPanel",false);
    return;
  }
  show("myReferralsPanel",true);
  const {data:earnedCommissions,error:earnedError}=await db.from("referral_commissions").select("amount").eq("member_id",member.id);
  const earnedTotal=(earnedCommissions||[]).reduce((sum,item)=>sum+Number(item.amount||0),0);
  $("referralEarnedTotal").textContent=earnedError?"Bonus: — USDT":"Bonus: "+earnedTotal.toFixed(8)+" USDT";
  show("myReferralsContent",false);
  $("toggleMyReferralsBtn").setAttribute("aria-expanded","false");
  $("toggleMyReferralsBtn").querySelector(".referrals-toggle-icon").textContent="＋";
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
function subscribeCommunityRoster(){
  if(communityRosterChannel) db.removeChannel(communityRosterChannel);
  communityRosterChannel=db.channel("community-roster-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"members"},()=>{
      loadCommunityLists();
    })
    .subscribe();
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
    // Show ACTIVE members first and move PENDING members to the end.
    // Keep the original member_number values and preserve order within each status.
    const orderedRoster=[...(roster||[])].sort((a,b)=>{
      const rank=status=>{
        const value=String(status||"").toLowerCase();
        return value==="active"?0:value==="pending"?2:1;
      };
      return rank(a.member_status)-rank(b.member_status);
    });
    renderTable("memberRoster",["Laharana","Anarana","Sata","Daty nidirana"],orderedRoster.map(x=>[x.member_number,x.full_name,x.member_status,date(x.joined_at)]));
    if(currentProfile?.role!=="admin" && currentMember){
      const myName=currentMember.full_name||currentProfile?.full_name||"";
      const myIndex=orderedRoster.findIndex(x=>String(x.full_name||"").trim().toLowerCase()===String(myName).trim().toLowerCase());
      if(myIndex>=0){
        const myNumber=orderedRoster[myIndex].member_number||myIndex+1;
        $("rolePill").textContent=String(myNumber)+"/"+String(roster.length);
      } else {
        $("rolePill").textContent="MEMBRE";
      }
    }
  }
  if(turnError) turnEl.innerHTML='<p class="error">Tsy afaka mamaky ny lisitry ny tours: '+esc(turnError.message)+'</p>';
  else {
    // In the community section, show only turns assigned to ACTIVE members.
    // Sort by scheduled date first, then by the official turn number.
    const activeNames=new Set((roster||[])
      .filter(x=>String(x.member_status||"").toLowerCase()==="active")
      .map(x=>String(x.full_name||"").trim().toLowerCase()));
    const activeTurns=(turns||[])
      .filter(x=>activeNames.has(String(x.receiver_name||"").trim().toLowerCase()))
      .sort((a,b)=>{
        const da=String(a.scheduled_date||"9999-12-31");
        const db=String(b.scheduled_date||"9999-12-31");
        return da.localeCompare(db)||Number(a.turn_number||0)-Number(b.turn_number||0);
      });
    renderTurnRows("publicTurnList",activeTurns.map(x=>({turn_number:x.turn_number,scheduled_date:x.scheduled_date,receiver_name:x.receiver_name,status:x.turn_status,faucetpay_tx_id:x.faucetpay_tx_id,paid_at:x.paid_at})),false);
  }
}
function turnStatusBadge(status){
  const value=String(status||"").toLowerCase();
  const label=value==="paid"?"PAID":value==="waiting"?"WAITING":String(status||"—").toUpperCase();
  const cls=value==="paid"?"paid":value==="waiting"?"waiting":"other";
  return '<span class="turn-status-badge '+cls+'">'+esc(label)+'</span>';
}
function renderTurnRows(target,rows,withActions){
  const el=$(target);
  if(!rows.length){el.innerHTML='<p class="muted">Tsy mbola misy tour.</p>';return;}
  const heads=["Tour","Daty","Mpandray","Sata"];
  if(withActions) heads.push("Gross","Épargne","Net à envoyer");
  heads.push("FaucetPay TxID","Daty nandoavana");
  el.innerHTML="<table><thead><tr>"+heads.map(h=>'<th>'+esc(h)+'</th>').join("")+(withActions?"<th>Action</th>":"")+"</tr></thead><tbody>"+
    rows.map(t=>{
      const amountCells=withActions
        ? '<td>'+esc(fmt(t.gross_amount))+'</td><td>'+esc(fmt(t.savings_amount))+'</td><td><strong>'+esc(fmt(t.net_amount))+'</strong></td>'
        : "";
      const actionCell=withActions
        ? '<td>'+(String(t.status||"").toLowerCase()==="waiting"
          ? '<button class="action" data-action="mark-turn-paid" data-type="turn" data-id="'+esc(String(t.id))+'" data-net-amount="'+esc(String(t.net_amount??0))+'" data-receiver-name="'+esc(t.receiver_name||"Mpandray")+'">CONFIRMER PAIEMENT + TxID</button>'
          : "—")+'</td>'
        : "";
      return '<tr><td>'+esc(String(t.turn_number??""))+'</td><td>'+esc(dateOnly(t.scheduled_date))+'</td><td>'+esc(t.receiver_name||"—")+'</td><td>'+turnStatusBadge(t.status)+'</td>'+amountCells+'<td>'+esc(t.faucetpay_tx_id||"—")+'</td><td>'+esc(date(t.paid_at)||"—")+'</td>'+actionCell+'</tr>';
    }).join("")+
    "</tbody></table>";
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
  loadDepositDue(currentMember);
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
  if(button) button.disabled=true;
  depositMessage("Havaozina aloha ny kajy contribution sy pénalité...");
  try{
    const due=await loadDepositDue(currentMember);
    if(!due) throw new Error("Tsy afaka nanamarina ny vola tokony haloanao. Havaozy ny pejy ary andramo indray.");
    if(Number(due.amount)<=0) throw new Error("Tsy misy vola tokony haloanao amin'izao fotoana izao.");
    if(!form.reportValidity()) return;
    if(Number($("depositAmount").value)!==Number(due.amount) || $("depositType").value!==due.payment_type){
      throw new Error("Niova ny kajy dépôt. Hamarino indray ny vola aseho.");
    }
    depositMessage("Alefa any amin'ny serveur ny fangatahana dépôt...");
    const {data,error}=await db.rpc("submit_deposit_request",{
      p_amount:Number(due.amount),
      p_faucetpay_email:$("depositEmail").value.trim(),
      p_tx_hash:$("depositTx").value.trim(),
      p_payment_type:due.payment_type
    });
    if(error) throw error;
    form.reset();
    configureDepositOptions(currentMember);
    depositMessage("Voaray ny fangatahana dépôt. Mbola miandry fanamarinana.");
    await loadMemberData();
  }catch(error){
    depositMessage("Tsy tafiditra ny fangatahana dépôt: "+(error?.message||String(error)),true);
  }finally{
    if(button) button.disabled=!currentDepositDue || Number(currentDepositDue.amount)<=0;
  }
});
function updateWithdrawalMinimum(){
  const type=$("withdrawType").value;
  const minimum=type==="commission"?1:15;
  $("withdrawAmount").min=String(minimum);
  $("withdrawAmount").placeholder="Minimum "+minimum+" USDT";
  $("withdrawMinimumInfo").textContent="Minimum: "+minimum+" USDT";
}
$("withdrawType").addEventListener("change",updateWithdrawalMinimum);
updateWithdrawalMinimum();
$("withdrawForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!currentUser)return;
  const type=$("withdrawType").value;
  const amount=Number($("withdrawAmount").value);
  const minimum=type==="commission"?1:15;
  if(!Number.isFinite(amount)||amount<minimum){
    return msg("globalMsg","Minimum retrait "+(type==="commission"?"Commission":"Épargne/Mining")+" = "+minimum+" USDT.",true);
  }
  msg("globalMsg","Alefa ny fangatahana retrait...");
  const {data,error}=await db.rpc("submit_withdrawal_request",{p_amount:amount,p_faucetpay_email:$("withdrawEmail").value.trim(),p_withdrawal_type:type});
  if(error)return msg("globalMsg",error.message,true);
  e.target.reset();updateWithdrawalMinimum();msg("globalMsg","Voaray ny fangatahana retrait. Ny vola dia voatokana mandra-pitsarana.");
  await loadMemberData();
});

async function loadAdminData(){
  const {data:d,error:de}=await db.from("deposit_requests").select("id,member_id,amount,payment_type,status,tx_hash,faucetpay_email,created_at").order("created_at",{ascending:false});
  if(de){msg("globalMsg","Dépôt admin: "+de.message,true);return;}
  $("adminDeposits").innerHTML=tableWithActions(["Vola","Karazana","Sata","TxID","Email FaucetPay","Daty"],(d||[]).map(x=>({id:x.id,status:x.status,values:[fmt(x.amount),x.payment_type,x.status,x.tx_hash||"",x.faucetpay_email,date(x.created_at)]})), "deposit");
  const {data:w,error:we}=await db.from("withdrawal_requests").select("id,member_id,amount,status,withdrawal_type,faucetpay_email,faucetpay_tx_id,created_at").order("created_at",{ascending:false});
  if(we){msg("globalMsg","Retrait admin: "+we.message,true);return;}
  $("adminWithdrawals").innerHTML=tableWithActions(["Vola","Karazana","Sata","Email FaucetPay","Transaction ID","Daty"],(w||[]).map(x=>({id:x.id,status:x.status,values:[fmt(x.amount),x.withdrawal_type,x.status,x.faucetpay_email,x.faucetpay_tx_id||"—",date(x.created_at)]})),"withdrawal");
  const {data:m,error:me}=await db.from("members").select("id,full_name,phone,status,created_at,activated_at").order("created_at",{ascending:false});
  if(me){msg("globalMsg","Membre admin: "+me.message,true);return;}
  renderMemberTable(m||[]);
  await loadAdminWeeklyContributions(m||[]);
  await loadAdminTurns();
  await loadAdminLudoSCRequests();
  await loadAdminLudoWithdrawals();

}
async function loadAdminWeeklyContributions(members){
  const paidHost=$("adminContributionsPaid");
  const unpaidHost=$("adminContributionsUnpaid");
  if(!paidHost||!unpaidHost)return;
  paidHost.innerHTML='<p class="muted">Ampidirina...</p>';
  unpaidHost.innerHTML='<p class="muted">Ampidirina...</p>';
  const active=(members||[]).filter(m=>String(m.status||"").toLowerCase()==="active");
  if(!active.length){
    paidHost.innerHTML='<p class="muted">Tsy mbola misy mpikambana ACTIVE.</p>';
    unpaidHost.innerHTML='<p class="muted">Tsy mbola misy mpikambana ACTIVE.</p>';
    return;
  }
  const ids=active.map(m=>m.id);
  const [{data:contributions,error:ce},{data:penalties,error:pe}]=await Promise.all([
    db.from("contributions").select("id,member_id,amount,paid_at,status,week_date,created_at").in("member_id",ids).eq("status","approved").order("paid_at",{ascending:false}),
    db.from("member_penalties").select("id,member_id,week_date,amount,status,created_at").in("member_id",ids).order("week_date",{ascending:false})
  ]);
  if(ce||pe){
    const errorText=[ce&&("Contribution: "+ce.message),pe&&("Pénalité: "+pe.message)].filter(Boolean).join(" · ");
    paidHost.innerHTML='<p class="muted">Tsy afaka namaky ny angona: '+esc(errorText)+'</p>';
    unpaidHost.innerHTML='<p class="muted">Tsy afaka namaky ny angona: '+esc(errorText)+'</p>';
    return;
  }
  const localDateKey=value=>{
    if(!value)return "";
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return "";
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Indian/Antananarivo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t)?.value||"";
    return get("year")+"-"+get("month")+"-"+get("day");
  };
  const dateKey=value=>{
    if(!value)return "";
    const str=String(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(str))return str;
    return localDateKey(str);
  };
  const plusDays=(key,n)=>{
    const [y,m,d]=key.split("-").map(Number);
    const x=new Date(Date.UTC(y,m-1,d+n));
    return x.toISOString().slice(0,10);
  };
  const saturdayOnOrAfter=key=>{
    const [y,m,d]=key.split("-").map(Number);
    const weekday=new Date(Date.UTC(y,m-1,d)).getUTCDay();
    return plusDays(key,(6-weekday+7)%7);
  };
  const today=localDateKey(new Date());
  const endWeek=saturdayOnOrAfter(today);
  const names=new Map(active.map(m=>[m.id,m.full_name||"—"]));
  const paidByWeek=new Map();
  (contributions||[]).forEach(c=>{
    let wk=dateKey(c.week_date);
    if(!wk&&c.paid_at){
      const paidDay=localDateKey(c.paid_at);
      const [y,mo,d]=paidDay.split("-").map(Number);
      if(new Date(Date.UTC(y,mo-1,d)).getUTCDay()===6)wk=paidDay;
    }
    if(!wk)return;
    const key=c.member_id+"|"+wk;
    const existing=paidByWeek.get(key);
    if(!existing||new Date(c.paid_at||c.created_at||0)>new Date(existing.paid_at||existing.created_at||0))paidByWeek.set(key,c);
  });
  const penaltyByWeek=new Map();
  (penalties||[]).forEach(p=>{
    const key=p.member_id+"|"+dateKey(p.week_date);
    const prev=penaltyByWeek.get(key);
    if(!prev||String(p.status).toLowerCase()==="unpaid")penaltyByWeek.set(key,p);
  });
  const paidRows=[];
  const unpaidByMember=new Map();
  active.forEach(m=>{
    const activated=dateKey(m.activated_at||m.created_at);
    if(!activated)return;
    let wk=saturdayOnOrAfter(activated);
    while(wk<=endWeek){
      const key=m.id+"|"+wk;
      const payment=paidByWeek.get(key);
      const penalty=penaltyByWeek.get(key);
      const penaltyStatus=String(penalty?.status||"").toLowerCase();
      const penaltyAmount=penaltyStatus==="unpaid"?Number(penalty.amount||0):0;
      if(payment){
        paidRows.push([m.full_name||"—",dateOnly(wk),fmt(payment.amount),date(payment.paid_at||payment.created_at)||"—"]);
      }
      if(!payment||penaltyAmount>0){
        let summary=unpaidByMember.get(m.id);
        if(!summary){
          summary={name:m.full_name||"—",oldWeeks:[],oldAmount:0,newAmount:0,penaltyAmount:0,penaltyWeeks:[]};
          unpaidByMember.set(m.id,summary);
        }
        if(!payment){
          if(wk===endWeek)summary.newAmount+=3;
          else {summary.oldWeeks.push(dateOnly(wk));summary.oldAmount+=3;}
        }
        if(penaltyAmount>0){
          summary.penaltyAmount+=penaltyAmount;
          summary.penaltyWeeks.push(dateOnly(wk));
        }
      }
      wk=plusDays(wk,7);
    }
  });
  paidRows.sort((a,b)=>String(b[1]).localeCompare(String(a[1]))||String(a[0]).localeCompare(String(b[0])));
  const unpaidRows=[...unpaidByMember.values()]
    .filter(x=>x.oldAmount+x.newAmount+x.penaltyAmount>0)
    .sort((a,b)=>a.name.localeCompare(b.name))
    .map(x=>[
      x.name,
      x.oldWeeks.length?x.oldWeeks.join(", "):"—",
      fmt(x.oldAmount),
      fmt(x.newAmount),
      fmt(x.penaltyAmount),
      fmt(x.oldAmount+x.newAmount+x.penaltyAmount),
      x.penaltyWeeks.length?"Misy pénalité tsy voaloa":"Contribution tsy vita"
    ]);
  if(!paidRows.length){
    paidHost.innerHTML='<p class="muted">Tsy mbola misy contribution voaloa.</p>';
  }else{
    const weekColors=new Map();
    const weekKeys=[...new Set(paidRows.map(row=>String(row[1])))].sort((a,b)=>b.localeCompare(a));
    weekKeys.forEach((week,index)=>weekColors.set(week,index%2===0?"weekly-week-a":"weekly-week-b"));
    paidHost.innerHTML="<table><thead><tr>"+["Mpikambana","Herinandro / Tour","Contribution","Daty nandoavana"].map(h=>'<th>'+esc(h)+'</th>').join("")+"</tr></thead><tbody>"+
      paidRows.map(row=>'<tr class="'+weekColors.get(String(row[1]))+'">'+row.map(value=>'<td>'+esc(String(value??""))+'</td>').join("")+"</tr>").join("")+
      "</tbody></table>";
  }
  renderTable("adminContributionsUnpaid",["Mpikambana","Herinandro taloha tsy voaloa","Trosa taloha","Contribution vaovao","Pénalité tsy voaloa","TOTAL tokony haloana","Sata"],unpaidRows);
}
async function loadAdminLudoSCRequests(){
  const host=$("adminLudoSCRequests");
  if(!host) return;
  host.innerHTML='<p class="muted">Ampidirina...</p>';
  const {data,error}=await db.from("ludo_sc_requests")
    .select("id,member_id,requested_sc,request_message,status,admin_message,created_at")
    .order("created_at",{ascending:false});
  if(error){host.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  if(!data?.length){host.innerHTML='<p class="muted">Tsy mbola misy fangatahana SC.</p>';return;}
  const ids=[...new Set(data.map(x=>x.member_id))];
  const {data:members,error:memberError}=await db.from("members").select("id,full_name").in("id",ids);
  if(memberError){host.innerHTML='<p class="error">'+esc(memberError.message)+'</p>';return;}
  const names=new Map((members||[]).map(x=>[x.id,x.full_name]));
  host.innerHTML="<table><thead><tr><th>Mpikambana</th><th>SC angatahina</th><th>Hafatra</th><th>Sata</th><th>Valin'ny Admin</th><th>Daty</th><th>Action</th></tr></thead><tbody>"+
    data.map(x=>'<tr><td>'+esc(names.get(x.member_id)||"—")+'</td><td>'+Number(x.requested_sc).toLocaleString("fr-FR")+'</td><td>'+esc(x.request_message)+'</td><td>'+esc(x.status.toUpperCase())+'</td><td>'+esc(x.admin_message||"—")+'</td><td>'+esc(date(x.created_at))+'</td><td>'+(x.status==="pending"?'<button class="action" data-action="review-ludo-sc" data-decision="approved" data-id="'+esc(x.id)+'">CONFIRMER</button> <button class="action reject" data-action="review-ludo-sc" data-decision="rejected" data-id="'+esc(x.id)+'">REFUSER</button>':"—")+'</td></tr>').join("")+
    "</tbody></table>";
}

async function loadAdminLudoWithdrawals(){
  const host=$("adminLudoWithdrawals");
  if(!host) return;
  host.innerHTML='<p class="muted">Ampidirina...</p>';
  const {data,error}=await db.from("ludo_withdrawal_requests")
    .select("id,member_id,amount_sc,amount_usdt,faucetpay_email,status,admin_message,faucetpay_tx_id,created_at")
    .order("created_at",{ascending:false});
  if(error){host.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  if(!data?.length){host.innerHTML='<p class="muted">Tsy mbola misy fangatahana retrait Ludo.</p>';return;}
  const ids=[...new Set(data.map(x=>x.member_id))];
  const {data:members,error:memberError}=await db.from("members").select("id,full_name").in("id",ids);
  if(memberError){host.innerHTML='<p class="error">'+esc(memberError.message)+'</p>';return;}
  const names=new Map((members||[]).map(x=>[x.id,x.full_name]));
  host.innerHTML='<div class="table-wrap"><table><thead><tr><th>Mpikambana</th><th>SC</th><th>USDT</th><th>Email FaucetPay</th><th>Sata</th><th>TxID</th><th>Daty</th><th>Action</th></tr></thead><tbody>'+
    data.map(x=>{
      let action="—";
      if(x.status==="pending") action='<button class="action" data-action="review-ludo-withdrawal" data-decision="approved" data-id="'+esc(x.id)+'">APPROUVER</button> <button class="action reject" data-action="review-ludo-withdrawal" data-decision="rejected" data-id="'+esc(x.id)+'">REFUSER</button>';
      else if(x.status==="approved") action='<button class="action" data-action="complete-ludo-withdrawal" data-id="'+esc(x.id)+'">CONFIRMER PAIEMENT + TxID</button>';
      return '<tr><td>'+esc(names.get(x.member_id)||"—")+'</td><td>'+Number(x.amount_sc).toLocaleString("fr-FR")+'</td><td>'+Number(x.amount_usdt).toFixed(3)+'</td><td>'+esc(x.faucetpay_email)+'</td><td>'+esc(String(x.status).toUpperCase())+'</td><td>'+esc(x.faucetpay_tx_id||"—")+'</td><td>'+esc(date(x.created_at))+'</td><td>'+action+'</td></tr>';
    }).join("")+
    '</tbody></table></div>';
}

async function loadAdminTurns(){

  const [{data:current,error:currentError},{data:history,error:historyError}]=await Promise.all([
    db.from("member_turns").select("id,turn_number,scheduled_date,status,gross_amount,savings_amount,net_amount,faucetpay_tx_id,paid_at,members(full_name)").order("turn_number",{ascending:true}),
    db.from("member_turns_history").select("history_id,member_id,turn_number,scheduled_date,status,gross_amount,savings_amount,net_amount,faucetpay_tx_id,paid_at").order("turn_number",{ascending:true})
  ]);
  if(currentError){msg("globalMsg","Lisitra tour admin: "+currentError.message,true);return;}
  if(historyError){msg("globalMsg","Historique tour admin: "+historyError.message,true);return;}
  const historyMemberIds=[...new Set((history||[]).map(t=>t.member_id).filter(Boolean))];
  const {data:historyMembers,error:historyMembersError}=historyMemberIds.length
    ? await db.from("members").select("id,full_name").in("id",historyMemberIds)
    : {data:[],error:null};
  if(historyMembersError){msg("globalMsg","Anaran'ny mpandray ao amin'ny historique: "+historyMembersError.message,true);return;}
  const historyNames=new Map((historyMembers||[]).map(m=>[m.id,m.full_name]));
  const rows=[
    ...(history||[]).map(t=>({id:t.history_id,status:t.status,turn_number:t.turn_number,scheduled_date:t.scheduled_date,receiver_name:historyNames.get(t.member_id)||"—",gross_amount:t.gross_amount,savings_amount:t.savings_amount,net_amount:t.net_amount,faucetpay_tx_id:t.faucetpay_tx_id,paid_at:t.paid_at})),
    ...(current||[]).map(t=>({id:t.id,status:t.status,turn_number:t.turn_number,scheduled_date:t.scheduled_date,receiver_name:t.members?.full_name||"—",gross_amount:t.gross_amount,savings_amount:t.savings_amount,net_amount:t.net_amount,faucetpay_tx_id:t.faucetpay_tx_id,paid_at:t.paid_at}))
  ].sort((x,y)=>Number(x.turn_number)-Number(y.turn_number));
  renderTurnRows("adminTurns",rows,true);
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
  if(decision==="review-ludo-sc"){
    const review=b.dataset.decision;
    let adminMessage=null;
    if(review==="rejected"){
      adminMessage=prompt("Antony na hafatra fanazavana (tsy maintsy fenoina):");
      if(adminMessage===null)return;
      if(!adminMessage.trim()){alert("Ilaina ny hafatra fanazavana rehefa mandà.");return;}
    }else if(!confirm("Hampiditra ny SC angatahina ao amin'ny solde Ludo ve? Tsy azo averina indroa ity crédit ity."))return;
    b.disabled=true;
    const {error}=await db.rpc("review_ludo_sc_request",{p_request_id:id,p_decision:review,p_admin_message:adminMessage});
    if(error){msg("globalMsg","Fangatahana SC: "+error.message,true);b.disabled=false;return;}
    msg("globalMsg",review==="approved"?"Voamarina ny fangatahana ary nampidirina ao amin'ny solde Ludo ny SC.":"Nolavina ny fangatahana ary voatahiry ny fanazavana.");
    await loadAdminLudoSCRequests();
    await loadLudoGameState();
    return;
  }


  if(decision==="review-ludo-withdrawal"){
    const review=b.dataset.decision;
    let note=null;
    if(review==="rejected"){
      note=prompt("Antony handavana ny retrait (tsy maintsy fenoina):");
      if(note===null)return;
      if(!note.trim())return alert("Ilaina ny antony handavana.");
    }else if(!confirm("Hankato ny fangatahana retrait Ludo ve? Hamarino fa misy vola ampy ao amin'ny mpamatsy alohan'ny handoavana."))return;
    b.disabled=true;
    const {error}=await db.rpc("review_ludo_withdrawal_request",{
      p_request_id:id,p_decision:review,p_admin_message:note
    });
    if(error){msg("globalMsg",error.message,true);b.disabled=false;return;}
    msg("globalMsg",review==="approved"?"Nankatoavina ny retrait Ludo. Alefaso ny paiement vao ampidirina ny TxID.":"Nolavina ny retrait Ludo ary naverina amin'ny solde SC ilay vola.");
    await loadAdminLudoWithdrawals();
    await loadLudoWithdrawalData();
    await loadLudoHeaderBalance();
    return;
  }
  if(decision==="complete-ludo-withdrawal"){
    if(!confirm("Efa nalefanao tamin'ny FaucetPay ve ny vola?"))return;
    const txid=prompt("Ampidiro ny FaucetPay Transaction ID (obligatoire):");
    if(txid===null)return;
    if(!txid.trim())return alert("Tsy maintsy misy FaucetPay TxID.");
    b.disabled=true;
    const {error}=await db.rpc("finalize_ludo_withdrawal_request",{
      p_request_id:id,p_faucetpay_tx_id:txid.trim()
    });
    if(error){msg("globalMsg",error.message,true);b.disabled=false;return;}
    msg("globalMsg","Vita ny retrait Ludo. Voatahiry ny FaucetPay TxID.");
    await loadAdminLudoWithdrawals();
    await loadLudoWithdrawalData();
    await loadLudoHeaderBalance();
    return;
  }

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
    const netAmount=Number(b.dataset.netAmount||0);
    const receiverName=b.dataset.receiverName||"mpandray tour";
    if(!Number.isFinite(netAmount)||netAmount<=0){
      alert("Tsy mbola voafaritra ny Net à envoyer. Havaozy ny liste Waiting ary aza manamarina aloha.");
      return;
    }
    if(!confirm("Hamarino ny transfert: "+fmt(netAmount)+" no tokony halefa amin'i "+receiverName+". Efa nalefanao tokoa ve io vola io?"))return;
    const txid=prompt("Ampidiro ny FaucetPay Transaction ID an'ilay transfert "+fmt(netAmount)+":");
    if(txid===null)return;
    if(!txid.trim())return alert("Tsy maintsy ampidirina ny FaucetPay Transaction ID.");
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
