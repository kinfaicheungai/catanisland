import{RESOURCES,LABELS,ICONS,COSTS,COLORS,makeGame,roll,countResources,canAfford,legalRoads,legalSettlements,legalCities,placeRoad,placeSettlement,placeCity,trade,tradeRatio,drawCard,legalInitialSettlements,placeInitialSettlement,legalInitialRoads,placeInitialRoad,pickAiInitialSettlement,aiPlan,applyAiAction,checkWinner,totalScore,bonusPoints,longestRoadLength,LONGEST_ROAD_MIN,LARGEST_ARMY_MIN,blocked,pendingDiscards,discardNeeded,discardCards,autoDiscard,legalRobberTiles,moveRobber,aiChooseRobber,playCard,finishOrder,aiTurn,LAYOUTS}from'./engine.js?v=2.9.0';

const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),NS='http://www.w3.org/2000/svg',svg=$('#island');
let VX=260,VY=245,VS=49;const sx=x=>VX+x*VS,sy=y=>VY+y*VS,sleep=ms=>new Promise(r=>setTimeout(r,ms));
let game=null,mode=null,scale=1,busy=false,setup=null,muted=false,prevArmy=null,prevRoad=null,mapChoice='standard';
const trophy=id=>`${game.largestArmy===id?'<span class="trophy" title="最大軍閥 +2">🛡</span>':''}${game.longestRoad===id?'<span class="trophy" title="最長道路 +2">🏅</span>':''}`;

/* ============ 聯賽（F1 式賽季）============ */
const HUMAN_COLORS=['#16a3b6','#e5484d','#e9aa24','#7759bb','#2e9e5b','#3a7bd5','#e0559b','#ef7d29'];
const AI_NAMES=['Toyota','Mercedes','BMW','Volkswagen','Ford','Honda','Nissan','Hyundai','Audi','Porsche','Ferrari','Mazda','Subaru','Kia','Volvo','Peugeot','Renault','Chevrolet','Tesla'];
const AI_COLORS=['#0f8a76','#b83b8f','#c0562e','#4a63c9','#6aa02f','#c99a1e','#8a4fb0','#d24b6a','#2f9ec4','#7d8a2e','#b5462f','#5566cc','#3ba06e','#a24bb0','#cc7a2a','#4aa0a8','#9b4a3a','#5a7d2e','#c23f7a'];
// 各廠實力（1–5★），似 F1 車隊強弱梯度
const AI_STR=[5,5,4,4,3,4,3,3,4,5,5,2,2,2,3,2,3,3,4];
// 資源型車隊：頂級隊開局多幾張對應資源（4★+1、5★+2）
const AI_AFFINITY=['grain','ore','wool','wood','brick','wood','grain','wool','ore','brick','ore','grain','wood','wool','brick','grain','wood','ore','ore'];
const RESICON={wood:'🌲',brick:'🧱',grain:'🌾',wool:'🐑',ore:'⛏️'};
const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
const RATKEY='frontier-ratings-v1';
function loadRatings(){try{return JSON.parse(localStorage.getItem(RATKEY))||{}}catch{return{}}}
function saveRatings(r){try{localStorage.setItem(RATKEY,JSON.stringify(r))}catch{}}
// 加權出場次序（排位賽）：實力越高越大機率先手揀位
function gridOrder(g){return g.players.map((p,i)=>({i,k:-Math.log(Math.random()+1e-9)/(p.strength||3)})).sort((a,b)=>a.k-b.k).map(x=>x.i)}
// 車隊資源型加成（只有 4★+ 先有）
function bonusFor(d){return d.strength>=4?{type:d.affinity,amount:d.strength>=5?2:1}:null}
// 一場比賽嘅 makeGame 選項（名/色/實力/資源型加成/上場贏家扣資源）
function raceOpts(ids,usePenalty){return{
  names:ids.map(i=>league.drivers[i].name),colors:ids.map(i=>league.drivers[i].color),
  strengths:ids.map(i=>league.drivers[i].strength),bonusRes:ids.map(i=>bonusFor(league.drivers[i])),
  penalties:ids.map(i=>usePenalty&&league.drivers[i].wonLast?1:0)}}
// 招牌島形：每個城市一個固定、企正、連通嘅獨特輪廓（六角磚砌唔到真實衛星地形，改為各具性格嘅剪影）
const rc=cs=>{const out=[],top=-Math.floor(cs.length/2);cs.forEach((c,i)=>{const r=top+i,q0=Math.round(-r/2-(c-1)/2);for(let k=0;k<c;k++)out.push([q0+k,r])});return out};
const rmTiles=(arr,drop)=>arr.filter(([q,r])=>!drop.some(([a,b])=>a===q&&b===r));
const SHAPES={
  hex:LAYOUTS.standard(), big:LAYOUTS.large(), cross:LAYOUTS.cross(),
  diamond:rc([1,3,5,3,1]), wide:rc([6,7,6]), delta:rc([1,2,3,4,5]),
  tall:rc([2,3,3,3,3,2]), atoll:rmTiles(LAYOUTS.large(),[[0,0]])
};
const SHAPE_NAME={hex:'標準六島',big:'大島',cross:'十字島',diamond:'鑽石島',wide:'闊島',delta:'三角洲',tall:'長島',atoll:'環礁'};
// [城市, 島形]；形狀部分帶地方神髓
const CITY_POOL=[['摩納哥','diamond'],['新加坡','wide'],['鈴鹿','cross'],['蒙薩','hex'],['銀石','big'],['上海','delta'],['墨爾本','hex'],['聖保羅','big'],['阿布達比','atoll'],['蒙特利爾','tall'],['拉斯維加斯','big'],['邁阿密','atoll'],['奧斯汀','hex'],['巴林','wide'],['吉達','delta'],['伊莫拉','cross'],['斯帕','tall'],['布達佩斯','delta'],['贊德福特','tall'],['墨西哥城','big']];
const SEASON_LEN=10;   // 每賽季站數
const LAYOUT_NAME={standard:'標準六島',large:'大島',cross:'十字島',irregular:'不規則島'};
const PTS=[3,1];        // 冠軍 3 分、亞軍 1 分
const LKEY='frontier-league-v6';
let pickedColor=HUMAN_COLORS[0],humanTier=3,league=null,leagueActive=false,raceDrivers=null,endHandled=false,playoffStage=null;
function shuffleArr(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function newLeague(name,color){
  const rat=loadRatings();
  const drivers=[{name,color,strength:rat.__you??humanTier,affinity:'grain',wonLast:false,pts:0,wins:0,races:0,margin:0,fastest:null}];
  for(let i=0;i<19;i++)drivers.push({name:AI_NAMES[i],color:AI_COLORS[i],strength:rat[AI_NAMES[i]]??AI_STR[i],affinity:AI_AFFINITY[i],wonLast:false,pts:0,wins:0,races:0,margin:0,fastest:null});
  const cities=shuffleArr(CITY_POOL.map(c=>c)).slice(0,SEASON_LEN);   // 20 抽 10，每季唔同
  const schedule=cities.map(()=>{const order=shuffleArr(drivers.map((_,i)=>i)),quads=[];for(let i=0;i<order.length;i+=4)quads.push(order.slice(i,i+4));return quads});
  return{drivers,cities,schedule,round:0,done:false,playoff:null,drifted:false}
}
// 賽季結束按名次升降星級（跨季制衡）：前三 −1★、尾三 +1★
function driftRatings(){
  if(league.drifted)return;league.drifted=true;
  const rank=standingsSorted(),rat=loadRatings(),n=rank.length;
  rank.forEach((d,idx)=>{let s=league.drivers[d.i].strength;if(idx<3)s=Math.max(1,s-1);else if(idx>=n-3)s=Math.min(5,s+1);rat[d.i===0?'__you':d.name]=s});
  saveRatings(rat);
}
function saveLeague(){try{localStorage.setItem(LKEY,JSON.stringify(league))}catch{}}
function loadLeague(){try{const s=localStorage.getItem(LKEY);return s?JSON.parse(s):null}catch{return null}}
function humanQuad(){return league.schedule[league.round].find(q=>q.includes(0))}
function standingsSorted(){return league.drivers.map((d,i)=>({...d,i})).sort((a,b)=>b.pts-a.pts||((a.fastest??999)-(b.fastest??999))||((b.margin||0)-(a.margin||0))||b.wins-a.wins||a.i-b.i)}
// 一場結果：名次、輪次、各名次總分（用嚟計得失分）
function gameResult(g,map){const ord=finishOrder(g);return{order:ord.map(map),rounds:g.round,scores:ord.map(b=>totalScore(g,b))}}
function awardQuad(res){const{order,rounds,scores}=res;
  order.forEach((di,pos)=>{const d=league.drivers[di];d.races++;if(pos<PTS.length)d.pts+=PTS[pos];
    d.margin=(d.margin||0)+Math.max(0,scores[pos]-(pos<3?scores[pos+1]:scores[pos]))});   // 得失分＝比下一名多幾分
  const w=order[0],dw=league.drivers[w];dw.wins++;dw.fastest=dw.fastest==null?rounds:Math.min(dw.fastest,rounds)}
/* 場地紀錄（跨賽季保存）：每個城市「最少輪次獲勝」嘅保持者 */
const RKEY='frontier-records-v1';
function loadRecords(){try{return JSON.parse(localStorage.getItem(RKEY))||{}}catch{return{}}}
function saveRecords(){try{localStorage.setItem(RKEY,JSON.stringify(records))}catch{}}
let records=loadRecords();
function resolveStation(){
  const ri=league.round,axial=SHAPES[league.cities[ri][1]],city=league.cities[ri][0],results=[];
  results.push(gameResult(game,bid=>raceDrivers[bid])); // 你嗰場
  for(const q of league.schedule[ri])if(!q.includes(0))results.push(simRace(q,axial));
  for(const res of results)awardQuad(res);                             // 名次分 + 得失分 + 最速紀錄
  const minR=Math.min(...results.map(r=>r.rounds));                    // 本站最速輪次
  const fast=results.filter(r=>r.rounds===minR);
  for(const r of fast)league.drivers[r.order[0]].pts++;               // 最速獲勝 +1
  const champ=league.drivers[fast[0].order[0]],prev=records[city];let broke=false;
  if(!prev||minR<prev.rounds){records[city]={rounds:minR,name:champ.name,color:champ.color};saveRecords();broke=true}
  league.drivers.forEach(d=>d.wonLast=false);                          // 上場贏家 → 下站扣一張資源
  for(const res of results)league.drivers[res.order[0]].wonLast=true;
  const my=results[0],myFast=my.rounds===minR&&my.order[0]===0;
  return{city,minR,myFast,broke,recName:records[city].name}
}
function simRace(quad,axial){
  const g=makeGame(Math.random,{axial,...raceOpts(quad,true)});
  for(const id of gridOrder(g)){const vid=pickAiInitialSettlement(g,id);placeInitialSettlement(g,id,vid);const r=legalInitialRoads(g,id,vid);placeInitialRoad(g,id,r[Math.floor(Math.random()*r.length)])}
  g.phase='action';g.turn=0;let n=0;
  while(g.winner===null&&n<600){for(let id=0;id<4&&g.winner===null;id++)aiTurn(g,id);if(g.winner===null)g.round++;n++}
  return gameResult(g,bid=>quad[bid])
}

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

function roadArt(x1,y1,x2,y2,owner,f){
  const g=S('g',{class:'road','pointer-events':'none'}),w=9.5*f,cw=6.4*f;
  g.append(S('line',{x1,y1:y1+2.2*f,x2,y2:y2+2.2*f,stroke:'rgba(6,20,28,.32)','stroke-width':w,'stroke-linecap':'round'}));
  g.append(S('line',{x1,y1,x2,y2,stroke:'#0c2a38','stroke-width':w,'stroke-linecap':'round'}));
  g.append(S('line',{x1,y1,x2,y2,stroke:game.players[owner].color,'stroke-width':cw,'stroke-linecap':'round'}));
  g.append(S('line',{x1,y1,x2,y2,stroke:'rgba(255,255,255,.42)','stroke-width':cw*.3,'stroke-linecap':'round'}));
  return g
}
function houseArt(owner,f){
  const g=S('g',{class:'piece','pointer-events':'none',transform:`scale(${f})`});
  g.append(S('ellipse',{cx:0,cy:8,rx:11,ry:3.6,fill:'rgba(6,20,28,.28)'}));
  g.append(S('path',{d:'M-8 7 V-2 L0 -11 L8 -2 V7 Z',fill:game.players[owner].color,stroke:'#0c2a38','stroke-width':2.4,'stroke-linejoin':'round','paint-order':'stroke'}));
  g.append(S('path',{d:'M0 -11 L8 -2 V7 L0 7 Z',fill:'rgba(6,20,28,.22)'}));
  g.append(S('path',{d:'M-8 -2 L0 -11 L0 -6 L-8 0 Z',fill:'rgba(255,255,255,.30)'}));
  return g
}
function cityArt(owner,f){
  const g=S('g',{class:'piece','pointer-events':'none',transform:`scale(${f})`});
  g.append(S('ellipse',{cx:1,cy:9,rx:15,ry:4.2,fill:'rgba(6,20,28,.28)'}));
  g.append(S('path',{d:'M-12 8 V-1 L-5 -8 L2 -1 V-3 H11 V8 Z',fill:game.players[owner].color,stroke:'#0c2a38','stroke-width':2.4,'stroke-linejoin':'round','paint-order':'stroke'}));
  g.append(S('path',{d:'M-5 -8 L2 -1 V8 L-5 8 Z',fill:'rgba(6,20,28,.20)'}));
  g.append(S('path',{d:'M2 -3 H11 V8 H2 Z',fill:'rgba(6,20,28,.13)'}));
  g.append(S('path',{d:'M-12 -1 L-5 -8 L-5 -3 L-12 3 Z',fill:'rgba(255,255,255,.28)'}));
  return g
}
function renderBoard(){
  svg.innerHTML='';
  const xs=game.vertices.map(v=>v.x),ys=game.vertices.map(v=>v.y);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const W=560,H=520,pad=46;
  VS=Math.min((W-2*pad)/((maxx-minx)||1),(H-2*pad)/((maxy-miny)||1));
  VX=pad-minx*VS+((W-2*pad)-(maxx-minx)*VS)/2;
  VY=pad-miny*VS+((H-2*pad)-(maxy-miny)*VS)/2;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const f=Math.max(.6,Math.min(1.12,VS/49)),ccx=sx((minx+maxx)/2),ccy=sy((miny+maxy)/2);
  for(const t of game.tiles){
    const g=S('g',{'data-tile':t.id,class:`tile ${t.type}`});
    g.append(S('polygon',{points:polygon(t),class:'land'}));
    const cx=sx(Math.sqrt(3)*(t.q+t.r/2)),cy=sy(1.5*t.r);
    g.append(S('text',{x:cx,y:cy-6*f,class:'terrain','font-size':28*f},ICONS[t.type]||'🏝️'));
    if(t.id===game.robber)g.append(S('text',{x:cx,y:cy-6*f,class:'robber','font-size':26*f},'🏴‍☠️'));
    if(t.type!=='desert'){g.append(S('circle',{cx,cy:cy+14*f,r:14*f,class:`token n${t.num}`}));g.append(S('text',{x:cx,y:cy+19*f,class:`number n${t.num}`,'font-size':15*f},t.num))}
    g.onclick=()=>chooseTile(t.id);svg.append(g)
  }
  for(const p of game.ports){const e=game.edges[p.edge],a=game.vertices[e.a],b=game.vertices[e.b],mx=(sx(a.x)+sx(b.x))/2,my=(sy(a.y)+sy(b.y))/2,dx=mx-ccx,dy=my-ccy,len=Math.hypot(dx,dy)||1,x=mx+dx/len*24*f,y=my+dy/len*24*f,pg=S('g',{class:'port'});pg.append(S('circle',{cx:x,cy:y,r:17*f}));pg.append(S('text',{x,y:y+3*f,'font-size':15*f},p.kind==='any'?'⚓':ICONS[p.kind]));pg.append(S('text',{x,y:y+14*f,class:'ratio','font-size':9*f},p.ratio+':1'));svg.append(pg)}
  for(const e of game.edges){const a=game.vertices[e.a],b=game.vertices[e.b],x1=sx(a.x),y1=sy(a.y),x2=sx(b.x),y2=sy(b.y);
    const line=S('line',{x1,y1,x2,y2,class:'edge','data-edge':e.id,'stroke-width':10*f});line.onclick=()=>chooseEdge(e.id);svg.append(line);
    if(e.owner!==null)svg.append(roadArt(x1,y1,x2,y2,e.owner,f))}
  for(const v of game.vertices){const node=S('g',{class:'vertex','data-vertex':v.id,transform:`translate(${sx(v.x)} ${sy(v.y)})`});
    node.append(S('circle',{r:(v.owner!==null?13:10)*f,class:'hit'}));
    if(v.owner!==null)node.append(v.level===2?cityArt(v.owner,f):houseArt(v.owner,f));
    node.onclick=()=>chooseVertex(v.id);svg.append(node)}
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
  if(dragged)return;
  if(busy)return;
  if(mode==='initRoad'){if(placeInitialRoad(game,0,id)){mode=null;render();flashEdge(id);sfx.build();setup.idx++;advanceSetup()}return}
  if(mode==='road'){const wasFree=game.freeRoads>0;if(placeRoad(game,0,id)){flashEdge(id);sfx.build();if(wasFree&&game.freeRoads>0){render();toast('免費築路：仲可以起多一條');return}mode=null;render()}}
}
function chooseTile(id){
  if(dragged)return;
  if(busy||mode!=='robber')return;
  const res=moveRobber(game,0,id);if(!res)return;
  mode=null;sfx.build();flashTile(id);render();
  if(res.steal)toast(`🏴‍☠️ 掠奪 ${game.players[res.steal.from].name} 一份${LABELS[res.steal.res]}`);
  else toast('🏴‍☠️ 海盜就位，封鎖該島');
}
function flashTile(id){const el=svg.querySelector(`[data-tile="${id}"]`);if(el){el.classList.add('just');setTimeout(()=>el.classList.remove('just'),800)}}
function beginRobber(msg){mode='robber';busy=false;game.log=msg||'揀一塊島放置海盜，封鎖佢生產。';$('#ticker').textContent=game.log;render();toast('🏴‍☠️ 揀一塊發光島嶼放海盜')}
function chooseVertex(id){
  if(dragged)return;
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
  // 獎盃易主提示
  if(prevArmy!==game.largestArmy){if(game.largestArmy!=null&&game.phase!=='setup')toast(`${game.players[game.largestArmy].name} 奪得最大軍閥 🛡 +2`);prevArmy=game.largestArmy}
  if(prevRoad!==game.longestRoad){if(game.longestRoad!=null&&game.phase!=='setup')toast(`${game.players[game.longestRoad].name} 奪得最長道路 🏅 +2`);prevRoad=game.longestRoad}
  $('#round').textContent=game.round;
  $('#score').textContent=totalScore(game,0);$('#cards').textContent=me.cards.length;
  $('#army').textContent=me.knights;$('#longest').textContent=longestRoadLength(game,0);
  $('#target').textContent=game.target;$('#trophies').innerHTML=trophy(0);
  $('#handCount').textContent=me.cards.length;
  $('#ticker').textContent=mode?modePrompt():game.log;
  $('#dice').textContent=game.dice?game.dice.map(face).join(' '):'⚄ ⚂';
  $('#rivals').innerHTML=game.players.slice(1).map(p=>`<article class="rv${p.id}${game.turn===p.id&&busy?' active':''}"><span style="--pc:${p.color}">${p.name[0]}</span><div><b>${p.name} ${trophy(p.id)}</b><small>${totalScore(game,p.id)}分 · ⚔${p.knights} · 🃏${p.cards.length} · ${countResources(p)}物</small></div></article>`).join('');
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
  const g=document.createElement('div');g.className='gain';g.style.color=game.players[owner].color;g.textContent=`${ICONS[type]}+${amount}`;
  g.style.left=c.x+'px';g.style.top=c.y+'px';document.body.append(g);setTimeout(()=>g.remove(),1100)
}
function flashVertex(vid){const el=svg.querySelector(`[data-vertex="${vid}"]`);if(el){el.classList.add('just');setTimeout(()=>el.classList.remove('just'),700)}}
function flashEdge(eid){const el=svg.querySelector(`[data-edge="${eid}"]`);if(el){el.classList.add('just');setTimeout(()=>el.classList.remove('just'),700)}}

/* ============ 開局選址流程 ============ */
async function beginSetup(){setup={idx:0,vid:null,order:gridOrder(game)};await advanceSetup()}
async function advanceSetup(){
  if(!setup)return;
  if(setup.idx>3){endSetup();return}
  const id=setup.order[setup.idx];game.turn=id;
  if(id===0){mode='initSettle';game.log=`排位第 ${setup.idx+1} 位：輪到你揀選位置。`;render();return}
  // 電腦自動選址，逐步顯示
  busy=true;mode=null;game.log=`${game.players[id].name} 正在選擇開局位置…`;render();await sleep(560);
  const vid=pickAiInitialSettlement(game,id);placeInitialSettlement(game,id,vid);render();flashVertex(vid);sfx.build();await sleep(560);
  const roads=legalInitialRoads(game,id,vid),eid=roads[Math.floor(Math.random()*roads.length)];placeInitialRoad(game,id,eid);render();flashEdge(eid);sfx.build();await sleep(520);
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
  if(card==='騎士')beginRobber(`⚔ 打出騎士（軍隊 ${me.knights}）：揀一塊島放海盜並掠奪。`);
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
let pan={x:0,y:0};
function clampPan(){const vp=$('#viewport'),mx=Math.max(0,(scale-1)*vp.clientWidth/2+24),my=Math.max(0,(scale-1)*vp.clientHeight/2+24);pan.x=Math.max(-mx,Math.min(mx,pan.x));pan.y=Math.max(-my,Math.min(my,pan.y))}
function applyTransform(){$('#mapMover').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;$('#viewport').style.cursor=scale>1?'grab':''}
function zoom(d){scale=Math.max(.72,Math.min(2.4,scale+d));clampPan();applyTransform();$('#zoomValue').textContent=Math.round(scale*100)+'%'}
function showEnd(){
  if(!game||game.winner===null||endHandled)return;endHandled=true;
  // 季後賽（淘汰賽）人類嗰場
  if(leagueActive&&playoffStage){
    const order=finishOrder(game).map(bid=>raceDrivers[bid]),myPos=order.indexOf(0),st=playoffStage;
    league.playoff.results[st]=order;playoffStage=null;leagueActive=false;saveLeague();
    const nm=stageName(st),adv=myPos<2;
    $('#endTitle').textContent=`${nm} · 第 ${myPos+1} 名`;
    $('#endText').textContent=st==='final'?(myPos===0?'你贏得大獎盃總冠軍 🏆！':'總決賽完成，睇最終結果。'):(adv?'你晉級決賽圈！':'季後賽止步，睇埋大獎盃結果。');
    $('#playAgain').textContent='返回季後賽 →';
    $('#playAgain').onclick=()=>{$('#endDialog').close();renderHub();$('#leagueDialog').showModal()};
    if(!$('#endDialog').open)$('#endDialog').showModal();return;
  }
  // 常規賽人類嗰站
  if(leagueActive){
    const myPos=finishOrder(game).indexOf(0),basePts=myPos<PTS.length?PTS[myPos]:0;
    const R=resolveStation();
    league.round++;if(league.round>=league.cities.length)enterPlayoff();saveLeague();leagueActive=false;
    const medal=['🥇','🥈','🥉','４'][myPos],gain=basePts+(R.myFast?1:0);
    $('#endTitle').textContent=`${R.city}分站 · ${medal} 第 ${myPos+1} 名`;
    let txt=`「${league.drivers[0].name}」今站攞 ${gain} 分（名次 ${basePts}${R.myFast?' + 最速 1':''}）。`;
    if(R.myFast)txt+=` 你係本站最快，${R.minR} 輪封王${R.broke?'，仲刷新場地紀錄 🏁':''}！`;
    txt+=league.playoff?' 常規賽完結，進入季末大獎盃！':' 返回聯賽睇總榜同下一站。';
    $('#endText').textContent=txt;
    $('#playAgain').textContent=league.playoff?'季末大獎盃 🏆':'返回聯賽榜 →';
    $('#playAgain').onclick=()=>{$('#endDialog').close();renderHub();$('#leagueDialog').showModal()};
    if(!$('#endDialog').open)$('#endDialog').showModal();return;
  }
  const p=game.players[game.winner];
  $('#endTitle').textContent=game.winner===0?'你征服咗群島！':`${p.name} 勝出`;
  $('#endText').textContent=`經過 ${game.round} 輪，${p.name} 率先取得 ${totalScore(game,game.winner)} 勝利點。`;
  $('#playAgain').textContent='再玩一次';$('#playAgain').onclick=()=>location.reload();
  if(!$('#endDialog').open)$('#endDialog').showModal()
}
/* ---- 季後賽（前 8 名大獎盃）---- */
function enterPlayoff(){
  league.drivers.forEach(d=>d.wonLast=false);            // 季後賽唔帶常規賽扣分
  const seed=standingsSorted().slice(0,8).map(d=>d.i);   // 前 8 車手（種子序）
  league.playoff={semiA:[seed[0],seed[1],seed[6],seed[7]],semiB:[seed[2],seed[3],seed[4],seed[5]],
    results:{semiA:null,semiB:null,final:null},finalists:null,champion:null};
}
const stageName=st=>st==='final'?'總決賽':st==='semiA'?'半準決賽 A':'半準決賽 B';
// 推進季後賽：AI-only 嘅場即刻模擬；遇到人類嗰場就停低等出賽；全部完成就定冠軍。
function playoffStagePending(){
  const P=league.playoff;
  for(const st of ['semiA','semiB']){if(!P.results[st]){if(P[st].includes(0))return{stage:st,participants:P[st]};P.results[st]=simRace(P[st],SHAPES.big).order}}
  if(!P.finalists)P.finalists=[...P.results.semiA.slice(0,2),...P.results.semiB.slice(0,2)];
  if(!P.results.final){if(P.finalists.includes(0))return{stage:'final',participants:P.finalists};P.results.final=simRace(P.finalists,SHAPES.big).order}
  if(P.champion==null){P.champion=P.results.final[0];league.done=true;driftRatings()}
  return null;
}
function playPlayoffRace(pending){
  const others=pending.participants.filter(i=>i!==0);raceDrivers=[0,...others];
  initAudio();endHandled=false;prevArmy=null;prevRoad=null;leagueActive=true;playoffStage=pending.stage;
  const opt=raceOpts(raceDrivers,false);                 // 季後賽：有資源型加成，無扣分
  game=makeGame(undefined,{axial:SHAPES.big,...opt});
  $('#playerLabel').textContent=opt.names[0];$('#leagueDialog').close();beginSetup();
}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),1600)}

/* ---- 聯賽榜介面 ---- */
function renderStandingsPanel(){
  const rows=standingsSorted().map((d,idx)=>`<div class="strow${d.i===0?' me':''}"><b>${idx+1}</b><span class="dot" style="background:${d.color}"></span><span class="nm">${d.name} <i class="st">${'★'.repeat(d.strength)}${d.strength>=4?RESICON[d.affinity]:''}</i></span><small>${d.wins}勝·得失${d.margin||0}${d.fastest?('·'+d.fastest+'輪'):''}</small><b class="pts">${d.pts}</b></div>`).join('');
  $('#standings').innerHTML=`<div class="strow head"><b>#</b><span class="dot"></span><span class="nm">車手</span><small>勝·得失·最速</small><b class="pts">分</b></div>`+rows;
}
function renderHub(){
  if(league.playoff){renderPlayoffHub();return;}
  const [city,ly]=league.cities[league.round],quad=humanQuad(),opp=quad.filter(i=>i!==0).map(i=>`<span class="dchip" style="--dc:${league.drivers[i].color}">${league.drivers[i].name} <i class="st">${'★'.repeat(league.drivers[i].strength)}${league.drivers[i].strength>=4?RESICON[league.drivers[i].affinity]:''}</i></span>`).join('');
  $('#leagueTitle').textContent=`第 ${league.round+1} / ${league.cities.length} 站`;
  $('#leagueSub').textContent=`${city}分站 · ${SHAPE_NAME[ly]}`;
  $('#nextRace').innerHTML=`<div class="nr-city">🏁 ${city}</div><div class="nr-you"><span class="dchip you" style="--dc:${league.drivers[0].color}">你：${league.drivers[0].name} <i class="st">${'★'.repeat(league.drivers[0].strength)}${league.drivers[0].strength>=4?RESICON[league.drivers[0].affinity]:''}</i></span></div><div class="nr-vs">對陣</div><div class="nr-opp">${opp}</div>`;
  $('#raceBtn').style.display='';$('#raceBtn').textContent='出賽 →';
  renderStandingsPanel();
}
function renderPlayoffHub(){
  const P=league.playoff,pend=playoffStagePending();saveLeague();
  const nm=i=>league.drivers[i].name;
  const line=(label,part,res)=>`<div class="brk"><span class="brk-l">${label}</span><div class="brk-c">${part.map(i=>{const adv=res&&res.indexOf(i)<2;return `<span class="dchip${i===0?' you':''}${adv?' adv':''}" style="--dc:${league.drivers[i].color}">${nm(i)}</span>`}).join('')}</div></div>`;
  let html=line('準決賽 A',P.semiA,P.results.semiA)+line('準決賽 B',P.semiB,P.results.semiB);
  if(P.finalists)html+=line('總決賽',P.finalists,P.results.final);
  $('#nextRace').innerHTML=`<div class="nr-city">🏆 季末大獎盃（前 8 強）</div>${html}`;
  if(P.champion!=null){$('#leagueTitle').textContent='大獎盃冠軍 🏆';$('#leagueSub').textContent=`${nm(P.champion)} 封王！`;$('#raceBtn').textContent='開新賽季';}
  else{$('#leagueTitle').textContent='季末大獎盃';$('#leagueSub').textContent=pend?`${stageName(pend.stage)}：輪到你出賽`:'季後賽進行中';$('#raceBtn').textContent=pend?`出賽（${stageName(pend.stage)}）→`:'繼續';}
  $('#raceBtn').style.display='';
  renderStandingsPanel();
}
function renderRecords(){
  $('#recordsList').innerHTML=CITY_POOL.map(([city,ly])=>{const r=records[city];
    return `<div class="recrow"><span class="rc-city">${city}<small>${SHAPE_NAME[ly]}</small></span>`+
      (r?`<span class="rc-hold"><span class="dot" style="background:${r.color}"></span>${r.name}</span><b class="rc-r">${r.rounds} 輪</b>`
        :`<span class="rc-hold none">未有紀錄</span><b class="rc-r">—</b>`)+`</div>`}).join('');
}
function openLeague(){initAudio();const saved=loadLeague();
  if(saved&&saved.drivers&&saved.schedule&&saved.cities)league=saved;
  else{const nm=$('#playerName').value.trim()||'珊瑚拓荒團';league=newLeague(nm,pickedColor);saveLeague()}
  $('#startDialog').close();renderHub();$('#leagueDialog').showModal()
}
function playLeagueRace(){
  const quad=humanQuad(),others=quad.filter(i=>i!==0);
  raceDrivers=[0,...others];
  initAudio();endHandled=false;prevArmy=null;prevRoad=null;leagueActive=true;playoffStage=null;
  const opt=raceOpts(raceDrivers,true);                  // 常規賽：資源型加成 + 上場贏家扣分
  game=makeGame(undefined,{axial:SHAPES[league.cities[league.round][1]],...opt});
  $('#playerLabel').textContent=opt.names[0];$('#leagueDialog').close();beginSetup()
}
function startExhibition(){
  initAudio();endHandled=false;leagueActive=false;playoffStage=null;prevArmy=null;prevRoad=null;
  const nm=$('#playerName').value.trim()||'珊瑚拓荒團';
  const names=[nm,AI_NAMES[0],AI_NAMES[1],AI_NAMES[2]],colors=[pickedColor,AI_COLORS[0],AI_COLORS[1],AI_COLORS[2]],strengths=[humanTier,AI_STR[0],AI_STR[1],AI_STR[2]],affs=['grain',AI_AFFINITY[0],AI_AFFINITY[1],AI_AFFINITY[2]];
  const bonusRes=strengths.map((s,k)=>s>=4?{type:affs[k],amount:s>=5?2:1}:null);
  game=makeGame(undefined,{layout:mapChoice,names,colors,strengths,bonusRes});
  $('#playerLabel').textContent=nm;$('#startDialog').close();beginSetup()
}

/* ============ 事件綁定 ============ */
const VERSION='2.9.0';{const v=document.getElementById('ver');if(v)v.textContent='v'+VERSION;}
$('#exhibitBtn').onclick=startExhibition;
$('#leagueBtn').onclick=openLeague;
$('#colorPick')?.addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(!b)return;pickedColor=b.dataset.color;$$('#colorPick [data-color]').forEach(x=>x.classList.toggle('on',x===b))});
$('#raceBtn')?.addEventListener('click',()=>{
  if(league.playoff){
    if(league.playoff.champion!=null){league=newLeague(league.drivers[0].name,league.drivers[0].color);saveLeague();renderHub()}
    else{const pend=playoffStagePending();if(pend)playPlayoffRace(pend);else renderHub()}
    return;
  }
  playLeagueRace();
});
$('#tierPick')?.addEventListener('click',e=>{const b=e.target.closest('[data-tier]');if(!b)return;humanTier=+b.dataset.tier;$$('#tierPick [data-tier]').forEach(x=>x.classList.toggle('on',x===b))});
$('#resetLeague')?.addEventListener('click',()=>{if(confirm('確定放棄呢個賽季？積分會清空（場地紀錄唔會刪）。')){try{localStorage.removeItem(LKEY)}catch{}league=null;$('#leagueDialog').close();$('#startDialog').showModal()}});
$('#recordsBtn')?.addEventListener('click',()=>{renderRecords();$('#recordsDialog').showModal()});
$('#closeRecords')?.addEventListener('click',()=>$('#recordsDialog').close());
$('#closeLeague')?.addEventListener('click',()=>{$('#leagueDialog').close();if(!game)$('#startDialog').showModal()});
$('#mapChoice')?.addEventListener('click',e=>{const b=e.target.closest('[data-map]');if(!b)return;mapChoice=b.dataset.map;$$('#mapChoice [data-map]').forEach(x=>x.classList.toggle('on',x===b))});
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
$('#zoomIn').onclick=()=>zoom(.2);$('#zoomOut').onclick=()=>zoom(-.2);$('#zoomReset').onclick=()=>{scale=1;pan={x:0,y:0};zoom(0)};
let gesture=null,drag=null,dragged=false;
const _vp=$('#viewport'),_mm=()=>$('#mapMover');
// 兩指：同時縮放 + 平移（單指保持純點擊，唔會誤觸）
_vp.addEventListener('touchstart',e=>{
  if(e.touches.length===2){const[a,b]=e.touches;gesture={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),mx:(a.clientX+b.clientX)/2,my:(a.clientY+b.clientY)/2,sc:scale,px:pan.x,py:pan.y};_mm().style.transition='none'}
},{passive:false});
_vp.addEventListener('touchmove',e=>{
  if(e.touches.length===2&&gesture){const[a,b]=e.touches,d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),mx=(a.clientX+b.clientX)/2,my=(a.clientY+b.clientY)/2;
    scale=Math.max(.72,Math.min(2.4,gesture.sc*d/gesture.d));
    pan.x=gesture.px+(mx-gesture.mx);pan.y=gesture.py+(my-gesture.my);
    clampPan();applyTransform();$('#zoomValue').textContent=Math.round(scale*100)+'%';e.preventDefault()}
},{passive:false});
_vp.addEventListener('touchend',e=>{if(e.touches.length<2){gesture=null;_mm().style.transition=''}});
// 桌面：放大後滑鼠拖曳平移
_vp.addEventListener('mousedown',e=>{if(scale>1){drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};dragged=false;_mm().style.transition='none';e.preventDefault()}});
window.addEventListener('mousemove',e=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)dragged=true;pan.x=drag.px+dx;pan.y=drag.py+dy;clampPan();applyTransform()}});
window.addEventListener('mouseup',()=>{if(drag){drag=null;_mm().style.transition='';applyTransform()}});
$('#rulesBtn').onclick=()=>$('#rulesDialog').showModal();$('#closeRules').onclick=()=>$('#rulesDialog').close();
$('#soundBtn').onclick=()=>{muted=!muted;$('#soundBtn').textContent=muted?'🔇':'🔊';if(!muted)initAudio()};
$('#newGameBtn').onclick=$('#playAgain').onclick=()=>location.reload();
$('#startDialog').showModal();
