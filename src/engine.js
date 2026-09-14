export const RESOURCES=['wood','brick','grain','wool','ore'];
export const LABELS={wood:'木材',brick:'石磚',grain:'糧食',wool:'羊毛',ore:'礦石'};
export const ICONS={wood:'🌲',brick:'🧱',grain:'🌾',wool:'🐑',ore:'⛏️'};
export const COSTS={road:{wood:1,brick:1},settlement:{wood:1,brick:1,grain:1,wool:1},city:{grain:2,ore:3},card:{grain:1,wool:1,ore:1}};
export const COLORS=['#16a3b6','#e55643','#e9aa24','#7759bb'];
const NAMES=['珊瑚拓荒團','赤狐商會','金帆聯盟','夜潮公社'];
// 每行置中，產生六角座標；rows 係由上到下每行嘅格數。
function rowsToAxial(rows){const out=[],top=-Math.floor(rows.length/2);rows.forEach((c,i)=>{const r=top+i,q0=Math.round(-r/2-(c-1)/2);for(let k=0;k<c;k++)out.push([q0+k,r])});return out}
export const LAYOUTS={
  standard:()=>rowsToAxial([3,4,5,4,3]),   // 正六島 19 格
  large:()=>rowsToAxial([4,5,6,5,4]),      // 大島 24 格
  cross:()=>crossAxial(),                    // 十字島 15 格
};
// 十字（「十」字輪廓）：一條水平臂 + 一條垂直臂
function crossAxial(){const out=[];for(let r=-3;r<=3;r++)for(let q=-3;q<=3;q++){const cx=Math.sqrt(3)*(q+r/2),cy=1.5*r;if((Math.abs(cx)<=1.0&&Math.abs(cy)<=4.6)||(Math.abs(cy)<=0.95&&Math.abs(cx)<=3.7))out.push([q,r])}return out}
const HEXDIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
function irregularAxial(rng){
  const set=new Set(rowsToAxial([3,4,5,4,3]).map(([q,r])=>`${q},${r}`)),base=set.size;
  const add=3+Math.floor(rng()*3);let tries=0;
  while(tries++<80&&set.size<base+add){const c=[...set][Math.floor(rng()*set.size)].split(',').map(Number),d=HEXDIRS[Math.floor(rng()*6)],nk=`${c[0]+d[0]},${c[1]+d[1]}`;if(!set.has(nk))set.add(nk)}
  const rem=1+Math.floor(rng()*2),arr=shuffle([...set],rng);let removed=0;
  for(const k of arr){if(removed>=rem)break;const[q,r]=k.split(',').map(Number),nb=HEXDIRS.filter(d=>set.has(`${q+d[0]},${r+d[1]}`)).length;if(nb<=2){set.delete(k);removed++}}
  return [...set].map(k=>k.split(',').map(Number));
}

function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function key(x,y){return `${Math.round(x*100)},${Math.round(y*100)}`}

export function createTopology(axial=LAYOUTS.standard()){
  const vertices=[],vmap=new Map(),edges=[],emap=new Map();
  const tiles=axial.map(([q,r],id)=>{
    const cx=Math.sqrt(3)*(q+r/2),cy=1.5*r,vs=[];
    for(let k=0;k<6;k++){const a=Math.PI/180*(60*k-30),x=cx+Math.cos(a),y=cy+Math.sin(a),vk=key(x,y);if(!vmap.has(vk)){vmap.set(vk,vertices.length);vertices.push({id:vertices.length,x,y,owner:null,level:0})}vs.push(vmap.get(vk))}
    const es=[];
    for(let k=0;k<6;k++){const a=vs[k],b=vs[(k+1)%6],ek=a<b?`${a}-${b}`:`${b}-${a}`;if(!emap.has(ek)){emap.set(ek,edges.length);edges.push({id:edges.length,a,b,owner:null})}es.push(emap.get(ek))}
    return{id,q,r,vertices:vs,edges:es}
  });
  const adjacency=vertices.map(()=>new Set());
  for(const e of edges){adjacency[e.a].add(e.b);adjacency[e.b].add(e.a)}
  return{tiles,vertices,edges,adjacency:adjacency.map(s=>[...s])}
}
function edgeTileCount(g,id){return g.tiles.reduce((n,t)=>n+(t.edges.includes(id)?1:0),0)}

export function makeGame(rng=Math.random,opts={}){
  let axial,kind;
  if(Array.isArray(opts.axial)&&opts.axial.length){axial=opts.axial;kind=opts.layout||'custom'}
  else{kind=opts.layout&&(opts.layout==='irregular'||LAYOUTS[opts.layout])?opts.layout:'standard';axial=kind==='irregular'?irregularAxial(rng):LAYOUTS[kind]()}
  const topo=createTopology(axial);
  const N=topo.tiles.length,desertCount=N>=24?2:1,land=N-desertCount;
  // 資源類型平均分配到陸地格
  const typePool=[];while(typePool.length<land)typePool.push(RESOURCES[typePool.length%RESOURCES.length]);
  const allTypes=shuffle([...shuffle(typePool,rng),...Array(desertCount).fill('desert')],rng);
  // 骰點（排除 7），依經典權重循環填滿
  const weighted=[2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12],numPool=[];
  while(numPool.length<land)numPool.push(weighted[numPool.length%weighted.length]);
  shuffle(numPool,rng);let np=0;
  topo.tiles.forEach((t,i)=>{t.type=allTypes[i];t.num=t.type==='desert'?7:numPool[np++]});
  const names=opts.names&&opts.names.length===4?opts.names:NAMES;
  const cols=opts.colors&&opts.colors.length===4?opts.colors:COLORS;
  const strs=opts.strengths&&opts.strengths.length===4?opts.strengths:[3,3,3,3];
  const bonus=opts.bonusRes&&opts.bonusRes.length===4?opts.bonusRes:[null,null,null,null];
  const pen=opts.penalties&&opts.penalties.length===4?opts.penalties:[0,0,0,0];
  const styl=opts.styles&&opts.styles.length===4?opts.styles:null;
  const alts=opts.alts&&opts.alts.length===4?opts.alts:null;
  const players=names.map((name,id)=>{
    const res={wood:2,brick:2,grain:2,wool:2,ore:1},b=bonus[id];
    if(b&&b.type&&res[b.type]!=null)res[b.type]+=b.amount;                     // 資源型車隊：開局多幾張
    let dock=pen[id]||0;for(const r of ['wool','grain','brick','wood','ore']){while(dock>0&&res[r]>0){res[r]--;dock--}} // 上場贏家：扣起始資源
    return{id,name,color:cols[id],style:styl?styl[id]:'solid',alt:alts?alts[id]:null,strength:strs[id],score:0,roads:0,cards:[],knights:0,resources:res,ports:[]}
  });
  const coast=topo.edges.filter(e=>edgeTileCount(topo,e.id)===1),nPorts=Math.min(9,Math.max(6,Math.floor(coast.length/3))),portKinds=['wood','brick','grain','wool','ore','any','any','any','any','any','any'],ports=[];
  for(let i=0;i<nPorts;i++){const e=coast[Math.floor(i*coast.length/nPorts)];ports.push({edge:e.id,a:e.a,b:e.b,kind:portKinds[i%portKinds.length],ratio:portKinds[i%portKinds.length]==='any'?3:2})}
  return{round:1,turn:0,phase:'setup',layout:kind,target:(kind==='large'||N>=22)?12:10,...topo,players,ports,winner:null,largestArmy:null,longestRoad:null,lastRoll:null,dice:null,production:[],robber:topo.tiles.find(t=>t.type==='desert').id,discards:null,robberPending:false,robberFromCard:false,freeRoads:0,steal:null,log:'開局：每支隊伍揀選一座村莊同一條相連航線嘅位置。'}
}

/* ---------- 開局選址（初始擺放）---------- */
export function legalInitialSettlements(g){
  // 任何無人擁有嘅交點，而且相鄰交點都無人（間距規則）。
  return g.vertices.filter(v=>v.owner===null&&g.adjacency[v.id].every(n=>g.vertices[n].owner===null)).map(v=>v.id)
}
export function placeInitialSettlement(g,id,vid){
  const v=g.vertices[vid],p=g.players[id];
  if(!v||v.owner!==null||!g.adjacency[vid].every(n=>g.vertices[n].owner===null))return false;
  v.owner=id;v.level=1;p.score++;awardPorts(g,id,vid);
  g.log=`${p.name} 於開局建立村莊。`;return true
}
export function legalInitialRoads(g,id,vid){
  // 只可揀連住剛擺放村莊嘅邊線。
  return g.edges.filter(e=>e.owner===null&&(e.a===vid||e.b===vid)).map(e=>e.id)
}
export function placeInitialRoad(g,id,eid){
  const e=g.edges[eid],p=g.players[id];
  if(!e||e.owner!==null||(g.vertices[e.a].owner!==id&&g.vertices[e.b].owner!==id))return false;
  e.owner=id;p.roads++;g.log=`${p.name} 於開局鋪設航線。`;updateBonuses(g);return true
}
// 電腦開局揀分數最高嘅交點（相鄰地塊生產機率愈高愈好）。
export function pickAiInitialSettlement(g,id,rng=Math.random){
  const legal=legalInitialSettlements(g),w=n=>n?6-Math.abs(7-n):0,noise=Math.max(.25,4-(g.players[id].strength||3)*0.72);
  let best=legal[0],bs=-1;
  for(const v of legal){let s=0;for(const t of g.tiles)if(t.vertices.includes(v)&&t.type!=='desert')s+=w(t.num);s+=rng()*noise;if(s>bs){bs=s;best=v}}
  return best
}

/* ---------- 擲骰同生產 ---------- */
export function roll(g,rng=Math.random){
  if(g.phase!=='roll')return null;
  const a=1+Math.floor(rng()*6),b=1+Math.floor(rng()*6),n=a+b;
  g.dice=[a,b];g.lastRoll=n;g.production=[];g.steal=null;
  if(n===7){
    // 唔即刻自動棄牌：記低邊個要棄幾多，交由玩家自選；擲骰者之後移動海盜。
    g.discards={};
    for(const p of g.players){const t=countResources(p);if(t>7)g.discards[p.id]=Math.floor(t/2)}
    if(Object.keys(g.discards).length===0)g.discards=null;
    g.robberPending=true;g.robberFromCard=false;
    g.log='海盜嚟襲！物資多過 7 份嘅隊伍要棄一半，擲骰者移動海盜封鎖島嶼。'
  }else{
    for(const tile of g.tiles.filter(t=>t.num===n&&t.id!==g.robber))
      for(const vid of tile.vertices){const v=g.vertices[vid];if(v.owner!==null){g.players[v.owner].resources[tile.type]+=v.level;g.production.push({id:v.owner,tile:tile.id,type:tile.type,amount:v.level})}}
    // 車隊實力：收到資源時有機率額外 +1（強隊跑得快啲）
    for(const p of g.players){const mine=g.production.filter(x=>x.id===p.id);if(mine.length){const ch=((p.strength||3)-1)*0.07;if(rng()<ch){const pk=mine[Math.floor(rng()*mine.length)];p.resources[pk.type]++;g.production.push({id:p.id,tile:pk.tile,type:pk.type,amount:1,bonus:true})}}}
    g.log=`擲出 ${n}：相同數字嘅島嶼完成生產。`
  }
  g.phase='action';return n
}
/* ---------- 7 點棄牌 ---------- */
export function discardNeeded(g,id){return (g.discards&&g.discards[id])||0}
export function pendingDiscards(g){return g.discards?Object.keys(g.discards).map(Number):[]}
export function discardCards(g,id,sel){
  const need=discardNeeded(g,id);if(!need)return false;
  const p=g.players[id],tot=RESOURCES.reduce((s,r)=>s+(sel[r]||0),0);
  if(tot!==need)return false;
  for(const r of RESOURCES)if((sel[r]||0)>p.resources[r])return false;
  for(const r of RESOURCES)p.resources[r]-=(sel[r]||0);
  delete g.discards[id];if(Object.keys(g.discards).length===0)g.discards=null;return true
}
export function autoDiscard(g,id,rng=Math.random){
  let need=discardNeeded(g,id);if(!need)return;const p=g.players[id];
  while(need>0){const r=RESOURCES.slice().sort((a,b)=>p.resources[b]-p.resources[a]).find(x=>p.resources[x]>0);if(!r)break;p.resources[r]--;need--}
  delete g.discards[id];if(g.discards&&Object.keys(g.discards).length===0)g.discards=null
}
/* ---------- 海盜移動同掠奪 ---------- */
export function legalRobberTiles(g){return g.tiles.filter(t=>t.id!==g.robber).map(t=>t.id)}
export function robberVictims(g,id,tileId){
  const t=g.tiles[tileId],set=new Set();
  for(const vid of t.vertices){const o=g.vertices[vid].owner;if(o!==null&&o!==id&&countResources(g.players[o])>0)set.add(o)}
  return[...set]
}
export function moveRobber(g,id,tileId,rng=Math.random){
  if(!g.robberPending||tileId===g.robber)return null;
  g.robber=tileId;g.robberPending=false;g.robberFromCard=false;
  const vics=robberVictims(g,id,tileId);let steal=null;
  if(vics.length){const vid=vics[Math.floor(rng()*vics.length)],p=g.players[vid],pool=[];
    for(const r of RESOURCES)for(let k=0;k<p.resources[r];k++)pool.push(r);
    const r=pool[Math.floor(rng()*pool.length)];p.resources[r]--;g.players[id].resources[r]++;steal={from:vid,to:id,res:r}}
  g.steal=steal;
  g.log=steal?`${g.players[id].name} 移動海盜，掠奪 ${g.players[steal.from].name} 一份${LABELS[steal.res]}。`:`${g.players[id].name} 移動海盜，封鎖該島嶼生產。`;
  return{tileId,steal}
}
// 電腦自動選最傷對手嘅島（優先擋住玩家、避開自己）
export function aiChooseRobber(g,id){
  const w=n=>n?6-Math.abs(7-n):0;let best=null,bs=-1;
  for(const t of g.tiles){if(t.id===g.robber||t.type==='desert')continue;
    const owners=t.vertices.map(v=>g.vertices[v].owner).filter(o=>o!==null);
    if(owners.includes(id))continue; // 唔擋自己
    let s=0;for(const o of owners)s+=w(t.num)*(o===0?1.6:1); // 特別針對人類（id 0）
    if(owners.length&&s>bs){bs=s;best=t.id}}
  if(best===null){const alt=g.tiles.find(t=>t.id!==g.robber&&t.type!=='desert');best=alt?alt.id:g.tiles.find(t=>t.id!==g.robber).id}
  return best
}
export function countResources(p){return RESOURCES.reduce((s,r)=>s+p.resources[r],0)}
export function canAfford(p,cost){return Object.entries(cost).every(([r,n])=>p.resources[r]>=n)}
function pay(p,cost){for(const[r,n]of Object.entries(cost))p.resources[r]-=n}

/* ---------- 行動階段建造 ---------- */
export const PIECES={roads:15,settlements:5,cities:4};
export function pieceCounts(g,id){let s=0,c=0;for(const v of g.vertices){if(v.owner===id){if(v.level===2)c++;else s++}}return{roads:g.players[id].roads,settlements:s,cities:c}}
export function legalRoads(g,id){if(g.phase!=='action'||g.players[id].roads>=PIECES.roads)return[];return g.edges.filter(e=>e.owner===null&&([e.a,e.b].some(v=>g.vertices[v].owner===id)||g.edges.some(o=>o.owner===id&&(o.a===e.a||o.a===e.b||o.b===e.a||o.b===e.b)))).map(e=>e.id)}
export function legalSettlements(g,id){if(g.phase!=='action'||pieceCounts(g,id).settlements>=PIECES.settlements)return[];const linked=new Set();for(const e of g.edges.filter(e=>e.owner===id)){linked.add(e.a);linked.add(e.b)}return g.vertices.filter(v=>v.owner===null&&linked.has(v.id)&&g.adjacency[v.id].every(n=>g.vertices[n].owner===null)).map(v=>v.id)}
export function legalCities(g,id){return g.phase==='action'&&pieceCounts(g,id).cities<PIECES.cities?g.vertices.filter(v=>v.owner===id&&v.level===1).map(v=>v.id):[]}
export function blocked(g){return !!(g.robberPending||g.discards)}
export function placeRoad(g,id,eid){const e=g.edges[eid],p=g.players[id];if(blocked(g)||!e||!legalRoads(g,id).includes(eid))return false;const free=g.freeRoads>0;if(!free&&!canAfford(p,COSTS.road))return false;if(free)g.freeRoads--;else pay(p,COSTS.road);e.owner=id;p.roads++;g.log=free?`${p.name} 免費建立一條新航線。`:`${p.name} 建立一條新航線。`;updateBonuses(g);return true}
export function placeSettlement(g,id,vid){const v=g.vertices[vid],p=g.players[id];if(blocked(g)||!v||!legalSettlements(g,id).includes(vid)||!canAfford(p,COSTS.settlement))return false;pay(p,COSTS.settlement);v.owner=id;v.level=1;p.score++;awardPorts(g,id,vid);updateBonuses(g);g.log=`${p.name} 建立一座新村莊。`;return true}
export function placeCity(g,id,vid){const v=g.vertices[vid],p=g.players[id];if(blocked(g)||!v||!legalCities(g,id).includes(vid)||!canAfford(p,COSTS.city))return false;pay(p,COSTS.city);v.level=2;p.score++;g.log=`${p.name} 將村莊升級成港城。`;return true}
function awardPorts(g,id,vid){for(const port of g.ports.filter(p=>p.a===vid||p.b===vid))if(!g.players[id].ports.includes(port.kind))g.players[id].ports.push(port.kind)}

export function tradeRatio(p,from){return p.ports.includes(from)?2:p.ports.includes('any')?3:4}
export function trade(g,id,from,to){const p=g.players[id],ratio=tradeRatio(p,from);if(blocked(g)||g.phase!=='action'||from===to||p.resources[from]<ratio)return false;p.resources[from]-=ratio;p.resources[to]++;g.log=`${p.name} 喺港口以 ${ratio}:1 換取${LABELS[to]}。`;return true}

// 買一張航海卡入手牌（只有「勝利點」即時計分，其餘要之後打出）。
export const CARD_TYPES=['騎士','豐收','築路','勝利點'];
export function drawCard(g,id,rng=Math.random){
  const p=g.players[id];if(blocked(g)||g.phase!=='action'||!canAfford(p,COSTS.card))return null;
  pay(p,COSTS.card);const card=CARD_TYPES[Math.floor(rng()*CARD_TYPES.length)];p.cards.push(card);
  if(card==='勝利點')p.score++;
  g.log=`${p.name} 抽到一張航海卡。`;checkWinner(g);return card
}
export function playableCards(g,id){const p=g.players[id];return p.cards.map((c,i)=>({card:c,idx:i})).filter(x=>x.card!=='勝利點')}
// 打出手牌。騎士→觸發移動海盜；豐收→opts.picks 兩種資源；築路→之後免費建兩條路。
export function playCard(g,id,idx,opts={}){
  const p=g.players[id];if(g.phase!=='action'||blocked(g))return null;
  const card=p.cards[idx];if(!card||card==='勝利點')return null;
  if(card==='騎士'){p.cards.splice(idx,1);p.knights++;g.robberPending=true;g.robberFromCard=true;g.log=`${p.name} 打出騎士，移動海盜。`;return{card}}
  if(card==='豐收'){const picks=(opts.picks||[]).filter(r=>RESOURCES.includes(r));if(picks.length!==2)return null;p.cards.splice(idx,1);for(const r of picks)p.resources[r]++;g.log=`${p.name} 打出豐收，取得${LABELS[picks[0]]}同${LABELS[picks[1]]}。`;return{card,picks}}
  if(card==='築路'){p.cards.splice(idx,1);g.freeRoads=2;g.log=`${p.name} 打出築路，可免費建造兩條航線。`;return{card}}
  return null
}
/* ---------- 獎盃：最大軍閥 / 最長道路 ---------- */
export const LARGEST_ARMY_MIN=3,LONGEST_ROAD_MIN=5;
// 玩家最長連續航線長度（可經過自己或空置交點，被對手村莊截斷）。
export function longestRoadLength(g,id){
  const es=g.edges.filter(e=>e.owner===id);if(!es.length)return 0;
  const canPass=v=>{const o=g.vertices[v].owner;return o===null||o===id};
  let best=0;
  const walk=(edge,fromV,used)=>{used.add(edge.id);let local=1;
    for(const v of [edge.a,edge.b]){if(v===fromV||!canPass(v))continue;
      for(const nx of es){if(used.has(nx.id))continue;if(nx.a===v||nx.b===v){const len=1+walk(nx,v,used);if(len>local)local=len}}}
    used.delete(edge.id);return local};
  for(const e of es)best=Math.max(best,walk(e,-1,new Set()));
  return best
}
export function updateBonuses(g){
  // 最大軍閥：出過最多騎士（≥3），要嚴格超越現任先易手
  let ba=g.largestArmy,bn=ba!=null?g.players[ba].knights:LARGEST_ARMY_MIN-1;
  for(const p of g.players)if(p.knights>=LARGEST_ARMY_MIN&&p.knights>bn){ba=p.id;bn=p.knights}
  g.largestArmy=ba;
  // 最長道路：最長連續航線（≥門檻），破紀錄先易手
  const Ls=g.players.map(p=>longestRoadLength(g,p.id)),maxL=Math.max(...Ls);
  if(maxL<LONGEST_ROAD_MIN)g.longestRoad=null;
  else if(g.longestRoad!=null&&Ls[g.longestRoad]===maxL){/* 現任平手，保留 */}
  else{const top=g.players.filter((p,i)=>Ls[i]===maxL).map(p=>p.id);
    if(top.length===1)g.longestRoad=top[0];
    else if(!(g.longestRoad!=null&&Ls[g.longestRoad]>=LONGEST_ROAD_MIN))g.longestRoad=top[0]}
}
export function bonusPoints(g,id){return (g.largestArmy===id?2:0)+(g.longestRoad===id?2:0)}
// 拆卸包：拆對手一座村莊 / 一條航線
export function demolishSettlement(g,vid){const v=g.vertices[vid];if(v.owner===null||v.level!==1)return false;const o=v.owner;
  if(g.vertices.filter(x=>x.owner===o).length<=1)return false;   // 保留至少一座建築，確保仲有收成
  g.players[o].score=Math.max(0,g.players[o].score-1);v.owner=null;v.level=0;updateBonuses(g);return o}
export function demolishRoad(g,eid){const e=g.edges[eid];if(!e||e.owner===null)return false;const o=e.owner;g.players[o].roads=Math.max(0,g.players[o].roads-1);e.owner=null;updateBonuses(g);return o}
export function totalScore(g,id){return g.players[id].score+bonusPoints(g,id)}
// 名次：由高分到低分（勝者總分必最高），平手用回合物資做次序
export function finishOrder(g){return g.players.map(p=>p.id).sort((a,b)=>totalScore(g,b)-totalScore(g,a)||countResources(g.players[b])-countResources(g.players[a])||a-b)}
export function checkWinner(g){updateBonuses(g);const t=g.target||10,w=g.players.find(p=>totalScore(g,p.id)>=t);if(w){g.winner=w.id;g.phase='end'}return w||null}

/* ---------- 電腦決策（拆成單步，方便逐步演示）---------- */
// 電腦自動解決棄牌同海盜（棄牌一律自動；海盜由當前擲骰／出騎士嘅電腦移動）。
export function aiResolve(g,id,rng=Math.random){
  if(g.discards)for(const pid of pendingDiscards(g))autoDiscard(g,pid,rng);
  if(g.robberPending)moveRobber(g,id,aiChooseRobber(g,id),rng)
}
// 交點產能估值：相鄰非沙漠地塊嘅骰點權重 + 資源多樣性
function vVal(g,vid){let s=0;const kinds=new Set();for(const t of g.tiles)if(t.type!=='desert'&&t.vertices.includes(vid)){s+=(t.num?6-Math.abs(7-t.num):0);kinds.add(t.type)}return s+kinds.size*0.6}
function bestBy(list,fn){let best=list[0],bv=-Infinity;for(const x of list){const v=fn(x);if(v>bv){bv=v;best=x}}return best}
export function aiPlan(g,id){
  if(blocked(g))return null;
  const p=g.players[id],smart=(p.strength||3)>=4,held=p.cards;
  const cities=legalCities(g,id),setts=legalSettlements(g,id),roads=legalRoads(g,id);
  if(cities.length&&canAfford(p,COSTS.city))return{type:'city',vid:smart?bestBy(cities,v=>vVal(g,v)):cities[0]};
  if(setts.length&&canAfford(p,COSTS.settlement))return{type:'settlement',vid:smart?bestBy(setts,v=>vVal(g,v)):setts[0]};
  if(held.includes('豐收')){const need=RESOURCES.filter(x=>p.resources[x]===0);if(need.length)return{type:'plenty',idx:held.indexOf('豐收'),picks:[need[0],need[1]||need[0]]}}
  // 揀通往最高產能空位嘅路
  const roadPick=()=>{if(!smart)return roads[0];let best=roads[0],bv=-1;for(const eid of roads){const e=g.edges[eid];for(const vv of[e.a,e.b])if(g.vertices[vv].owner===null){const val=vVal(g,vv);if(val>bv){bv=val;best=eid}}}return best};
  if(g.freeRoads>0&&roads.length)return{type:'road',eid:roadPick()};
  if(held.includes('築路')&&roads.length)return{type:'roadcard',idx:held.indexOf('築路')};
  // 智能隊：而家起到村就唔浪費資源鋪路，慳住升級/擴張；起唔到村先鋪路開拓
  if(roads.length&&canAfford(p,COSTS.road)&&(!smart||setts.length===0))return{type:'road',eid:roadPick()};
  if(held.includes('騎士'))return{type:'knight',idx:held.indexOf('騎士')};
  if(canAfford(p,COSTS.card))return{type:'card'};
  // 智能交易：優先湊夠起村/升級嘅資源
  const need=smart?(RESOURCES.find(x=>p.resources[x]<(COSTS.settlement[x]||0))||RESOURCES.find(x=>p.resources[x]===0)):RESOURCES.find(x=>p.resources[x]===0);
  const rich=RESOURCES.find(x=>p.resources[x]>=tradeRatio(p,x)&&x!==need);
  if(rich&&need)return{type:'trade',from:rich,to:need};
  return null
}
export function applyAiAction(g,id,act,rng=Math.random){
  if(!act)return false;
  if(act.type==='city')return placeCity(g,id,act.vid);
  if(act.type==='settlement')return placeSettlement(g,id,act.vid);
  if(act.type==='road')return placeRoad(g,id,act.eid);
  if(act.type==='card')return drawCard(g,id,rng)!==null;
  if(act.type==='trade')return trade(g,id,act.from,act.to);
  if(act.type==='plenty')return !!playCard(g,id,act.idx,{picks:act.picks});
  if(act.type==='roadcard')return !!playCard(g,id,act.idx);
  if(act.type==='knight'){if(!playCard(g,id,act.idx))return false;moveRobber(g,id,aiChooseRobber(g,id),rng);return true}
  return false
}
export function aiTurn(g,id,rng=Math.random){
  g.turn=id;g.phase='roll';roll(g,rng);aiResolve(g,id,rng);
  let guard=0,act;
  while((act=aiPlan(g,id))&&guard++<9){if(!applyAiAction(g,id,act,rng))break}
  return checkWinner(g)
}
export function endHumanTurn(g,rng=Math.random){
  if(g.phase!=='action')return false;
  for(let id=1;id<4&&!g.winner;id++)aiTurn(g,id,rng);
  if(!g.winner){g.round++;g.turn=0;g.phase='roll';g.log='新一輪開始：輪到你擲骰。'}
  return true
}
