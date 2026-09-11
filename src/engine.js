export const RESOURCES=['wood','brick','grain','wool','ore'];
export const LABELS={wood:'木材',brick:'石磚',grain:'糧食',wool:'羊毛',ore:'礦石'};
export const ICONS={wood:'🌲',brick:'🧱',grain:'🌾',wool:'🐑',ore:'⛏️'};
export const COSTS={road:{wood:1,brick:1},settlement:{wood:1,brick:1,grain:1,wool:1},city:{grain:2,ore:3},card:{grain:1,wool:1,ore:1}};
export const COLORS=['#16a3b6','#e55643','#e9aa24','#7759bb'];
const NAMES=['珊瑚拓荒團','赤狐商會','金帆聯盟','夜潮公社'];
export const AXIAL=[[-1,-2],[0,-2],[1,-2],[-2,-1],[-1,-1],[0,-1],[1,-1],[2,-1],[-2,0],[-1,0],[0,0],[1,0],[2,0],[-2,1],[-1,1],[0,1],[1,1],[-1,2],[0,2]];

function shuffle(a,rng){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function key(x,y){return `${Math.round(x*100)},${Math.round(y*100)}`}

export function createTopology(){
  const vertices=[],vmap=new Map(),edges=[],emap=new Map();
  const tiles=AXIAL.map(([q,r],id)=>{
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

export function makeGame(rng=Math.random){
  const topo=createTopology();
  const nums=[2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12],types=[...RESOURCES,...RESOURCES,...RESOURCES,'wood','grain','desert'];
  shuffle(nums,rng);shuffle(types,rng);let ni=0;
  topo.tiles.forEach((t,i)=>Object.assign(t,{type:types[i],num:types[i]==='desert'?7:nums[ni++]}));
  // 每支隊伍由 0 分 0 航線開始，開局階段親自揀選村莊同航線。
  const players=NAMES.map((name,id)=>({id,name,score:0,roads:0,cards:[],knights:0,resources:{wood:2,brick:2,grain:2,wool:2,ore:1},ports:[]}));
  const coast=topo.edges.filter(e=>edgeTileCount(topo,e.id)===1),portKinds=['wood','brick','grain','wool','ore','any','any','any','any'],ports=[];
  for(let i=0;i<9;i++){const e=coast[Math.floor(i*coast.length/9)];ports.push({edge:e.id,a:e.a,b:e.b,kind:portKinds[i],ratio:portKinds[i]==='any'?3:2})}
  return{round:1,turn:0,phase:'setup',...topo,players,ports,winner:null,lastRoll:null,dice:null,production:[],robber:topo.tiles.find(t=>t.type==='desert').id,log:'開局：每支隊伍揀選一座村莊同一條相連航線嘅位置。'}
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
  e.owner=id;p.roads++;g.log=`${p.name} 於開局鋪設航線。`;return true
}
// 電腦開局揀分數最高嘅交點（相鄰地塊生產機率愈高愈好）。
export function pickAiInitialSettlement(g,id,rng=Math.random){
  const legal=legalInitialSettlements(g),w=n=>n?6-Math.abs(7-n):0;
  let best=legal[0],bs=-1;
  for(const v of legal){let s=0;for(const t of g.tiles)if(t.vertices.includes(v)&&t.type!=='desert')s+=w(t.num);s+=rng()*1.5;if(s>bs){bs=s;best=v}}
  return best
}

/* ---------- 擲骰同生產 ---------- */
export function roll(g,rng=Math.random){
  if(g.phase!=='roll')return null;
  const a=1+Math.floor(rng()*6),b=1+Math.floor(rng()*6),n=a+b;
  g.dice=[a,b];g.lastRoll=n;g.production=[];
  if(n===7){
    for(const p of g.players){let total=countResources(p);if(total>7){let loss=Math.floor(total/2);while(loss--){const r=RESOURCES.find(x=>p.resources[x]>0);p.resources[r]--}}}
    g.log='海盜掠過群島！物資超過 7 份嘅隊伍棄掉一半。'
  }else{
    for(const tile of g.tiles.filter(t=>t.num===n&&t.id!==g.robber))
      for(const vid of tile.vertices){const v=g.vertices[vid];if(v.owner!==null){g.players[v.owner].resources[tile.type]+=v.level;g.production.push({id:v.owner,tile:tile.id,type:tile.type,amount:v.level})}}
    g.log=`擲出 ${n}：相同數字嘅島嶼完成生產。`
  }
  g.phase='action';return n
}
export function countResources(p){return RESOURCES.reduce((s,r)=>s+p.resources[r],0)}
export function canAfford(p,cost){return Object.entries(cost).every(([r,n])=>p.resources[r]>=n)}
function pay(p,cost){for(const[r,n]of Object.entries(cost))p.resources[r]-=n}

/* ---------- 行動階段建造 ---------- */
export function legalRoads(g,id){if(g.phase!=='action')return[];return g.edges.filter(e=>e.owner===null&&([e.a,e.b].some(v=>g.vertices[v].owner===id)||g.edges.some(o=>o.owner===id&&(o.a===e.a||o.a===e.b||o.b===e.a||o.b===e.b)))).map(e=>e.id)}
export function legalSettlements(g,id){if(g.phase!=='action')return[];const linked=new Set();for(const e of g.edges.filter(e=>e.owner===id)){linked.add(e.a);linked.add(e.b)}return g.vertices.filter(v=>v.owner===null&&linked.has(v.id)&&g.adjacency[v.id].every(n=>g.vertices[n].owner===null)).map(v=>v.id)}
export function legalCities(g,id){return g.phase==='action'?g.vertices.filter(v=>v.owner===id&&v.level===1).map(v=>v.id):[]}
export function placeRoad(g,id,eid,free=false){const e=g.edges[eid],p=g.players[id];if(!e||!legalRoads(g,id).includes(eid)||(!free&&!canAfford(p,COSTS.road)))return false;if(!free)pay(p,COSTS.road);e.owner=id;p.roads++;g.log=`${p.name} 建立一條新航線。`;return true}
export function placeSettlement(g,id,vid){const v=g.vertices[vid],p=g.players[id];if(!v||!legalSettlements(g,id).includes(vid)||!canAfford(p,COSTS.settlement))return false;pay(p,COSTS.settlement);v.owner=id;v.level=1;p.score++;awardPorts(g,id,vid);g.log=`${p.name} 建立一座新村莊。`;return true}
export function placeCity(g,id,vid){const v=g.vertices[vid],p=g.players[id];if(!v||!legalCities(g,id).includes(vid)||!canAfford(p,COSTS.city))return false;pay(p,COSTS.city);v.level=2;p.score++;g.log=`${p.name} 將村莊升級成港城。`;return true}
function awardPorts(g,id,vid){for(const port of g.ports.filter(p=>p.a===vid||p.b===vid))if(!g.players[id].ports.includes(port.kind))g.players[id].ports.push(port.kind)}

export function tradeRatio(p,from){return p.ports.includes(from)?2:p.ports.includes('any')?3:4}
export function trade(g,id,from,to){const p=g.players[id],ratio=tradeRatio(p,from);if(g.phase!=='action'||from===to||p.resources[from]<ratio)return false;p.resources[from]-=ratio;p.resources[to]++;g.log=`${p.name} 喺港口以 ${ratio}:1 換取${LABELS[to]}。`;return true}

export function drawCard(g,id,rng=Math.random){
  const p=g.players[id];if(g.phase!=='action'||!canAfford(p,COSTS.card))return null;
  pay(p,COSTS.card);const cards=['騎士','豐收','築路','勝利點'],card=cards[Math.floor(rng()*cards.length)];p.cards.push(card);
  if(card==='勝利點')p.score++;
  if(card==='豐收')p.resources[RESOURCES[Math.floor(rng()*5)]]+=2;
  if(card==='築路'){const e=legalRoads(g,id)[0];if(e!==undefined)placeRoad(g,id,e,true)}
  if(card==='騎士'){p.knights++;const victim=g.players.filter(x=>x.id!==id&&countResources(x)>0).sort((a,b)=>countResources(b)-countResources(a))[0];if(victim){const r=RESOURCES.find(x=>victim.resources[x]>0);victim.resources[r]--;p.resources[r]++}}
  g.log=`${p.name} 抽到「${card}」航海卡！`;checkWinner(g);return card
}
export function checkWinner(g){const w=g.players.find(p=>p.score>=10);if(w){g.winner=w.id;g.phase='end'}return w||null}

/* ---------- 電腦決策（拆成單步，方便逐步演示）---------- */
export function aiPlan(g,id){
  const p=g.players[id],c=legalCities(g,id)[0],s=legalSettlements(g,id)[0],r=legalRoads(g,id)[0];
  if(c!==undefined&&canAfford(p,COSTS.city))return{type:'city',vid:c};
  if(s!==undefined&&canAfford(p,COSTS.settlement))return{type:'settlement',vid:s};
  if(r!==undefined&&canAfford(p,COSTS.road))return{type:'road',eid:r};
  if(canAfford(p,COSTS.card))return{type:'card'};
  const rich=RESOURCES.find(x=>p.resources[x]>=tradeRatio(p,x)),need=RESOURCES.find(x=>p.resources[x]===0);
  if(rich&&need)return{type:'trade',from:rich,to:need};
  return null
}
export function applyAiAction(g,id,act,rng=Math.random){
  if(!act)return false;
  if(act.type==='city')return placeCity(g,id,act.vid);
  if(act.type==='settlement')return placeSettlement(g,id,act.vid);
  if(act.type==='road')return placeRoad(g,id,act.eid);
  if(act.type==='card'){return drawCard(g,id,rng)!==null}
  if(act.type==='trade')return trade(g,id,act.from,act.to);
  return false
}
export function aiTurn(g,id,rng=Math.random){
  g.turn=id;g.phase='roll';roll(g,rng);
  let guard=0,act;
  while((act=aiPlan(g,id))&&guard++<6){if(!applyAiAction(g,id,act,rng))break}
  return checkWinner(g)
}
export function endHumanTurn(g,rng=Math.random){
  if(g.phase!=='action')return false;
  for(let id=1;id<4&&!g.winner;id++)aiTurn(g,id,rng);
  if(!g.winner){g.round++;g.turn=0;g.phase='roll';g.log='新一輪開始：輪到你擲骰。'}
  return true
}
