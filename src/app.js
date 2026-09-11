import{RESOURCES,LABELS,ICONS,COSTS,COLORS,makeGame,roll,countResources,canAfford,legalRoads,legalSettlements,legalCities,placeRoad,placeSettlement,placeCity,trade,tradeRatio,drawCard,legalInitialSettlements,placeInitialSettlement,legalInitialRoads,placeInitialRoad,pickAiInitialSettlement,aiPlan,applyAiAction,checkWinner,blocked,pendingDiscards,discardNeeded,discardCards,autoDiscard,legalRobberTiles,moveRobber,aiChooseRobber,playCard}from'./engine.js?v=2.1.0';

const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),NS='http://www.w3.org/2000/svg',svg=$('#island');
const sx=x=>260+x*49,sy=y=>245+y*49,sleep=ms=>new Promise(r=>setTimeout(r,ms));
let game=null,mode=null,scale=1,busy=false,setup=null,muted=false;

/* ============ 音效（用 Web Audio 即時合成，唔使外部檔案）============ */
let AC=null;
function initAudio(){try{if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch{}}
function tone(freq,dur,type='sine',vol=.2,delay=0){if(muted||!AC)return;const t=AC.currentTime+delay,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=freq;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.02)}
function clack(vol=.28,delay=0){if(muted||!AC)return;const t=AC.currentTime+delay,len=.05,buf=AC.createBuffer(1,AC.sampleRate*len,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const src=AC.createBufferSource();src.buffer=buf;const g=AC.createGain(),f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=900;g.gain.value=vol;src.connect(f);f.connect(g);g.connect(AC.destination);src.start(t)}
const sfx={
  dice(){for(let i=0;i<6;i++)clack(.26,i*.09)},
  build(){tone(190,.16,'triangle',.32);tone(120,.22,'sine',.26,.05)},
  card(){tone(680,.11,'sine',.16);tone(920,.12,'sine',.14,.06)},
  coin(){tone(1046,.08,'square',.1);tone(1318,.1,'square',.09,.07)},
  win(){[523,659,784,1046].forEach((f,i)=>tone(f,.32,'triangle',.24,i*.13))}
};

/* ============ SVG 小工具 ============ */
function S(tag,attrs={},text=''){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e}
function polygon(t){return t.vertices.map(id=>`${sx(game.vertices[id].x)},${sy(game.vertices[id].y)}`).join(' ')}

function renderBoard(){
  svg.innerHTML='';
  for(const t of game.tiles){
    const g=S('g',{'data-tile':t.id,class:`tile ${t.type}`});
    g.append(S('polygon',{points:polygon(t),class:'land'}));
    const cx=sx(Math.sqrt(3)*(t.q+t.r/2)),cy=sy(1.5*t.r);
    g.append(S('text',{x:cx,y:cy-7,class:'terrain'},ICONS[t.type]||'🏝️'));
    if(t.id===game.robber)g.append(S('text',{x:cx,y:cy-7,class:'robber'},'🏴‍☠️'));
    if(t.type!=='desert'){g.append(S('circle',{cx,cy:cy+13,r:15,class:`token n${t.num}`}));g.append(S('text',{x:cx,y:cy+18,class:`number n${t.num}`},t.num))}
    g.onclick=()=>chooseTile(t.id);
    svg.append(g)
  }
  for(const p of game.ports){const e=game.edges[p.edge],a=game.vertices[e.a],b=game.vertices[e.b],mx=(sx(a.x)+sx(b.x))/2,my=(sy(a.y)+sy(b.y))/2,dx=mx-260,dy=my-245,len=Math.hypot(dx,dy),x=mx+dx/len*25,y=my+dy/len*25,pg=S('g',{class:'port'});pg.append(S('circle',{cx:x,cy:y,r:18}));pg.append(S('text',{x,y:y+3},p.kind==='any'?'⚓':ICONS[p.kind]));pg.append(S('text',{x,y:y+15,class:'ratio'},p.ratio+':1'));svg.append(pg)}
  for(const e of game.edges){const a=game.vertices[e.a],b=game.vertices[e.b],line=S('line',{x1:sx(a.x),y1:sy(a.y),x2:sx(b.x),y2:sy(b.y),class:`edge ${e.owner!==null?'built p'+e.owner:''}`,'data-edge':e.id});line.onclick=()=>chooseEdge(e.id);svg.append(line)}
  for(const v of game.vertices){const node=S('g',{class:`vertex ${v.owner!==null?'built p'+v.owner:''}`,'data-vertex':v.id,transform:`translate(${sx(v.x)} ${sy(v.y)})`});node.append(S('circle',{r:v.level===2?13:10}));if(v.owner!==null)node.append(S('path',{d:v.level===2?'M-8 6V-7H8V6ZM-5-7V-12H2V-7Z':'M-8 7V-3L0-10L8-3V7Z'}));node.onclick=()=>chooseVertex(v.id);svg.append(node)}
  setHighlights()
}
function setHighlights(){
  svg.querySelectorAll('.legal').forEach(e=>e.classList.remove('legal'));
  if(mode==='robber')for(const id of legalRobberTiles(game))svg.querySelector(`[data-tile="${id}"]`)?.classList.add('legal-tile');
  else if(mode==='initSettle')for(const id of legalInitialSettlements(game))svg.querySelector(`[data-vertex="${id}"]`)?.classList.add('legal');
  else if(mode==='initRoad'&&setup)for(const id of legalInitialRoads(game,0,setup.vid))svg.querySelector(`[data-edge="${id}"]`)?.classList.add('legal');
  else if(mode==='road')for(const id of legalRoads(game,0))svg.querySelector(`[data-edge="${id}"]`)?.classList.add('legal');
  else if(mode==='settlement')for(const id of legalSettlements(game,0))svg.querySelector(`[data-vertex="${id}"]`)?.classList.add('legal');
  else if(mode==='city')for(const id of legalCities(game,0))svg.querySelector(`[data-vertex="${id}"]`)?.classList.add('legal')
}

/* ============ 棋盤點擊 ============ */
function chooseEdge(id){
  if(busy)return;
  if(mode==='initRoad'){if(placeInitialRoad(game,0,id)){mode=null;render();flashEdge(id);sfx.build();setup.idx++;advanceSetup()}return}
  if(mode==='road'){const wasFree=game.freeRoads>0;if(placeRoad(game,0,id)){flashEdge(id);sfx.build();if(wasFree&&game.freeRoads>0){render();toast('免費築路：仲可以起多一條');return}mode=null;render()}}
}
function chooseTile(id){
  if(busy||mode!=='robber')return;
  const res=moveRobber(game,0,id);if(!res)return;
  mode=null;sfx.build();flashTile(id);render();
  if(res.steal)toast(`🏴‍☠️ 掠奪 ${game.players[res.steal.from].name} 一份${LABELS[res.steal.res]}`);
  else toast('🏴‍☠️ 海盜就位，封鎖該島');
}
function flashTile(id){const el=svg.querySelector(`[data-tile="${id}"]`);if(el){el.classList.add('just');setTimeout(()=>el.classList.remove('just'),800)}}
function beginRobber(msg){mode='robber';busy=false;game.log=msg||'揀一塊島放置海盜，封鎖佢生產。';$('#ticker').textContent=game.log;render();toast('🏴‍☠️ 揀一塊發光島嶼放海盜')}
function chooseVertex(id){
  if(busy)return;
  if(mode==='initSettle'){if(placeInitialSettlement(game,0,id)){setup.vid=id;mode='initRoad';render();flashVertex(id);sfx.build()}return}
  const ok=mode==='settlement'?placeSettlement(game,0,id):mode==='city'?placeCity(game,0,id):false;
  if(ok){mode=null;render();flashVertex(id);sfx.build()}
}

/* ============ 主畫面 ============ */
function modePrompt(){
  if(mode==='robber')return '揀一塊發光島嶼，放置海盜封鎖佢生產（並掠奪一份物資）。';
  if(mode==='initSettle')return '開局：喺地圖揀一個發光交點，建立你嘅村莊。';
  if(mode==='initRoad')return '開局：再揀一條連住村莊嘅發光航線。';
  if(mode==='road'&&game.freeRoads>0)return `免費築路：喺發光航線起（仲有 ${game.freeRoads} 條）。`;
  const w=mode==='road'?'邊線':mode==='city'?'村莊':'交點';
  return `請喺地圖選擇發光嘅${w}；再按一次可取消。`
}
function render(){
  if(!game)return;checkWinner(game);const me=game.players[0];
  const action=game.phase==='action',blk=blocked(game),roadFree=game.freeRoads>0;
  $('#round').textContent=game.round;
  $('#score').textContent=me.score;$('#roads').textContent=me.roads;$('#cards').textContent=me.cards.length;
  $('#handCount').textContent=me.cards.length;
  $('#ticker').textContent=mode?modePrompt():game.log;
  $('#dice').textContent=game.dice?game.dice.map(face).join(' '):'⚄ ⚂';
  $('#rivals').innerHTML=game.players.slice(1).map(p=>`<article class="rv${p.id}${game.turn===p.id&&busy?' active':''}"><span style="--pc:${COLORS[p.id]}">${p.name[0]}</span><div><b>${p.name}</b><small>${p.score} 分 · ${countResources(p)} 物資 · 🃏${p.cards.length}</small></div></article>`).join('');
  $('#resources').innerHTML=RESOURCES.map(r=>`<div data-res="${r}"><span>${ICONS[r]}</span><b>${me.resources[r]}</b><small>${LABELS[r]}</small></div>`).join('');
  // 只顯示當前階段主掣（慳位）
  $('#rollBtn').hidden=game.phase!=='roll';$('#endTurn').hidden=game.phase==='roll';
  $('#rollBtn').disabled=busy||game.phase!=='roll';
  $('#endTurn').disabled=busy||!action||blk;
  $('#buildToggle').disabled=busy||!action||blk;
  $('#handBtn').disabled=busy||!me.cards.length;
  $$('[data-build]').forEach(b=>{const type=b.dataset.build,legal=type==='road'?legalRoads(game,0):type==='settlement'?legalSettlements(game,0):legalCities(game,0);const afford=(type==='road'&&roadFree)||canAfford(me,COSTS[type]);b.disabled=busy||!action||blk||!afford||!legal.length;b.classList.toggle('selected',mode===type)});
  $('#cardBtn').disabled=busy||!action||blk||!canAfford(me,COSTS.card);
  $('#tradeBtn').disabled=busy||!action||blk||!RESOURCES.some(r=>me.resources[r]>=tradeRatio(me,r));
  if(blk&&!$('#buildPanel').hidden){$('#buildPanel').hidden=true;$('#buildToggle').classList.remove('open')}
  renderBoard();showEnd()
}
function face(n){return['⚀','⚁','⚂','⚃','⚄','⚅'][n-1]}

/* ============ 骰仔動畫（有實體點數同碌動感）============ */
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function die(n,cls=''){return `<div class="die ${cls}">${Array.from({length:9},(_,i)=>`<i class="${PIPS[n].includes(i)?'on':''}"></i>`).join('')}</div>`}
async function animateDice(a,b){
  const roller=$('#diceRoller');roller.classList.add('show','rolling');sfx.dice();
  await new Promise(res=>{const start=performance.now(),dur=780;(function frame(t){if(t-start<dur){const r=()=>1+Math.floor(Math.random()*6);roller.innerHTML=die(r())+die(r());requestAnimationFrame(frame)}else{roller.classList.remove('rolling');roller.innerHTML=die(a,'land')+die(b,'land');res()}})(start)});
  await sleep(620);roller.classList.remove('show')
}

/* ============ 資源卡飛出 / 對手收成飄字 ============ */
async function animateProduction(){
  const prod=game.production||[];if(!prod.length)return;
  let flew=false;
  for(const e of prod){if(e.id===0){for(let k=0;k<e.amount;k++){flyCard(e.tile,e.type,k*90);flew=true}}else floatGain(e.tile,e.type,e.amount,e.id)}
  if(flew)sfx.card();
  await sleep(760)
}
function centerOf(tileId){const el=svg.querySelector(`[data-tile="${tileId}"]`);if(!el)return null;const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}
function flyCard(tileId,type,delay=0){
  const from=centerOf(tileId),cell=$(`#resources [data-res="${type}"]`);if(!from||!cell)return;
  const to=cell.getBoundingClientRect(),tx=to.left+to.width/2,ty=to.top+to.height/2;
  const card=document.createElement('div');card.className='fly-card';card.textContent=ICONS[type];
  card.style.left=from.x+'px';card.style.top=from.y+'px';document.body.append(card);
  setTimeout(()=>{card.style.transform=`translate(${tx-from.x}px,${ty-from.y}px) scale(.4) rotate(9deg)`;card.style.opacity='.15'},20+delay);
  setTimeout(()=>{card.remove();cell.classList.add('bump');setTimeout(()=>cell.classList.remove('bump'),380)},680+delay)
}
function floatGain(tileId,type,amount,owner){
  const c=centerOf(tileId);if(!c)return;
  const g=document.createElement('div');g.className='gain';g.style.color=COLORS[owner];g.textContent=`${ICONS[type]}+${amount}`;
  g.style.left=c.x+'px';g.style.top=c.y+'px';document.body.append(g);setTimeout(()=>g.remove(),1100)
}
function flashVertex(vid){const el=svg.querySelector(`[data-vertex="${vid}"]`);if(el){el.classList.add('just');setTimeout(()=>el.classList.remove('just'),700)}}
function flashEdge(eid){const el=svg.querySelector(`[data-edge="${eid}"]`);if(el){el.classList.add('just');setTimeout(()=>el.classList.remove('just'),700)}}

/* ============ 開局選址流程 ============ */
async function beginSetup(){setup={idx:0,vid:null};await advanceSetup()}
async function advanceSetup(){
  if(!setup)return;
  if(setup.idx>3){endSetup();return}
  const id=setup.idx;game.turn=id;
  if(id===0){mode='initSettle';game.log='開局：輪到你揀選位置。';render();return}
  // 電腦自動選址，逐步顯示
  busy=true;mode=null;game.log=`${game.players[id].name} 正在選擇開局位置…`;render();await sleep(680);
  const vid=pickAiInitialSettlement(game,id);placeInitialSettlement(game,id,vid);render();flashVertex(vid);sfx.build();await sleep(680);
  const roads=legalInitialRoads(game,id,vid),eid=roads[Math.floor(Math.random()*roads.length)];placeInitialRoad(game,id,eid);render();flashEdge(eid);sfx.build();await sleep(660);
  setup.idx++;busy=false;advanceSetup()
}
function endSetup(){setup=null;mode=null;busy=false;game.turn=0;game.phase='roll';game.log='開局完成！輪到你擲骰，開始拓荒。';render()}

/* ============ 玩家擲骰 ============ */
async function humanRoll(){
  if(busy||game.phase!=='roll')return;
  busy=true;mode=null;game.freeRoads=0;const n=roll(game);$('#ticker').textContent=game.log;
  await animateDice(game.dice[0],game.dice[1]);
  if(n===7){
    toast('🏴‍☠️ 海盜嚟襲！');
    for(const pid of pendingDiscards(game))if(pid!==0)autoDiscard(game,pid); // 對手自動棄牌
    render();
    if(discardNeeded(game,0)>0){busy=false;openDiscard();return} // 你自己揀要棄邊啲
    busy=false;beginRobber();return; // 之後你移動海盜
  }
  await animateProduction();
  busy=false;render()
}

/* ============ 對手回合（逐步喺棋盤演示）============ */
function describeAct(id,act){const n=game.players[id].name;return act.type==='city'?`${n} 將村莊升級成港城 🏛`:act.type==='settlement'?`${n} 建立新村莊 🏠`:act.type==='road'?`${n} 開拓新航線 🛣`:act.type==='card'?`${n} 抽取航海卡 🃏`:act.type==='trade'?`${n} 喺港口交換物資 ⚓`:`${n} 行動中…`}
async function runOpponents(){
  if(busy||game.phase!=='action')return;
  busy=true;mode=null;
  for(let id=1;id<4&&game.winner===null;id++){
    game.turn=id;game.phase='roll';game.freeRoads=0;game.log=`${game.players[id].name} 嘅回合，準備擲骰…`;render();await sleep(420);
    const n=roll(game);await animateDice(game.dice[0],game.dice[1]);
    if(n===7){
      toast('🏴‍☠️ 海盜嚟襲！');
      for(const pid of pendingDiscards(game))autoDiscard(game,pid);
      render();await sleep(360);
      await aiMoveRobber(id);
    }
    await animateProduction();render();await sleep(440);
    let guard=0,act;
    while((act=aiPlan(game,id))&&guard++<9&&game.winner===null){
      const before=game.robber;
      if(!applyAiAction(game,id,act))break;
      game.log=describeAct(id,act);render();
      if(act.type==='road')flashEdge(act.eid);else if(act.type==='settlement'||act.type==='city')flashVertex(act.vid);
      else if(act.type==='knight'&&game.robber!==before){flashTile(game.robber);toast(`🏴‍☠️ ${game.players[id].name} 打出騎士移動海盜`)}
      act.type==='trade'?sfx.coin():(act.type==='card'||act.type==='knight'||act.type==='plenty'||act.type==='roadcard')?sfx.card():sfx.build();
      await sleep(600)
    }
    await sleep(260)
  }
  if(game.winner===null){game.round++;game.turn=0;game.phase='roll';game.log='新一輪開始：輪到你擲骰。'}
  busy=false;render();if(game.winner)sfx.win()
}

async function aiMoveRobber(id){
  const t=aiChooseRobber(game,id),el=svg.querySelector(`[data-tile="${t}"]`);
  if(el){el.classList.add('legal-tile');await sleep(320)}
  const res=moveRobber(game,id,t);flashTile(t);sfx.build();render();
  if(res&&res.steal)toast(`🏴‍☠️ ${game.players[id].name} 掠奪 ${game.players[res.steal.from].name} 一份${LABELS[res.steal.res]}`);
  else toast(`🏴‍☠️ ${game.players[id].name} 移動海盜`);
  await sleep(440)
}

/* ============ 7 點棄牌對話框 ============ */
let discardSel={};
function openDiscard(){
  discardSel={wood:0,brick:0,grain:0,wool:0,ore:0};
  const need=discardNeeded(game,0);$('#discardNeed').textContent=need;$('#discardNeed2').textContent=need;
  renderDiscard();$('#discardDialog').showModal()
}
function renderDiscard(){
  const me=game.players[0];
  $('#discardList').innerHTML=RESOURCES.map(r=>`<div class="pick-row"><span>${ICONS[r]} ${LABELS[r]}</span><span class="stepper"><button data-dd="-" data-r="${r}">−</button><b>${discardSel[r]}</b><button data-dd="+" data-r="${r}">＋</button></span><small>持有 ${me.resources[r]}</small></div>`).join('');
  const chosen=RESOURCES.reduce((s,r)=>s+discardSel[r],0),need=discardNeeded(game,0);
  $('#discardChosen').textContent=chosen;$('#confirmDiscard').disabled=chosen!==need;
  $('#discardList').querySelectorAll('button[data-dd]').forEach(b=>b.onclick=()=>{
    const r=b.dataset.r;if(b.dataset.dd==='+'){if(discardSel[r]<me.resources[r]&&chosen<need)discardSel[r]++}else if(discardSel[r]>0)discardSel[r]--;renderDiscard()})
}
async function confirmDiscardAction(){
  if(!discardCards(game,0,discardSel))return;
  $('#discardDialog').close();render();beginRobber()
}

/* ============ 手牌對話框 ============ */
const CARD_META={騎士:{icon:'🛡️',desc:'移動海盜並掠奪一份物資'},豐收:{icon:'🌾',desc:'即時取得任選兩份資源'},築路:{icon:'🛣️',desc:'免費建造兩條航線'},勝利點:{icon:'🏆',desc:'抽到即計 1 分'}};
function openHand(){renderHand();$('#handDialog').showModal()}
function renderHand(){
  const me=game.players[0],action=game.phase==='action'&&!busy&&!blocked(game);
  if(!me.cards.length){$('#handList').innerHTML='<p class="hint">你暫時未有航海卡。喺回合中「抽卡」可獲得。</p>';return}
  const counts={};me.cards.forEach(c=>counts[c]=(counts[c]||0)+1);
  $('#handList').innerHTML=Object.entries(counts).map(([c,n])=>{
    const m=CARD_META[c],playable=c!=='勝利點';
    const btn=c==='勝利點'?'<span class="tag">已計分</span>':`<button class="use" data-card="${c}" ${action?'':'disabled'}>使用</button>`;
    return `<div class="hand-card"><div class="hc-face">${m.icon}</div><div class="hc-body"><b>${c}${n>1?` ×${n}`:''}</b><small>${m.desc}</small></div>${btn}</div>`
  }).join('');
  if(!action&&me.cards.some(c=>c!=='勝利點'))$('#handList').insertAdjacentHTML('beforeend','<p class="hint">要喺你嘅回合（擲完骰、未結束）先可以打出。</p>');
  $('#handList').querySelectorAll('button.use').forEach(b=>b.onclick=()=>playHandCard(b.dataset.card))
}
function playHandCard(card){
  const me=game.players[0],idx=me.cards.indexOf(card);if(idx<0)return;
  if(card==='豐收'){$('#handDialog').close();openPlenty(idx);return}
  const r=playCard(game,0,idx);if(!r)return;
  $('#handDialog').close();sfx.card();render();
  if(card==='騎士')beginRobber('打出騎士：揀一塊島放海盜並掠奪。');
  else if(card==='築路'){mode='road';toast('免費築路：喺發光航線建造兩條');render()}
}
function openPlenty(idx){
  const opts=RESOURCES.map(r=>`<option value="${r}">${ICONS[r]} ${LABELS[r]}</option>`).join('');
  $('#plentyA').innerHTML=opts;$('#plentyB').innerHTML=opts;$('#plentyDialog').dataset.idx=idx;$('#plentyDialog').showModal()
}
function confirmPlentyAction(){
  const idx=+$('#plentyDialog').dataset.idx,picks=[$('#plentyA').value,$('#plentyB').value];
  if(playCard(game,0,idx,{picks})){sfx.card();$('#plentyDialog').close();render();toast(`豐收：+${LABELS[picks[0]]}、+${LABELS[picks[1]]}`)}
}

/* ============ 其他 UI ============ */
function fillTrades(){const p=game.players[0];$('#tradeFrom').innerHTML=RESOURCES.map(r=>`<option value="${r}">${ICONS[r]} ${LABELS[r]}（${tradeRatio(p,r)}:1）</option>`).join('');$('#tradeTo').innerHTML=RESOURCES.map(r=>`<option value="${r}">${ICONS[r]} ${LABELS[r]}</option>`).join('')}
function zoom(d){scale=Math.max(.72,Math.min(1.7,scale+d));$('#mapMover').style.transform=`scale(${scale})`;$('#zoomValue').textContent=Math.round(scale*100)+'%'}
function showEnd(){if(!game||game.winner===null)return;const p=game.players[game.winner];$('#endTitle').textContent=game.winner===0?'你征服咗群島！':`${p.name} 勝出`;$('#endText').textContent=`經過 ${game.round} 輪，${p.name} 率先取得 ${p.score} 勝利點。`;if(!$('#endDialog').open)$('#endDialog').showModal()}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),1600)}

function start(){initAudio();game=makeGame();const nm=$('#playerName').value.trim();if(nm)game.players[0].name=nm;$('#playerLabel').textContent=game.players[0].name;$('#startDialog').close();beginSetup()}

/* ============ 事件綁定 ============ */
const VERSION='2.1.0';{const v=document.getElementById('ver');if(v)v.textContent='v'+VERSION;}
$('#startBtn').onclick=start;
$('#rollBtn').onclick=humanRoll;
$('#endTurn').onclick=()=>{if(!busy&&game.phase==='action')runOpponents()};
function closePanel(){$('#buildPanel').hidden=true;$('#buildToggle').classList.remove('open')}
$('#buildToggle').onclick=()=>{if(busy||game.phase!=='action'||blocked(game))return;const p=$('#buildPanel');p.hidden=!p.hidden;$('#buildToggle').classList.toggle('open',!p.hidden)};
$('#handBtn').onclick=()=>{if(!game||busy)return;openHand()};
$$('[data-build]').forEach(b=>b.onclick=()=>{if(busy||game.phase!=='action'||blocked(game))return;mode=mode===b.dataset.build?null:b.dataset.build;closePanel();render()});
$('#cardBtn').onclick=()=>{if(busy||game.phase!=='action'||blocked(game))return;const c=drawCard(game,0);closePanel();render();if(c){sfx.card();toast(`抽到「${c}」航海卡`)}};
$('#tradeBtn').onclick=()=>{if(busy||game.phase!=='action'||blocked(game))return;closePanel();fillTrades();$('#tradeDialog').showModal()};
$('#confirmDiscard').onclick=confirmDiscardAction;
$('#closeHand').onclick=()=>$('#handDialog').close();
$('#closePlenty').onclick=()=>$('#plentyDialog').close();
$('#confirmPlenty').onclick=confirmPlentyAction;
$('#closeTrade').onclick=()=>$('#tradeDialog').close();
$('#confirmTrade').onclick=()=>{if(trade(game,0,$('#tradeFrom').value,$('#tradeTo').value)){sfx.coin();$('#tradeDialog').close();render()}};
$('#zoomIn').onclick=()=>zoom(.16);$('#zoomOut').onclick=()=>zoom(-.16);$('#zoomReset').onclick=()=>{scale=1;zoom(0)};
let pinch=null;
$('#viewport').addEventListener('touchstart',e=>{if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)},{passive:true});
$('#viewport').addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom((d-pinch)/350);pinch=d}},{passive:true});
$('#rulesBtn').onclick=()=>$('#rulesDialog').showModal();$('#closeRules').onclick=()=>$('#rulesDialog').close();
$('#soundBtn').onclick=()=>{muted=!muted;$('#soundBtn').textContent=muted?'🔇':'🔊';if(!muted)initAudio()};
$('#newGameBtn').onclick=$('#playAgain').onclick=()=>location.reload();
$('#startDialog').showModal();
