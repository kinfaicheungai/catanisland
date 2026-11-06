export const RESOURCES=['wood','brick','grain','wool','ore'];
export const LABELS={wood:'木材',brick:'石磚',grain:'糧食',wool:'羊毛',ore:'礦石'};
export const ICONS={wood:'🌲',brick:'🧱',grain:'🌾',wool:'🐑',ore:'⛏️',gold:'💰'};
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
  if(opts.gold){const gt=topo.tiles.find(t=>t.type!=='desert');if(gt)gt.type='gold'} // 黃金地塊（隨機資源）
  // 支援 N 名玩家（標準 4，大混戰 6-7）
  const NP=Math.max(2,(opts.names&&opts.names.length)||4);
  const pick=(arr,def)=>(arr&&arr.length===NP)?arr:Array.from({length:NP},(_,i)=>(arr&&arr[i]!=null)?arr[i]:def(i));
  const names=pick(opts.names,i=>NAMES[i]||('隊'+(i+1)));
  const cols=pick(opts.colors,i=>COLORS[i%COLORS.length]);
  const strs=pick(opts.strengths,()=>3);
  const bonus=pick(opts.bonusRes,()=>null);
  const pen=pick(opts.penalties,()=>0);
  const half=(opts.halfStart&&opts.halfStart.length===NP)?opts.halfStart:null;
  const styl=(opts.styles&&opts.styles.length===NP)?opts.styles:null;
  const alts=(opts.alts&&opts.alts.length===NP)?opts.alts:null;
  const pers=pick(opts.personas,()=>'balanced');
  const players=names.map((name,id)=>{
    const res={wood:2,brick:2,grain:2,wool:2,ore:1},b=bonus[id];
    if(b&&b.type&&res[b.type]!=null)res[b.type]+=b.amount;                     // 資源型車隊：開局多幾張
    let dock=pen[id]||0;for(const r of ['wool','grain','brick','wood','ore']){while(dock>0&&res[r]>0){res[r]--;dock--}} // 上場贏家：扣起始資源
    if(half&&half[id])for(const r of RESOURCES)res[r]=Math.floor(res[r]/2); // 拆卸包代價：起始資源減半
    return{id,name,color:cols[id],style:styl?styl[id]:'solid',alt:alts?alts[id]:null,strength:strs[id],persona:pers[id],heat:(opts.heats&&opts.heats[id])||0,score:0,roads:0,cards:[],knights:0,resources:res,ports:[],vpBought:0,leasedOut:0}
  });
  if(opts.startVP)players.forEach((p,id)=>{p.score+=(opts.startVP[id]||0)}); // 墊底補償：帶勝利點開局
  const coast=topo.edges.filter(e=>edgeTileCount(topo,e.id)===1),nPorts=Math.min(9,Math.max(6,Math.floor(coast.length/3))),portKinds=['wood','brick','grain','wool','ore','any','any','any','any','any','any'],ports=[];
  for(let i=0;i<nPorts;i++){const e=coast[Math.floor(i*coast.length/nPorts)];ports.push({edge:e.id,a:e.a,b:e.b,kind:portKinds[i%portKinds.length],ratio:portKinds[i%portKinds.length]==='any'?3:2})}
  return{round:1,turn:0,phase:'setup',layout:kind,target:opts.target||((kind==='large'||N>=22)?12:10),roundCap:opts.roundCap||((kind==='large'||N>=22)?38:28),pieces:opts.pieces||null,rally:opts.rally||null,raidLeft:opts.rally?names.map(()=>opts.rally.raidUses||0):null,deck:buildDeck(rng,opts.deckMul),...topo,players,ports,winner:null,largestArmy:null,longestRoad:null,topLessor:null,lastRoll:null,dice:null,production:[],robber:topo.tiles.find(t=>t.type==='desert').id,discards:null,robberPending:false,robberFromCard:false,freeRoads:0,steal:null,weather:opts.weather||'clear',log:'開局：每支隊伍揀選一座村莊同一條相連航線嘅位置。'}
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
  const legal=legalInitialSettlements(g),str=g.players[id].strength||3,noise=Math.max(.15,3.4-str*0.78),genius=str>=4;
  let best=legal[0],bs=-1;
  for(const v of legal){let s=vVal(g,v)+rng()*noise;   // 用統一估值（含港口＋資源多樣性），強隊雜訊更低
    if(genius){let nb=0;for(const o of (g.adjacency[v]||[]))nb=Math.max(nb,vVal(g,o));s+=nb*0.3}  // 頂級隊：預視相鄰擴張潛力，揀到有靚鄰位可以生長嘅點
    if(s>bs){bs=s;best=v}}
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
    for(const tile of g.tiles.filter(t=>t.num===n&&t.id!==g.robber)){
      const w=(g.wzones&&tile.zone!=null)?g.wzones[tile.zone]:g.weather;              // 區域天氣：按地塊所屬區
      for(const vid of tile.vertices){const v=g.vertices[vid];if(v.owner===null)continue;
        if(w==='rain'&&rng()<0.2)continue;                                           // 雨：濕滑，資源流失
        if(w==='drought'&&(tile.type==='grain'||tile.type==='wool')&&rng()<0.5)continue; // 旱：農牧減產
        const rc2=leaseRenter(g,vid),dest=rc2!=null?rc2:v.owner;                     // 租借中：產出歸租客
        let type=tile.type;if(type==='gold')type=RESOURCES[Math.floor(rng()*RESOURCES.length)]; // 黃金：隨機資源
        if(tile.hub)type=RESOURCES.slice().sort((x,y)=>g.players[dest].resources[x]-g.players[dest].resources[y])[0]; // 萬能金地：自動畀最缺嗰種
        g.players[dest].resources[type]+=v.level;g.production.push({id:dest,tile:tile.id,type,amount:v.level,leased:rc2!=null})}}
    // 車隊實力：收到資源時有機率額外 +1（強隊明顯跑得快啲、資源優勢更大）
    for(const p of g.players){const mine=g.production.filter(x=>x.id===p.id);if(mine.length){const ch=((p.strength||3)-1)*0.08;if(rng()<ch){const pk=mine[Math.floor(rng()*mine.length)];p.resources[pk.type]++;g.production.push({id:p.id,tile:pk.tile,type:pk.type,amount:1,bonus:true})}}}
    // 保底：連續冇收成太耐（避免永無翻身），派 1 份最缺嘅資源 —— 但「分數領跑者」唔派，直到被反超先恢復
    const DRY_LIMIT=8,lead=Math.max(...g.players.map(q=>totalScore(g,q.id)));
    for(const p of g.players){
      const got=g.production.some(x=>x.id===p.id);
      if(got){p.dry=0}
      else{p.dry=(p.dry||0)+1;if(p.dry>=DRY_LIMIT&&totalScore(g,p.id)<lead){const least=RESOURCES.slice().sort((x,y)=>p.resources[x]-p.resources[y])[0];p.resources[least]++;g.production.push({id:p.id,type:least,amount:1,pity:true});p.dry=0}}
    }
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
    const owners=t.vertices.map(v=>g.vertices[v].owner).filter(o=>o!==null&&o!==id); // 唔擋自己
    if(!owners.length)continue;
    // 抑制高分者：對手分數越高，越值得封鎖（唔針對特定人、唔搶包尾）
    let s=0;for(const o of owners)s+=w(t.num)*(1+Math.max(0,totalScore(g,o))*0.6+(g.players[o].seasonPts||0)*0.03+(g.players[o].heat||0)*1.1); // 首選本場領先者，其次積分榜領先者；連勝熱度高者被海盜重點照顧
    if(s>bs){bs=s;best=t.id}}
  if(best===null){const alt=g.tiles.find(t=>t.id!==g.robber&&t.type!=='desert');best=alt?alt.id:g.tiles.find(t=>t.id!==g.robber).id}
  return best
}
export function countResources(p){return RESOURCES.reduce((s,r)=>s+p.resources[r],0)}
export function canAfford(p,cost){return Object.entries(cost).every(([r,n])=>p.resources[r]>=n)}
function pay(p,cost){for(const[r,n]of Object.entries(cost))p.resources[r]-=n}

/* ---------- 行動階段建造 ---------- */
export const PIECES={roads:15,settlements:5,cities:4};
export function pieceCounts(g,id){let s=0,c=0;for(const v of g.vertices){if(v.owner===id){if(v.level===2)c++;else s++}}return{roads:g.players[id].roads,settlements:s,cities:c}}
export function legalRoads(g,id){if(g.phase!=='action'||g.players[id].roads>=(((g.pieces&&g.pieces.roads)||PIECES.roads)+(g.players[id].extraRoad||0)))return[];return g.edges.filter(e=>e.owner===null&&([e.a,e.b].some(v=>g.vertices[v].owner===id)||g.edges.some(o=>o.owner===id&&(o.a===e.a||o.a===e.b||o.b===e.a||o.b===e.b)))).map(e=>e.id)}
export function legalSettlements(g,id){if(g.phase!=='action'||pieceCounts(g,id).settlements>=(((g.pieces&&g.pieces.settlements)||PIECES.settlements)+(g.players[id].extraSettle||0)))return[];const linked=new Set();for(const e of g.edges.filter(e=>e.owner===id)){linked.add(e.a);linked.add(e.b)}return g.vertices.filter(v=>v.owner===null&&linked.has(v.id)&&g.adjacency[v.id].every(n=>g.vertices[n].owner===null)).map(v=>v.id)}
export function legalCities(g,id){return g.phase==='action'&&pieceCounts(g,id).cities<((g.pieces&&g.pieces.cities)||PIECES.cities)?g.vertices.filter(v=>v.owner===id&&v.level===1).map(v=>v.id):[]}
export function blocked(g){return !!(g.robberPending||g.discards)}
export function placeRoad(g,id,eid){const e=g.edges[eid],p=g.players[id];if(blocked(g)||!e||!legalRoads(g,id).includes(eid))return false;const free=g.freeRoads>0;if(!free&&!canAfford(p,COSTS.road))return false;if(free)g.freeRoads--;else pay(p,COSTS.road);e.owner=id;p.roads++;g.log=free?`${p.name} 免費建立一條新航線。`:`${p.name} 建立一條新航線。`;updateBonuses(g);return true}
export function placeSettlement(g,id,vid){const v=g.vertices[vid],p=g.players[id];if(blocked(g)||!v||!legalSettlements(g,id).includes(vid)||!canAfford(p,COSTS.settlement))return false;pay(p,COSTS.settlement);v.owner=id;v.level=1;p.score++;awardPorts(g,id,vid);updateBonuses(g);g.log=`${p.name} 建立一座新村莊。`;return true}
export function placeCity(g,id,vid){const v=g.vertices[vid],p=g.players[id];if(blocked(g)||!v||!legalCities(g,id).includes(vid)||!canAfford(p,COSTS.city))return false;pay(p,COSTS.city);v.level=2;p.score++;g.log=`${p.name} 將村莊升級成港城。`;return true}
function awardPorts(g,id,vid){for(const port of g.ports.filter(p=>p.a===vid||p.b===vid))if(!g.players[id].ports.includes(port.kind))g.players[id].ports.push(port.kind)}

export function tradeRatio(p,from){return p.ports.includes(from)?2:p.ports.includes('any')?3:4}
export function trade(g,id,from,to){const p=g.players[id];let ratio=tradeRatio(p,from);if(g.weather==='wind')ratio=Math.max(2,ratio-1);if(blocked(g)||g.phase!=='action'||from===to||p.resources[from]<ratio)return false;p.resources[from]-=ratio;p.resources[to]++;g.log=`${p.name} 喺港口以 ${ratio}:1 換取${LABELS[to]}。`;return true}

// 買一張航海卡入手牌（只有「勝利點」即時計分，其餘要之後打出）。
export const CARD_TYPES=['騎士','豐收','築路','勝利點'];
export const DECK_COMPOSITION={騎士:12,勝利點:8,築路:4,豐收:4}; // 每局牌庫（固定稀缺）
function buildDeck(rng,mul){const d=[];for(const c in DECK_COMPOSITION){const n=Math.round(DECK_COMPOSITION[c]*(mul||1));for(let i=0;i<n;i++)d.push(c)}return shuffle(d,rng)} // mul：大混戰加量
// 按標準比例整一副 n 張牌（拉力賽用）
export function buildDeckN(n,rng=Math.random){const tot=Object.values(DECK_COMPOSITION).reduce((s,v)=>s+v,0),d=[];for(const c in DECK_COMPOSITION){const cnt=Math.round(DECK_COMPOSITION[c]/tot*n);for(let i=0;i<cnt;i++)d.push(c)}while(d.length<n)d.push('騎士');while(d.length>n)d.pop();return shuffle(d,rng)}
export function shuffleDeck(d,rng=Math.random){return shuffle(d,rng)}
export function deckCounts(g){const c={騎士:0,豐收:0,築路:0,勝利點:0};for(const x of (g.deck||[]))c[x]=(c[x]||0)+1;return c}
export function drawCard(g,id,rng=Math.random){
  const p=g.players[id];if(blocked(g)||g.phase!=='action'||!canAfford(p,COSTS.card))return null;
  if(!g.deck||!g.deck.length)return null;                       // 牌庫抽光：唔可以再抽
  pay(p,COSTS.card);const card=g.deck.pop();p.cards.push(card);
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
  // 港口權限：由現時建築重算，確保拆卸咗港口村／城之後即時失去 2:1／3:1 換率
  for(const p of g.players)p.ports=[...new Set(g.ports.filter(port=>{const a=g.vertices[port.a],b=g.vertices[port.b];return (a&&a.owner===p.id)||(b&&b.owner===p.id)}).map(port=>port.kind))];
  // 最大軍閥：出過最多騎士（≥3），嚴格超越現任先易手；排除已淘汰
  let ba=(g.largestArmy!=null&&!g.players[g.largestArmy].retired)?g.largestArmy:null;
  let bn=ba!=null?g.players[ba].knights:LARGEST_ARMY_MIN-1;
  for(const p of g.players)if(!p.retired&&p.knights>=LARGEST_ARMY_MIN&&p.knights>bn){ba=p.id;bn=p.knights}
  g.largestArmy=ba;
  // 最長道路：最長連續航線（≥門檻），排除已淘汰
  const Ls=g.players.map(p=>p.retired?0:longestRoadLength(g,p.id)),maxL=Math.max(...Ls);
  if(maxL<LONGEST_ROAD_MIN)g.longestRoad=null;
  else{const cur=g.longestRoad,curOk=cur!=null&&!g.players[cur].retired;
    if(curOk&&Ls[cur]===maxL){/* 現任仍係最長（含平手）→ 保留 */}
    else{const top=g.players.filter((p,i)=>!p.retired&&Ls[i]===maxL).map(p=>p.id);
      if(top.length===1)g.longestRoad=top[0];                                         // 有唯一更長 → 易手（修正：之前會錯誤保留現任）
      else if(!curOk||Ls[cur]<LONGEST_ROAD_MIN)g.longestRoad=top.length?top[0]:null;   // 現任斷咗／冇咗 → 另立；多人平手則保留現任
    }}
  // 放租王：放租最多次（≥門檻），要「唯一最多」先持有；平手則懸空（可爭奪，唔會先到先得鎖死）
  const Lmin=(g.rally&&g.rally.lessorMin)||3;
  let mx=0,who=[];for(const p of g.players)if(!p.retired){const c=p.leasedOut||0;if(c>mx){mx=c;who=[p.id]}else if(c===mx&&c>0)who.push(p.id)}
  g.topLessor=(mx>=Lmin&&who.length===1)?who[0]:null;
}
export function bonusPoints(g,id){return (g.largestArmy===id?2:0)+(g.longestRoad===id?2:0)+(g.topLessor===id?2:0)}
// 負面技能保護：每玩家每輪最多被一項負面技能命中；拆卸唔可以連續兩輪
export function canTarget(g,id,kind){const p=g.players[id];if(!p||p.retired)return false;
  if(!g.rally)return true;                                    // 只喺拉力賽先有呢啲保護
  if(p.hitRound===g.round)return false;                       // 本輪已被負面技能命中
  if(kind==='demolish'&&p.demoRound===g.round-1)return false; // 連續兩輪唔可以被拆
  return true}
function markHit(g,id,kind){const p=g.players[id];p.hitRound=g.round;if(kind==='demolish')p.demoRound=g.round}
// 拆卸包：拆對手一座村莊 / 一條航線
export function demolishSettlement(g,vid){const v=g.vertices[vid];if(v.owner===null||v.level!==1)return false;const o=v.owner;
  if(!canTarget(g,o,'demolish'))return false;
  if(g.vertices.filter(x=>x.owner===o).length<=1)return false;   // 保留至少一座建築，確保仲有收成
  g.players[o].score=Math.max(0,g.players[o].score-1);v.owner=null;v.level=0;markHit(g,o,'demolish');updateBonuses(g);return o}
export function demolishRoad(g,eid){const e=g.edges[eid];if(!e||e.owner===null)return false;const o=e.owner;if(!canTarget(g,o,'demolish'))return false;g.players[o].roads=Math.max(0,g.players[o].roads-1);e.owner=null;markHit(g,o,'demolish');updateBonuses(g);return o}
// 填海：喺指定村莊（島邊港口）相鄰嘅海上，加一塊自選資源、自選骰點嘅地塊。回傳新地塊 id，或 false。
function spliceHex(g,q,r,type,num){
  const vmap=new Map();g.vertices.forEach(v=>vmap.set(key(v.x,v.y),v.id));
  const cx=Math.sqrt(3)*(q+r/2),cy=1.5*r,vs=[];
  for(let k=0;k<6;k++){const a=Math.PI/180*(60*k-30),x=cx+Math.cos(a),y=cy+Math.sin(a),vk=key(x,y);
    if(!vmap.has(vk)){const id=g.vertices.length;g.vertices.push({id,x,y,owner:null,level:0});vmap.set(vk,id);g.adjacency[id]=[]}
    vs.push(vmap.get(vk))}
  const emap=new Map();g.edges.forEach(e=>emap.set(e.a<e.b?e.a+'-'+e.b:e.b+'-'+e.a,e.id));
  const es=[];
  for(let k=0;k<6;k++){const a=vs[k],b=vs[(k+1)%6],ek=a<b?a+'-'+b:b+'-'+a;
    if(!emap.has(ek)){const id=g.edges.length;g.edges.push({id,a,b,owner:null});emap.set(ek,id);
      if(!g.adjacency[a].includes(b))g.adjacency[a].push(b);if(!g.adjacency[b].includes(a))g.adjacency[b].push(a)}
    es.push(emap.get(ek))}
  const tid=g.tiles.length;g.tiles.push({id:tid,q,r,type,num,vertices:vs,edges:es});return tid;
}
// 搵某村莊相鄰、而家係海（未有地塊）嘅位置；該位置要以呢個村為角
export function reclaimCandidates(g,vid){const V=g.vertices[vid];if(!V)return[];const have=new Set(g.tiles.map(t=>t.q+','+t.r)),out=[],seen=new Set();
  for(const t of g.tiles)if(t.vertices.includes(vid))for(const[dq,dr]of HEXDIRS){const nq=t.q+dq,nr=t.r+dr,k=nq+','+nr;if(have.has(k)||seen.has(k))continue;
    const cx=Math.sqrt(3)*(nq+nr/2),cy=1.5*nr;let corner=false;
    for(let kk=0;kk<6;kk++){const a=Math.PI/180*(60*kk-30);if(key(cx+Math.cos(a),cy+Math.sin(a))===key(V.x,V.y)){corner=true;break}}
    if(corner){seen.add(k);out.push({q:nq,r:nr})}}
  return out;}
// 填海成本（拉力賽）：遞增 —— base + step × 已填次數
export function reclaimCost(g,ownerId){const base=(g.rally&&g.rally.reclaimBase)||3,step=(g.rally&&g.rally.reclaimStep)||3;return base+step*((g.players[ownerId]&&g.players[ownerId].reclaimCount)||0)}
export function reclaimTile(g,vid,resource,num,rng=Math.random){const c=reclaimCandidates(g,vid);if(!c.length)return false;const owner=g.vertices[vid]&&g.vertices[vid].owner;if(owner==null)return false;const p=g.players[owner],rally=!!g.rally;
  const cost=rally?reclaimCost(g,owner):0;if(rally&&countResources(p)<cost)return false;
  const n=rally?[5,6,8,9][Math.floor((rng()||0)*4)%4]:(num||8);                         // 拉力賽：點數隨機 5/6/8/9
  const t=spliceHex(g,c[0].q,c[0].r,resource,n);if(t===false)return false;
  if(rally){let need=cost;const ord=[...RESOURCES].sort((a,b)=>p.resources[b]-p.resources[a]);for(const r of ord){while(need>0&&p.resources[r]>0){p.resources[r]--;need--}}
    p.reclaimCount=(p.reclaimCount||0)+1;p.extraSettle=(p.extraSettle||0)+1}                // 拉力賽：遞增成本、只 +1 村額度
  else{p.extraSettle=(p.extraSettle||0)+1;p.extraRoad=(p.extraRoad||0)+3}                    // 聯賽：舊行為
  return{tile:t,num:n,cost}}
// 拆卸包「攻城」：拆一座港城（對手 −2 分）
export function demolishCity(g,vid){const v=g.vertices[vid];if(!v||v.owner===null||v.level!==2)return false;const o=v.owner;
  if(!canTarget(g,o,'demolish'))return false;
  if(g.vertices.filter(x=>x.owner===o).length<=1)return false;
  g.players[o].score=Math.max(0,g.players[o].score-2);v.owner=null;v.level=0;markHit(g,o,'demolish');updateBonuses(g);return o}
// Turbo 包：額外擲一鋪，只派資源畀自己（擲到 7 當落空；跟天氣/海盜規則）
export function turboRoll(g,id,rng=Math.random){
  const a=1+Math.floor(rng()*6),b=1+Math.floor(rng()*6),n=a+b,got=[];
  if(n!==7)for(const tile of g.tiles.filter(t=>t.num===n&&t.id!==g.robber))for(const vid of tile.vertices){const v=g.vertices[vid];if(v.owner!==id)continue;
    if(g.weather==='rain'&&rng()<0.2)continue;
    if(g.weather==='drought'&&(tile.type==='grain'||tile.type==='wool')&&rng()<0.5)continue;
    let type=tile.type;if(type==='gold')type=RESOURCES[Math.floor(rng()*RESOURCES.length)];
    g.players[id].resources[type]+=v.level;got.push({type,amount:v.level,tile:tile.id})}
  return{dice:[a,b],n,got}}
export function totalScore(g,id){return g.players[id].score+bonusPoints(g,id)-leasedVP(g,id)}
/* ===== 超級拉力賽：資源兌換勝利分 + 劫分突襲（全部制衡只打當前第一名）===== */
// 換分成本：固定一籃子（預設每樣資源 ×2，要均衡生產先儲到）
export function rallyBundle(g,id){const cfg=g.rally;if(!cfg)return null;if(cfg.bundle)return cfg.bundle;let each=cfg.bundleEach||2;
  if(id!=null&&cfg.discGap){const lead=Math.max(...g.players.map(q=>totalScore(g,q.id)));if(totalScore(g,id)<=lead-cfg.discGap)each=Math.max(1,Math.round(each*(cfg.discMul||0.5)))}
  const b={};for(const r of RESOURCES)b[r]=each;return b}
// 越換越貴：買得越多，額外要畀嘅附加資源越多（任何資源，棄最多嗰種）
// 越換越貴（指數式，唔封頂）：附加資源 = escA × 已買分數 ^ escP
export function rallySurcharge(g,id){const cfg=g.rally;if(!cfg||!cfg.escA)return 0;return Math.round(cfg.escA*Math.pow(g.players[id].vpBought||0,cfg.escP||2))}
export function canExchange(g,id){const b=rallyBundle(g,id);if(!g.rally||g.round<=10||g.phase!=='action'||g.winner!==null||!b||!canAfford(g.players[id],b))return false;
  const sum=RESOURCES.reduce((s,r)=>s+b[r],0);return countResources(g.players[id])>=sum+rallySurcharge(g,id)}
export function doExchange(g,id){if(!canExchange(g,id))return false;const p=g.players[id];pay(p,rallyBundle(g,id));
  let sur=rallySurcharge(g,id);const ord=[...RESOURCES].sort((a,b)=>p.resources[b]-p.resources[a]);for(const r of ord){while(sur>0&&p.resources[r]>0){p.resources[r]--;sur--}}
  p.score++;p.vpBought=(p.vpBought||0)+1;g.log=`${p.name} 用資源兌換咗 1 勝利分。`;checkWinner(g);return true}
/* ===== 租借村城：一次性租金（視地塊骰子數字），租期內該座產出歸租客、分數擁有者同租客都唔計 ===== */
export function leaseRenter(g,vid){if(!g.leases)return null;const L=g.leases.find(x=>x.vid===vid&&g.round<=x.until);return L?L.renter:null}
export function leasedVP(g,id){if(!g.leases)return 0;let s=0;for(const L of g.leases){if(g.round<=L.until&&L.owner===id){const v=g.vertices[L.vid];if(v&&v.owner===id)s+=v.level}}return s}
function pipW(n){return n&&n!==7?6-Math.abs(7-n):0}
// 旺度基準（滿價 = 旺度總和 × 等級）
export function rentBase(g,vid){const v=g.vertices[vid];if(!v)return Infinity;let s=0;for(const t of g.tiles)if(t.type!=='desert'&&t.vertices.includes(vid))s+=pipW(t.num);return s*(v.level||1)}
// 實際租金 = 基準 × 出價倍率（談判範圍 leaseMinMul~leaseMaxMul，預設 leaseDefMul）
export function rentFor(g,vid,mul){const cfg=g.rally||{};const m=(mul!=null?mul:(cfg.leaseDefMul||0.6));return Math.max(3,Math.round(rentBase(g,vid)*m))}
export function canLease(g,id,vid,mul){if(!g.rally||g.round<=10||g.phase!=='action'||g.winner!==null)return false;const v=g.vertices[vid];
  if(!v||v.owner==null||v.owner===id||v.level<1)return false;                       // 只准租對手已有嘅村/城
  if(leaseRenter(g,vid)!=null)return false;                                          // 已被租緊
  if((g.players[id].leaseLeft!=null?g.players[id].leaseLeft:0)<=0)return false;      // 自己仲有租借次數
  return countResources(g.players[id])>=rentFor(g,vid,mul)}
// 擁有者（電腦）嘅保留價：肯接受嘅最低出價倍率（null = 任何價都唔租）
export function leaseReservation(g,ownerId){const o=g.players[ownerId];if(!o||o.retired)return null;
  const s=totalScore(g,ownerId),target=g.target||30,Lmin=(g.rally&&g.rally.lessorMin)||3,minM=(g.rally&&g.rally.leaseMinMul)||0.5;
  if(s>=target-4)return null;                                   // 太接近封王，唔租
  if((o.leasedOut||0)<Lmin)return minM;                         // 追緊放租王：收最低價都肯
  const better=g.players.filter(p=>!p.retired&&totalScore(g,p.id)>s).length;
  if(better<3)return null;                                      // 已攞獎又領先：唔租
  return 0.7}                                                   // 中下游：想要至少七成價
export function leaseWouldAccept(g,ownerId){return leaseReservation(g,ownerId)!=null}
export function leaseAcceptsOffer(g,ownerId,mul){const r=leaseReservation(g,ownerId);return r!=null&&mul>=r-1e-9}
export function doLease(g,id,vid,mul){if(!canLease(g,id,vid,mul))return false;const v=g.vertices[vid],owner=v.owner,p=g.players[id],o=g.players[owner];
  let rent=rentFor(g,vid,mul);const ord=[...RESOURCES].sort((a,b)=>p.resources[b]-p.resources[a]);
  for(const r of ord){while(rent>0&&p.resources[r]>0){p.resources[r]--;o.resources[r]++;rent--}}   // 租金過數畀擁有者
  g.leases=g.leases||[];g.leases.push({vid,owner,renter:id,until:g.round+((g.rally.leaseTurns)||4)-1});  // 包括本輪，共 N 輪
  o.leasedOut=(o.leasedOut||0)+1;                                   // 放租王:擁有者放租次數
  p.leaseLeft=(p.leaseLeft!=null?p.leaseLeft:0)-1;checkWinner(g);
  const paid=Math.max(3,Math.round(rentBase(g,vid)*(mul!=null?mul:(g.rally.leaseDefMul||0.6))));
  g.log=`${p.name} 向 ${o.name} 租借咗一座${v.level===2?'港城':'村莊'}（${(g.rally.leaseTurns)||4} 輪）。`;return {owner,rent:paid}}
// 劫分突襲：要落後目標 >=4 分先可以劫；可劫第一名（原價）或第二名（成本翻倍）；偷 1 分
function scaleCost(cost,m){const o={};for(const k in cost)o[k]=(cost[k]||0)*m;return o}
export function raidCandidates(g,id){if(!g.rally||g.winner!==null)return [];
  const my=totalScore(g,id),base=g.rally.raidCost||{};
  const ranked=g.players.filter(p=>!p.retired).sort((a,b)=>totalScore(g,b.id)-totalScore(g,a.id)||a.id-b.id);
  const out=[];
  [0,1].forEach(r=>{const p=ranked[r];if(!p||p.id===id)return;if(!canTarget(g,p.id,'raid'))return;if(totalScore(g,p.id)-my>=4)out.push({victim:p.id,rank:r+1,cost:scaleCost(base,r===0?1:2)})});
  return out}
export function raidTargets(g,id){return raidCandidates(g,id).map(c=>c.victim)}  // 兼容舊呼叫
export function canRaid(g,id){return !!g.rally&&g.round>10&&g.phase==='action'&&g.winner===null&&!!(g.raidLeft&&g.raidLeft[id]>0)&&raidCandidates(g,id).some(c=>canAfford(g.players[id],c.cost))}
export function doRaid(g,id,victim,rng=Math.random){if(!g.rally||g.phase!=='action'||g.winner!==null||!(g.raidLeft&&g.raidLeft[id]>0))return false;
  const cands=raidCandidates(g,id).filter(c=>canAfford(g.players[id],c.cost));if(!cands.length)return false;
  let pick;if(victim!=null)pick=cands.find(c=>c.victim===victim);if(!pick)pick=cands[0];   // 預設劫第一名
  pay(g.players[id],pick.cost);g.raidLeft[id]--;
  g.players[pick.victim].score=Math.max(0,g.players[pick.victim].score-1);g.players[id].score++;markHit(g,pick.victim,'raid');
  g.log=`${g.players[id].name} 向第 ${pick.rank} 名 ${g.players[pick.victim].name} 發動劫分突襲，搶走 1 分！`;checkWinner(g);return {victim:pick.victim,rank:pick.rank}}
/* ===== 商船收購：每隔幾輪有一張訂單，交指定資源（2 種、合共 ≥6）換 1 分；只限有 2 個港口物業嘅車隊 ===== */
export function merchantActive(g){return !!(g.merchant&&g.round<=g.merchant.until)}
export function portBuildings(g,id){const s=new Set();for(const port of g.ports){if(g.vertices[port.a].owner===id)s.add(port.a);if(g.vertices[port.b].owner===id)s.add(port.b)}return s.size}
export function canMerchant(g,id){return !!g.rally&&g.round>10&&g.phase==='action'&&g.winner===null&&merchantActive(g)&&!g.merchant.claimed.includes(id)&&portBuildings(g,id)>=2&&canAfford(g.players[id],g.merchant.need)}
export function doMerchant(g,id){if(!canMerchant(g,id))return false;pay(g.players[id],g.merchant.need);g.merchant.claimed.push(id);g.players[id].score++;checkWinner(g);return true}
export function spawnMerchant(g,rng=Math.random){const two=[...RESOURCES].sort(()=>rng()-0.5).slice(0,2),total=6+Math.floor(rng()*3),a=2+Math.floor(rng()*(total-3)),need={};need[two[0]]=a;need[two[1]]=total-a;g.merchant={res:two,need,until:g.round+3,claimed:[]};return g.merchant}
/* ===== 發電：內陸（非沿海）同一地塊有 2 座城 → 每回合用 5 種資源各 1 張充能；儲 3 次 +1 分（黃金地段 +2）===== */
export function powerKind(g,id){const nb=new Set(g.tiles.map(x=>x.q+','+x.r)),inland=t=>[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]].every(([dq,dr])=>nb.has((t.q+dq)+','+(t.r+dr)));
  let reg=false;for(const t of g.tiles){if(t.type==='desert'||!inland(t))continue;if(t.vertices.filter(vi=>g.vertices[vi].owner===id&&g.vertices[vi].level===2).length>=2){if(t.hub)return 'gold';reg=true}}return reg?'reg':null}
export function canPower(g,id){return !!g.rally&&g.round>10&&g.phase==='action'&&g.winner===null&&!!powerKind(g,id)&&RESOURCES.every(r=>g.players[id].resources[r]>=1)}
export function doPower(g,id){if(!canPower(g,id))return false;const p=g.players[id];for(const r of RESOURCES)p.resources[r]--;const k=powerKind(g,id);let scored=0;
  if(k==='gold'){p.powerG=(p.powerG||0)+1;if(p.powerG>=3){p.powerG-=3;p.score+=2;scored=2}}else{p.powerR=(p.powerR||0)+1;if(p.powerR>=3){p.powerR-=3;p.score+=1;scored=1}}
  checkWinner(g);return {kind:k,scored,g:p.powerG||0,r:p.powerR||0}}
// 名次：由高分到低分（勝者總分必最高），平手用回合物資做次序
export function finishOrder(g){return g.players.map(p=>p.id).sort((a,b)=>((g.players[a].retired?1:0)-(g.players[b].retired?1:0))||totalScore(g,b)-totalScore(g,a)||countResources(g.players[b])-countResources(g.players[a])||a-b)}
export function checkWinner(g){updateBonuses(g);const t=g.target||10;
  let cand=g.players.filter(p=>!p.retired&&totalScore(g,p.id)>=t);
  if(g.rally&&cand.length){ // 拉力賽：到 t 分要領先第二名 >=4 先封王，否則要到 t+hardBonus
    const hb=(g.rally.hardBonus!=null?g.rally.hardBonus:2);
    cand=cand.filter(p=>{const s=totalScore(g,p.id),others=g.players.filter(q=>!q.retired&&q.id!==p.id).map(q=>totalScore(g,q.id)),second=others.length?Math.max(...others):0;return s>=t+hb||(s-second)>=4});
  }
  if(cand.length){cand.sort((a,b)=>totalScore(g,b.id)-totalScore(g,a.id)||(b.id===g.turn?1:0)-(a.id===g.turn?1:0)||countResources(b)-countResources(a)||a.id-b.id);g.winner=cand[0].id;g.phase='end';return cand[0]}
  return null}
// 淘汰：當前最後一名退賽，佢嘅村/城/路轉讓畀頭兩名（第一名先選較高價值嗰半，其餘歸第二名）
function recomputePlayerAssets(g,id){const p=g.players[id];
  p.roads=g.edges.filter(e=>e.owner===id).length;                                   // 道路數同步
  p.ports=[...new Set(g.ports.filter(port=>{const a=g.vertices[port.a],b=g.vertices[port.b];return (a&&a.owner===id)||(b&&b.owner===id)}).map(port=>port.kind))];  // 港口權重算
}
export function eliminateLast(g){
  const alive=g.players.filter(p=>!p.retired);
  if(alive.length<3)return null;
  const byScore=alive.slice().sort((a,b)=>totalScore(g,b.id)-totalScore(g,a.id)||countResources(b)-countResources(a)||a.id-b.id);
  const elim=byScore[byScore.length-1].id;
  const recips=byScore.filter(p=>p.id!==elim);
  // 制衡：資產畀第 5、6 名瓜分（前 4 名係得分區，唔益佢哋以免雪球）；人少就用最低兩名
  const r1=(recips[4]||recips[recips.length-1]).id;
  const r2=(recips[5]||recips[recips.length-2]||recips[recips.length-1]).id;
  if(r1===elim||r2===elim||r1===r2)return null;
  const builds=g.vertices.filter(v=>v.owner===elim).map(v=>({vid:v.id,vp:v.level})).sort((a,b)=>b.vp-a.vp);
  const roads=g.edges.filter(e=>e.owner===elim).map(e=>e.id);
  const totalVP=builds.reduce((s,b)=>s+b.vp,0),half=Math.ceil(totalVP/2);
  let taken1=0;const to1=[],to2=[];
  for(const b of builds){if(taken1<half){to1.push(b);taken1+=b.vp}else to2.push(b)}   // 第 5 名先選一半（較高價值）
  for(const b of to1){const v=g.vertices[b.vid];v.owner=r1;g.players[r1].score+=v.level}
  for(const b of to2){const v=g.vertices[b.vid];v.owner=r2;g.players[r2].score+=v.level}
  roads.forEach((eid,i)=>{g.edges[eid].owner=(i%2===0?r1:r2)});
  const el=g.players[elim];el.retired=true;el.score=0;
  if(g.leases)g.leases=g.leases.filter(L=>L.owner!==elim&&L.renter!==elim);
  recomputePlayerAssets(g,elim);recomputePlayerAssets(g,r1);recomputePlayerAssets(g,r2);   // 道路數/港口同步
  updateBonuses(g);checkWinner(g);
  return{elim,r1,r2,vp1:to1.reduce((s,b)=>s+b.vp,0),vp2:to2.reduce((s,b)=>s+b.vp,0),nBuild:builds.length};
}
// 輪次上限到：依總分（同分睇資源）定勝負
export function capWinner(g){updateBonuses(g);const o=finishOrder(g);g.winner=o[0];g.phase='end';g.cappedOut=true;return o[0]}

/* ---------- 電腦決策（拆成單步，方便逐步演示）---------- */
// 電腦自動解決棄牌同海盜（棄牌一律自動；海盜由當前擲骰／出騎士嘅電腦移動）。
export function aiResolve(g,id,rng=Math.random){
  if(g.discards)for(const pid of pendingDiscards(g))autoDiscard(g,pid,rng);
  if(g.robberPending)moveRobber(g,id,aiChooseRobber(g,id),rng)
}
// 交點產能估值：骰點權重 + 資源多樣性 + 港口價值
// 全盤資源稀缺度（按總骰點權重）：愈罕有愈值錢；快取喺 g（棋盤固定）
function resScarcity(g){if(g._scarce)return g._scarce;const tot={};for(const r of RESOURCES)tot[r]=0;
  for(const t of g.tiles)if(t.type!=='desert'&&tot[t.type]!=null)tot[t.type]+=(t.num?6-Math.abs(7-t.num):0);
  const avg=(RESOURCES.reduce((s,r)=>s+tot[r],0)/RESOURCES.length)||1,sc={};
  for(const r of RESOURCES)sc[r]=avg/(tot[r]||0.5);g._scarce=sc;return sc}
// 交點估值：骰點(按資源稀缺度加權) + 資源多樣性 + 港口 —— 即「判斷地形」
function vVal(g,vid){let s=0;const kinds=new Set(),sc=resScarcity(g);
  for(const t of g.tiles)if(t.type!=='desert'&&t.vertices.includes(vid)){const pip=t.num?6-Math.abs(7-t.num):0;s+=pip*(0.8+0.25*Math.min(2,sc[t.type]||1));kinds.add(t.type)}
  s+=kinds.size*0.8;                                                           // 資源多樣性（唔好押晒一兩種）
  if(g.ports)for(const port of g.ports)if(port.a===vid||port.b===vid)s+=(port.kind==='any'?1.2:1.9); // 港口：產品港 2:1 更值錢
  return s}
// 建設時估值：疊加「我而家缺、起村/升城要用」嘅資源 —— 即「知道自己想要咩資源」
function vValFor(g,vid,p){let bonus=0;const lack={};for(const r of RESOURCES)lack[r]=Math.max(0,(COSTS.settlement[r]||0)+(COSTS.city[r]||0)-p.resources[r]);
  for(const t of g.tiles)if(t.type!=='desert'&&t.vertices.includes(vid)&&lack[t.type]>0)bonus+=(t.num?6-Math.abs(7-t.num):0)*0.3;
  return vVal(g,vid)+bonus}
function bestBy(list,fn){let best=list[0],bv=-Infinity;for(const x of list){const v=fn(x);if(v>bv){bv=v;best=x}}return best}
export function aiPlan(g,id){
  if(blocked(g))return null;
  const p=g.players[id],str=p.strength||3,smart=str>=3,genius=str>=4,held=p.cards,persona=p.persona||'balanced';
  const cities=legalCities(g,id),setts=legalSettlements(g,id),roads=legalRoads(g,id);
  const sc=totalScore(g,id),target=g.target||10;
  const roadPick=()=>{if(!smart)return roads[0];let best=roads[0],bv=-1;for(const eid of roads){const e=g.edges[eid];for(const vv of[e.a,e.b])if(g.vertices[vv].owner===null){const val=vVal(g,vv);if(val>bv){bv=val;best=eid}}}return best};
  const cityMove=()=>cities.length&&canAfford(p,COSTS.city)?{type:'city',vid:smart?bestBy(cities,v=>vVal(g,v)):cities[0]}:null;
  const settMove=()=>setts.length&&canAfford(p,COSTS.settlement)?{type:'settlement',vid:genius?bestBy(setts,v=>vValFor(g,v,p)):(smart?bestBy(setts,v=>vVal(g,v)):setts[0])}:null;
  const roadMove=()=>roads.length&&canAfford(p,COSTS.road)?{type:'road',eid:roadPick()}:null;
  const cardMove=()=>canAfford(p,COSTS.card)&&(g.deck&&g.deck.length)?{type:'card'}:null;
  const knightMove=()=>held.includes('騎士')?{type:'knight',idx:held.indexOf('騎士')}:null;
  // 豐收：優先補夠下一個 VP 建設所缺嘅資源，其次補零
  const plentyMove=()=>{if(!held.includes('豐收'))return null;const want=cities.length?COSTS.city:(setts.length?COSTS.settlement:COSTS.road);const def=RESOURCES.filter(x=>p.resources[x]<(want[x]||0)),z=RESOURCES.filter(x=>p.resources[x]===0),pk=def.length?def:(z.length?z:RESOURCES);return{type:'plenty',idx:held.indexOf('豐收'),picks:[pk[0],pk[1]||pk[0]]}};
  const tradeMove=()=>{const need=smart?(RESOURCES.find(x=>p.resources[x]<(COSTS.settlement[x]||0))||RESOURCES.find(x=>p.resources[x]===0)):RESOURCES.find(x=>p.resources[x]===0);const rich=RESOURCES.find(x=>p.resources[x]>=tradeRatio(p,x)&&x!==need);return rich&&need?{type:'trade',from:rich,to:need}:null};
  // 目標導向交易：差一份就湊到最抵嘅 VP 建設，就用「扣起建設本身所需之後」仍過剩嘅資源換埋
  const smartTrade=()=>{const want=cities.length?COSTS.city:(setts.length?COSTS.settlement:((roads.length&&(sc>=target-1||genius))?COSTS.road:null));if(!want)return null;
    for(const need of RESOURCES){if((want[need]||0)-p.resources[need]!==1)continue;const rich=RESOURCES.find(x=>x!==need&&(p.resources[x]-(want[x]||0))>=tradeRatio(p,x));if(rich)return{type:'trade',from:rich,to:need}}return null};
  const tradeX=()=>(genius&&smartTrade())||tradeMove();
  // 免費築路卡：永遠優先
  if(g.freeRoads>0&&roads.length)return{type:'road',eid:roadPick()};
  if(held.includes('築路')&&roads.length)return{type:'roadcard',idx:held.indexOf('築路')};
  // 臨門封王：爭差 1 分，任何 +1 建設即刻做；genius 仲會為封王而交易湊料
  if(sc>=target-1){const win=cityMove()||settMove();if(win)return win;if(genius){const t=smartTrade();if(t)return t}}
  // genius 近封王又建唔到嘢：買航海卡博勝利點（隱藏 +1 可封王）
  if(genius&&sc>=target-2&&!cities.length&&!setts.length){const c=cardMove();if(c)return c}
  // genius 搶最大軍閥（+2）：打咗夠 3 張又能超越現任，就打騎士
  if(genius&&knightMove()){const myK=p.knights+1,curK=(g.largestArmy!=null&&g.largestArmy!==id)?g.players[g.largestArmy].knights:LARGEST_ARMY_MIN-1;if(myK>=LARGEST_ARMY_MIN&&g.largestArmy!==id&&myK>curK)return knightMove()}
  // 判斷形勢：genius 落後兩分以上時，打騎士移海盜去針對領跑者（讀對手）
  if(genius&&knightMove()){let lead=-1;for(let q=0;q<g.players.length;q++)if(q!==id)lead=Math.max(lead,totalScore(g,q));if(lead>=sc+2)return knightMove()}
  // genius 收尾：近封王（差 3 分內）又未攞最長道路，手頭夠料就持續起路搶 +2 獎盃，快刀斬亂麻封王
  if(genius&&sc>=target-3&&g.longestRoad!==id&&roads.length&&canAfford(p,COSTS.road)){
    const myNow=longestRoadLength(g,id),curL=(g.longestRoad!=null)?longestRoadLength(g,g.longestRoad):LONGEST_ROAD_MIN-1;
    if(myNow>=Math.min(curL,LONGEST_ROAD_MIN-1)){const mv=roadMove();if(mv)return mv}  // 追平或迫近紀錄時全力搶
  }
  // 各性格嘅行動優先次序（🏗建設 / 🧭開拓 / 💱交易 / ⚔侵略 / 均衡）
  const P={
    builder :[cityMove,plentyMove,settMove,tradeX,cardMove,()=>setts.length?null:roadMove()],
    expander:[plentyMove,settMove,cityMove,tradeX,roadMove,cardMove],
    trader  :[plentyMove,cityMove,settMove,tradeX,cardMove,roadMove],
    raider  :[knightMove,plentyMove,cityMove,settMove,tradeX,cardMove,()=>setts.length?null:roadMove()],
    balanced:[cityMove,settMove,plentyMove,tradeX,()=>setts.length&&smart?null:roadMove(),knightMove,cardMove],
  }[persona]||null;
  if(P){for(const mv of P){const a=mv();if(a)return a}
    if(knightMove())return knightMove();return null}
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
  for(let id=1;id<g.players.length&&!g.winner;id++)aiTurn(g,id,rng);
  if(!g.winner){g.round++;g.turn=0;g.phase='roll';g.log='新一輪開始：輪到你擲骰。'}
  return true
}
