/**
 * D3 HTML template builder.
 * Takes extracted flow data and produces a self-contained HTML file.
 */

export function buildHtml(data, gapData = null) {
  const { title, subtitle, lanes, nodes, edges, scenarios } = data;
  const dataJson = JSON.stringify({ lanes, nodes, edges, scenarios });
  const gapJson = JSON.stringify(gapData);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Flow Explorer</title>
<script src="https://d3js.org/d3.v7.min.js"><\/script>
<style>
:root{--bg:#1a1e2e;--surface:#232840;--surface2:#2c3252;--surface3:#353c60;--border:#454d78;--text:#eef0f8;--dim:#9ba3c4;--accent:#7d9bff;--green:#5eeb96;--yellow:#ffd84d;--red:#ff8888;--teal:#40e8d4;--purple:#d0a0ff;--orange:#ffaa55;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'Pretendard',-apple-system,system-ui,sans-serif;overflow:hidden;height:100vh;display:flex;flex-direction:column;}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;z-index:10;}
.topbar h1{font-size:16px;font-weight:700;} .topbar h1 span{color:var(--accent);}
.topbar p{font-size:12px;color:var(--dim);margin-top:2px;}
.topbar-right{display:flex;gap:10px;align-items:center;}
.mode-btn{font-size:12px;padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--dim);cursor:pointer;transition:all .2s;}
.mode-btn:hover,.mode-btn.active{border-color:var(--accent);color:var(--accent);background:rgba(125,155,255,.08);}
.main{display:flex;flex:1;overflow:hidden;}
.sidebar{width:260px;background:var(--surface);border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;padding:16px 0;}
.sb-section{padding:0 16px;margin-bottom:16px;}
.sb-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--dim);margin-bottom:8px;}
.sc-btn{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--text);font-size:12px;text-align:left;cursor:pointer;transition:all .15s;margin-bottom:2px;}
.sc-btn:hover{background:var(--surface2);border-color:var(--border);}
.sc-btn.active{background:rgba(125,155,255,.1);border-color:var(--accent);}
.sc-btn .sc-badge{font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;flex-shrink:0;font-family:monospace;}
.sc-btn .sc-text{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.canvas-wrap{flex:1;position:relative;overflow:hidden;} .canvas-wrap svg{width:100%;height:100%;}
.lane-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;}
.edge{fill:none;stroke:#5060a0;stroke-width:1.8;}
.node-group{cursor:pointer;} .node-group:hover .node-shape{filter:brightness(1.3);}
.node-label{font-size:11px;fill:var(--text);font-weight:600;text-anchor:middle;pointer-events:none;}
.node-sub{font-size:9px;fill:var(--dim);text-anchor:middle;pointer-events:none;}
.particle{pointer-events:none;}
.reaction-card{background:var(--surface3);border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;font-family:inherit;color:var(--text);width:100%;height:100%;overflow:hidden;transition:border-color .3s,box-shadow .3s;}
.reaction-card.highlight{border-color:var(--accent);box-shadow:0 0 24px rgba(125,155,255,.25);}
.rc-title{font-size:11px;font-weight:700;margin-bottom:3px;line-height:1.3;}
.rc-body{font-size:10px;color:var(--text);opacity:.8;line-height:1.4;margin-bottom:5px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.rc-chips{display:flex;gap:3px;flex-wrap:wrap;}
.rc-chip{font-size:8px;padding:2px 6px;border-radius:8px;background:rgba(125,155,255,.18);color:var(--accent);border:1px solid rgba(125,155,255,.25);white-space:nowrap;}
.rc-chip.nav{background:rgba(64,232,212,.18);color:var(--teal);border-color:rgba(64,232,212,.25);}
.rc-chip.recover{background:rgba(255,216,77,.15);color:var(--yellow);border-color:rgba(255,216,77,.25);}
.rc-chip.none{background:rgba(255,136,136,.15);color:var(--red);border-color:rgba(255,136,136,.25);}
.detail-panel{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;min-width:480px;max-width:700px;box-shadow:0 8px 32px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .3s;z-index:20;}
.detail-panel.visible{opacity:1;pointer-events:auto;}
.dp-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;}
.dp-id{font-size:12px;font-family:monospace;color:var(--accent);}
.dp-type{font-size:10px;padding:3px 8px;border-radius:10px;font-weight:600;}
.dp-title{font-size:15px;font-weight:700;margin-bottom:4px;}
.dp-situation{font-size:12px;color:var(--dim);margin-bottom:12px;line-height:1.5;}
.dp-reaction{background:var(--surface2);border-radius:8px;padding:12px 14px;border-left:3px solid var(--accent);}
.dp-field{margin-bottom:6px;} .dp-field:last-child{margin-bottom:0;}
.dp-key{font-size:10px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.dp-val{font-size:13px;margin-top:2px;line-height:1.5;}
.dp-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;}
.dp-chip{font-size:11px;padding:3px 10px;border-radius:12px;background:rgba(125,155,255,.12);color:var(--accent);border:1px solid rgba(125,155,255,.25);}
.dp-chip.nav{background:rgba(64,232,212,.12);color:var(--teal);border-color:rgba(64,232,212,.25);}
.dp-chip.recover{background:rgba(255,216,77,.1);color:var(--yellow);border-color:rgba(255,216,77,.2);}
.dp-chip.none{background:rgba(255,136,136,.1);color:var(--red);border-color:rgba(255,136,136,.2);}
.dp-close{position:absolute;top:12px;right:14px;background:none;border:none;color:var(--dim);font-size:18px;cursor:pointer;}
.step-bar{display:flex;align-items:center;gap:4px;margin-bottom:12px;}
.step-dot{width:7px;height:7px;border-radius:50%;background:var(--green);}
.step-connector{width:14px;height:2px;background:var(--green);}
.tooltip{position:absolute;padding:8px 12px;background:var(--surface3);border:1px solid var(--border);border-radius:8px;font-size:11px;color:var(--text);pointer-events:none;opacity:0;transition:opacity .15s;z-index:30;max-width:300px;line-height:1.5;}
.gap-btn{font-size:11px;padding:5px 14px;border-radius:6px;border:1px solid #ff8888;background:transparent;color:#ff8888;cursor:pointer;transition:all .2s;margin-left:4px;}
.gap-btn:hover,.gap-btn.active{background:rgba(255,136,136,.12);}
.gap-panel{position:absolute;top:0;right:0;width:360px;height:100%;background:var(--surface);border-left:1px solid var(--border);z-index:15;overflow-y:auto;transform:translateX(100%);transition:transform .3s;padding:18px;}
.gap-panel.open{transform:translateX(0);}
.gap-panel h2{font-size:14px;font-weight:700;margin-bottom:4px;}
.gap-panel .gap-sub{font-size:11px;color:var(--dim);margin-bottom:14px;}
.gap-score{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface2);border-radius:10px;margin-bottom:14px;}
.gap-score .sn{font-size:26px;font-weight:800;line-height:1;}
.gap-score .sl{font-size:11px;color:var(--dim);}
.gap-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;}
.gap-stat{background:var(--surface2);border-radius:8px;padding:8px 10px;text-align:center;}
.gap-stat .gn{font-size:18px;font-weight:700;line-height:1.2;}
.gap-stat .gl{font-size:9px;color:var(--dim);}
.gap-sec{margin-bottom:14px;}
.gap-sec h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--dim);margin-bottom:6px;display:flex;align-items:center;gap:6px;}
.gap-sec h3 .cnt{font-size:10px;padding:2px 6px;border-radius:6px;font-weight:600;}
.gap-item{font-size:11px;padding:7px 10px;background:var(--surface2);border-radius:7px;margin-bottom:4px;border-left:3px solid var(--border);line-height:1.5;cursor:pointer;transition:background .15s;}
.gap-item:hover{background:var(--surface3);}
.gap-item.risk-c{border-left-color:#ff8888;} .gap-item.risk-w{border-left-color:#ffd84d;} .gap-item.risk-i{border-left-color:#5eeb96;}
.gap-item .gi-t{font-weight:600;margin-bottom:2px;font-size:11px;}
.gap-item .gi-d{font-size:10px;color:var(--dim);}
.gap-item .gi-src{font-size:9px;color:var(--accent);margin-top:2px;}
.sidebar::-webkit-scrollbar{width:4px;} .sidebar::-webkit-scrollbar-track{background:transparent;} .sidebar::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
</style>
</head>
<body>
<div class="topbar">
  <div><h1><span>${esc(title)}</span> — Flow Explorer</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>
  <div class="topbar-right" id="filter-bar"></div>
</div>
<div class="main">
  <div class="sidebar" id="sidebar"></div>
  <div class="canvas-wrap" id="canvas-wrap">
    <svg id="graph"></svg>
    <div class="gap-panel" id="gap-panel"></div>
  </div>
</div>
<div class="detail-panel" id="detail-panel">
  <button class="dp-close" onclick="hideDetail()">&times;</button>
  <div id="dp-content"></div>
</div>
<div class="tooltip" id="tooltip"></div>
<script>
// ── Injected data ──
const DATA = ${dataJson};
const GAP = ${gapJson};

// ── Layout constants ──
const MIN_LANE_H = 200;
const NODE_SLOT_H = 55;
const PAD_TOP = 35;
const PAD_BOTTOM = 25;
const LANE_GAP = 16;
const COL_W = [100, 270, 440, 630, 860, 1010, 1180, 1330];
const laneKeys = Object.keys(DATA.lanes);
const TYPE_COLORS = {normal:'#5eeb96',hard_error:'#ff8888',recoverable:'#ffd84d',navigation:'#40e8d4',progress:'#ffaa55'};

// Count nodes per lane
const laneNodeCounts = {};
laneKeys.forEach(k => { laneNodeCounts[k] = 0; });
DATA.nodes.forEach(n => { if (laneNodeCounts[n.lane] !== undefined) laneNodeCounts[n.lane]++; });

// Dynamic lane heights: PAD_TOP + content + PAD_BOTTOM, with gap between lanes
const laneContentH = {};
const laneTotalH = {};
const laneOffsets = {};
let cumY = 60;
laneKeys.forEach(k => {
  const count = laneNodeCounts[k] || 1;
  const rows = Math.max(3, Math.ceil(count / 2.5));
  const contentH = rows * NODE_SLOT_H;
  const totalH = Math.max(MIN_LANE_H, PAD_TOP + contentH + PAD_BOTTOM);
  laneContentH[k] = totalH - PAD_TOP - PAD_BOTTOM;
  laneTotalH[k] = totalH;
  laneOffsets[k] = cumY;
  cumY += totalH + LANE_GAP;
});
const W = 1520, H = cumY + 30;

function lY(lane, off) { return (laneOffsets[lane] || 60) + PAD_TOP + (off || 0); }

// Position nodes: row 0..1 maps within the content area
// Cards are clamped so they don't overflow the lane bottom
const nodeMap = new Map();
DATA.nodes.forEach(n => {
  const ch = laneContentH[n.lane] || 120;
  n.x = COL_W[n.col] || COL_W[0];
  const rawY = (n.row || 0) * ch;
  // Clamp: ensure node + its height stays within content area
  const nodeH = n.shape === 'card' ? (n.h || 115) : n.shape === 'pill' ? 26 : n.shape === 'rect' ? 40 : 40;
  const maxY = Math.max(0, ch - nodeH + 10);
  n.y = lY(n.lane, Math.min(rawY, maxY));
  nodeMap.set(n.id, n);
});

// ── Sidebar ──
const sidebarEl = document.getElementById('sidebar');
laneKeys.forEach(lane => {
  const sec = document.createElement('div');
  sec.className='sb-section'; sec.setAttribute('data-lane',lane);
  sec.innerHTML='<div class="sb-label">'+DATA.lanes[lane].label+'</div>';
  DATA.scenarios.filter(s=>s.lane===lane).forEach(sc=>{
    const btn=document.createElement('button');
    btn.className='sc-btn'; btn.setAttribute('data-id',sc.id);
    const col=TYPE_COLORS[sc.type]||'#7d9bff';
    btn.innerHTML='<span class="sc-badge" style="background:'+col+'22;color:'+col+'">'+sc.id+'</span><span class="sc-text">'+sc.label+'</span>';
    btn.onclick=()=>selectScenario(sc.id);
    sec.appendChild(btn);
  });
  sidebarEl.appendChild(sec);
});

// ── Filter buttons ──
const filterBar=document.getElementById('filter-bar');
const allBtn=document.createElement('button');
allBtn.className='mode-btn active';allBtn.textContent='All';allBtn.onclick=()=>setFilter('all');
filterBar.appendChild(allBtn);
laneKeys.forEach(k=>{
  const b=document.createElement('button');
  b.className='mode-btn';b.textContent=DATA.lanes[k].label;b.setAttribute('data-lane',k);
  b.onclick=()=>setFilter(k);
  filterBar.appendChild(b);
});

// ── SVG setup ──
const wrap=document.getElementById('canvas-wrap');
const svg=d3.select('#graph');
const g=svg.append('g');
const zoom=d3.zoom().scaleExtent([0.2,3]).on('zoom',e=>g.attr('transform',e.transform));
svg.call(zoom);
function fitView(){const r=wrap.getBoundingClientRect();const sc=Math.min(r.width/W,r.height/H)*0.88;svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity.translate((r.width-W*sc)/2,(r.height-H*sc)/2).scale(sc));}
setTimeout(fitView,100); window.addEventListener('resize',()=>setTimeout(fitView,200));

// Lanes
laneKeys.forEach(k=>{
  const ly=laneOffsets[k], th=laneTotalH[k], c=DATA.lanes[k].color;
  g.append('rect').attr('x',30).attr('y',ly).attr('width',W-60).attr('height',th).attr('rx',10).attr('fill',c).attr('opacity',0.06);
  g.append('text').attr('class','lane-label').attr('x',46).attr('y',ly+16).text(DATA.lanes[k].label).attr('fill',c).attr('opacity',0.6);
});

// ── Edge helpers ──
function nOut(n){
  if(n.shape==='card')return{x:n.x+(n.w||190),y:n.y+(n.h||115)/2};
  if(n.shape==='pill')return{x:n.x+110,y:n.y+13};
  if(n.shape==='rect')return{x:n.x+100,y:n.y+20};
  if(n.shape==='circle')return{x:n.x+58,y:n.y+20};
  return{x:n.x+40,y:n.y+20};
}
function nIn(n){
  if(n.shape==='card')return{x:n.x,y:n.y+(n.h||115)/2};
  if(n.shape==='pill')return{x:n.x,y:n.y+13};
  if(n.shape==='rect')return{x:n.x,y:n.y+20};
  if(n.shape==='circle')return{x:n.x+22,y:n.y+20};
  if(n.shape==='octagon')return{x:n.x+4,y:n.y+16};
  if(n.shape==='diamond-sm')return{x:n.x,y:n.y+14};
  return{x:n.x,y:n.y+20};
}
function nBot(n){
  if(n.shape==='card')return{x:n.x+(n.w||190)/2,y:n.y+(n.h||115)};
  if(n.shape==='pill')return{x:n.x+55,y:n.y+26};
  if(n.shape==='rect')return{x:n.x+50,y:n.y+40};
  if(n.shape==='circle')return{x:n.x+40,y:n.y+38};
  return{x:n.x+20,y:n.y+32};
}
function nTop(n){
  if(n.shape==='card')return{x:n.x+(n.w||190)/2,y:n.y};
  if(n.shape==='pill')return{x:n.x+55,y:n.y};
  if(n.shape==='rect')return{x:n.x+50,y:n.y};
  if(n.shape==='circle')return{x:n.x+40,y:n.y+2};
  return{x:n.x+20,y:n.y};
}
function edgePath(e){
  const sn=nodeMap.get(e.source),tn=nodeMap.get(e.target);if(!sn||!tn)return'';
  if(e.type==='cross'){const p1=nBot(sn),p2=nTop(tn),my=(p1.y+p2.y)/2;return'M'+p1.x+','+p1.y+' C'+p1.x+','+my+' '+p2.x+','+my+' '+p2.x+','+p2.y;}
  if(e.type==='error'){const p1=nBot(sn),p2=nTop(tn);if(Math.abs(p2.x-p1.x)<180){const my=p1.y+(p2.y-p1.y)*0.4;return'M'+p1.x+','+p1.y+' C'+p1.x+','+my+' '+p2.x+','+(my+(p2.y-p1.y)*0.2)+' '+p2.x+','+p2.y;}const out=nOut(sn);return'M'+out.x+','+out.y+' C'+(out.x+40)+','+out.y+' '+(out.x+40)+','+p2.y+' '+p2.x+','+p2.y;}
  const p1=nOut(sn),p2=nIn(tn),cp=Math.max(30,(p2.x-p1.x)*0.38);
  return'M'+p1.x+','+p1.y+' C'+(p1.x+cp)+','+p1.y+' '+(p2.x-cp)+','+p2.y+' '+p2.x+','+p2.y;
}

// Markers
const defs=svg.append('defs');
[['arrow','#6070a0'],['arrow-active','#7d9bff'],['arrow-err','#ff8888aa'],['arrow-cross','#40e8d4aa'],['arrow-tree','#7d9bff88']].forEach(([id,fill])=>{
  defs.append('marker').attr('id',id).attr('viewBox','0 0 10 6').attr('refX',9).attr('refY',3).attr('markerWidth',7).attr('markerHeight',5).attr('orient','auto').append('path').attr('d','M0,0.5 L9,3 L0,5.5').attr('fill',fill);
});

// Draw edges
const edgesG=g.append('g');
DATA.edges.forEach(e=>{
  const col=e.type==='error'?'#ff888855':e.type==='cross'?'#40e8d460':e.type==='tree'?'#7d9bff50':'#5565a0';
  const mk=e.type==='error'?'url(#arrow-err)':e.type==='cross'?'url(#arrow-cross)':e.type==='tree'?'url(#arrow-tree)':'url(#arrow)';
  const p=edgesG.append('path').attr('class','edge edge-'+e.source+'-'+e.target).attr('d',edgePath(e)).attr('stroke',col).attr('stroke-width',e.type==='tree'?1.5:1.8).attr('marker-end',mk).attr('data-source',e.source).attr('data-target',e.target).attr('data-type',e.type);
  if(e.type==='error')p.attr('stroke-dasharray','5 4');
  if(e.type==='cross')p.attr('stroke-dasharray','8 5');
});

// Draw nodes
const nodesG=g.append('g');
DATA.nodes.forEach(n=>{
  const ng=nodesG.append('g').attr('class','node-group node-'+n.id).attr('transform','translate('+n.x+','+n.y+')').attr('data-id',n.id).attr('data-lane',n.lane);
  const lc=DATA.lanes[n.lane].color;
  if(n.shape==='circle'){
    ng.append('circle').attr('class','node-shape').attr('cx',40).attr('cy',20).attr('r',18).attr('fill',lc+'35').attr('stroke',lc).attr('stroke-width',2);
    ng.append('text').attr('class','node-label').attr('x',40).attr('y',50).text(n.label);
    ng.append('text').attr('class','node-sub').attr('x',40).attr('y',62).text(n.sub||'');
  } else if(n.shape==='rect'){
    ng.append('rect').attr('class','node-shape').attr('width',100).attr('height',40).attr('rx',8).attr('fill',lc+'22').attr('stroke',lc+'99').attr('stroke-width',1.5);
    ng.append('text').attr('class','node-label').attr('x',50).attr('y',18).text(n.label);
    ng.append('text').attr('class','node-sub').attr('x',50).attr('y',32).text(n.sub||'');
  } else if(n.shape==='pill'){
    const col=n.chipKind==='nav'?'#40e8d4':lc;
    ng.append('rect').attr('class','node-shape').attr('width',110).attr('height',26).attr('rx',13).attr('fill',col+'25').attr('stroke',col+'90').attr('stroke-width',1.5);
    ng.append('text').attr('x',55).attr('y',17).attr('text-anchor','middle').attr('font-size','10').attr('font-weight','600').attr('fill',col).text(n.label);
  } else if(n.shape==='octagon'){
    const s=16,cx=20,cy=16;const pts=Array.from({length:8},(_,i)=>{const a=(Math.PI*2*i/8)-Math.PI/8;return(cx+s*Math.cos(a))+','+(cy+s*Math.sin(a));}).join(' ');
    ng.append('polygon').attr('class','node-shape').attr('points',pts).attr('fill',n.err==='hard'?'#ff888840':'#ffd84d35').attr('stroke',n.err==='hard'?'#ff8888':'#ffd84d').attr('stroke-width',2);
    ng.append('text').attr('class','node-label').attr('x',20).attr('y',42).text(n.label).attr('font-size','9');
    ng.append('text').attr('class','node-sub').attr('x',20).attr('y',54).text(n.sub||'').attr('font-size','8');
  } else if(n.shape==='diamond-sm'){
    ng.append('polygon').attr('class','node-shape').attr('points','20,0 40,14 20,28 0,14').attr('fill','#ffd84d30').attr('stroke','#ffd84d').attr('stroke-width',1.5);
    ng.append('text').attr('class','node-label').attr('x',20).attr('y',40).text(n.label).attr('font-size','9');
    ng.append('text').attr('class','node-sub').attr('x',20).attr('y',52).text(n.sub||'').attr('font-size','8');
  } else if(n.shape==='card'){
    ng.append('foreignObject').attr('width',n.w||190).attr('height',n.h||115)
      .append('xhtml:div').attr('class','reaction-card').attr('id','card-'+n.id)
      .html('<div class="rc-title" style="color:var(--dim);">AI Reaction</div><div class="rc-body">Select a scenario</div>');
  }
  if(n.shape!=='card'){
    ng.on('mouseenter',ev=>{const tt=document.getElementById('tooltip');tt.innerHTML='<strong>'+n.label+'</strong>'+(n.sub?'<br>'+n.sub:'');tt.style.opacity=1;const r=wrap.getBoundingClientRect();tt.style.left=(ev.clientX-r.left+12)+'px';tt.style.top=(ev.clientY-r.top-10)+'px';}).on('mouseleave',()=>{document.getElementById('tooltip').style.opacity=0;});
  }
});

// ── Scenario replay ──
let activeScenario=null;
function selectScenario(id){
  if(activeScenario===id){activeScenario=null;resetHL();hideDetail();updBtns();return;}
  activeScenario=id;updBtns();
  const sc=DATA.scenarios.find(s=>s.id===id);if(!sc)return;
  d3.selectAll('.node-group').transition().duration(300).attr('opacity',0.12);
  d3.selectAll('.edge').transition().duration(300).attr('opacity',0.04);
  resetCards();
  sc.path.forEach((nid,i)=>{setTimeout(()=>{d3.select('.node-'+nid).transition().duration(400).attr('opacity',1);},i*300);});
  sc.path.forEach((nid,i)=>{if(!i)return;const prev=sc.path[i-1];setTimeout(()=>{const col=sc.type==='hard_error'?'#ff8888':sc.type==='recoverable'?'#ffd84d':sc.type==='navigation'?'#40e8d4':'#7d9bff';d3.select('.edge-'+prev+'-'+nid).transition().duration(400).attr('opacity',1).attr('stroke',col).attr('stroke-width',2.5).attr('marker-end','url(#arrow-active)');animP(prev,nid,col);},i*300);});
  setTimeout(()=>{if(sc.reactNode&&sc.reaction)fillCard(sc.reactNode,sc.reaction);if(sc.replaceNode&&sc.replaceReaction)fillCard(sc.replaceNode,sc.replaceReaction);showDetail(sc);},sc.path.length*300+200);
}
function animP(s,t,col){const el=d3.select('.edge-'+s+'-'+t).node();if(!el)return;const len=el.getTotalLength();const p=g.append('circle').attr('class','particle').attr('r',4).attr('fill',col).attr('opacity',0.9);p.transition().duration(500).ease(d3.easeQuadInOut).attrTween('cx',()=>t2=>el.getPointAtLength(t2*len).x).attrTween('cy',()=>t2=>el.getPointAtLength(t2*len).y).on('end',()=>p.transition().duration(200).attr('opacity',0).remove());}
function fillCard(nid,r){const el=document.getElementById('card-'+nid);if(!el)return;el.classList.add('highlight');const ch=r.chips.map(c=>'<span class="rc-chip '+(c.k==='nav'?'nav':c.k==='recover'?'recover':c.k==='none'?'none':'')+'">'+c.t+'</span>').join('');el.innerHTML='<div class="rc-title">'+r.title+'</div><div class="rc-body">'+r.body+'</div><div class="rc-chips">'+ch+'</div>';}
function resetCards(){document.querySelectorAll('.reaction-card').forEach(el=>{el.classList.remove('highlight');el.innerHTML='<div class="rc-title" style="color:var(--dim);">AI Reaction</div><div class="rc-body">Select a scenario</div>';});}
function resetHL(){d3.selectAll('.node-group').transition().duration(400).attr('opacity',1);d3.selectAll('.edge').each(function(){const el=d3.select(this),tp=el.attr('data-type');const col=tp==='error'?'#ff888855':tp==='cross'?'#40e8d460':tp==='tree'?'#7d9bff50':'#5565a0';const mk=tp==='error'?'url(#arrow-err)':tp==='cross'?'url(#arrow-cross)':tp==='tree'?'url(#arrow-tree)':'url(#arrow)';el.transition().duration(400).attr('opacity',1).attr('stroke',col).attr('stroke-width',tp==='tree'?1.5:1.8).attr('marker-end',mk);});d3.selectAll('.particle').remove();resetCards();}
function updBtns(){document.querySelectorAll('.sc-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-id')===activeScenario));}

// ── Detail panel ──
function showDetail(sc){
  const col=TYPE_COLORS[sc.type]||'#7d9bff';const tl={normal:'Normal',hard_error:'Hard Error',recoverable:'Recoverable',navigation:'Navigation',progress:'In Progress'}[sc.type]||sc.type;
  const steps=sc.path.map(()=>'<div class="step-dot"></div><div class="step-connector"></div>').join('').replace(/<div class="step-connector"><\\/div>$/,'');
  const ch=sc.reaction.chips.map(c=>'<span class="dp-chip '+(c.k==='nav'?'nav':c.k==='recover'?'recover':c.k==='none'?'none':'')+'">'+c.t+'</span>').join('');
  let rpl='';
  if(sc.replaceReaction){const rc=sc.replaceReaction.chips.map(c=>'<span class="dp-chip '+(c.k==='nav'?'nav':c.k==='recover'?'recover':c.k==='none'?'none':'')+'">'+c.t+'</span>').join('');rpl='<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);"><div class="dp-key" style="color:var(--purple);margin-bottom:4px;">Chip Click → Replace</div><div class="dp-field"><div class="dp-key">Title</div><div class="dp-val">'+sc.replaceReaction.title+'</div></div><div class="dp-field"><div class="dp-key">Body</div><div class="dp-val">'+sc.replaceReaction.body+'</div></div><div class="dp-field"><div class="dp-key">Chips</div><div class="dp-chips">'+rc+'</div></div></div>';}
  document.getElementById('dp-content').innerHTML='<div class="dp-header"><span class="dp-id">'+sc.id+'</span><span class="dp-type" style="background:'+col+'20;color:'+col+'">'+tl+'</span></div><div class="step-bar">'+steps+'</div><div class="dp-title">'+sc.label+'</div><div class="dp-situation">'+sc.situation+'</div><div class="dp-reaction"><div class="dp-field"><div class="dp-key">Title</div><div class="dp-val">'+sc.reaction.title+'</div></div><div class="dp-field"><div class="dp-key">Body</div><div class="dp-val">'+sc.reaction.body+'</div></div><div class="dp-field"><div class="dp-key">Chips</div><div class="dp-chips">'+ch+'</div></div>'+rpl+'</div>';
  document.getElementById('detail-panel').classList.add('visible');
}
function hideDetail(){document.getElementById('detail-panel').classList.remove('visible');}

// ── Lane filter ──
function setFilter(k){
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  if(k==='all'){document.querySelector('.mode-btn').classList.add('active');} else {document.querySelector('.mode-btn[data-lane="'+k+'"]').classList.add('active');}
  if(activeScenario){activeScenario=null;resetHL();hideDetail();updBtns();}
  if(k==='all'){d3.selectAll('.node-group').transition().duration(400).attr('opacity',1);d3.selectAll('.edge').transition().duration(400).attr('opacity',1);document.querySelectorAll('.sb-section').forEach(s=>s.style.display='');}
  else{d3.selectAll('.node-group').transition().duration(400).attr('opacity',function(){return d3.select(this).attr('data-lane')===k?1:0.06;});d3.selectAll('.edge').transition().duration(400).attr('opacity',function(){const s=nodeMap.get(d3.select(this).attr('data-source')),t=nodeMap.get(d3.select(this).attr('data-target'));return(s&&s.lane===k)||(t&&t.lane===k)?1:0.03;});document.querySelectorAll('.sb-section').forEach(s=>s.style.display=s.getAttribute('data-lane')===k?'':'none');}
}

// Ambient pulse
(function pulse(){if(!activeScenario)d3.selectAll('.node-shape').each(function(){if(Math.random()>.995)d3.select(this).transition().duration(600).attr('opacity',.6).transition().duration(600).attr('opacity',1);});requestAnimationFrame(pulse);})();

// ══════════════════════════════════════════════
// COVERAGE OVERLAY + GAP REPORT (if GAP data injected)
// ══════════════════════════════════════════════
if (GAP && GAP.findings) {
  // Add Gap Report button to filter bar
  const gapBtn = document.createElement('button');
  gapBtn.className = 'gap-btn';
  gapBtn.textContent = 'Gap Report (' + GAP.findings.length + ')';
  gapBtn.onclick = toggleGap;
  document.getElementById('filter-bar').appendChild(gapBtn);

  // Update sidebar summary with coverage stats
  const stats = GAP.structural_stats || {};
  if (stats.totalNodes) {
    const sumEl = document.querySelector('.sb-section');
    if (sumEl) {
      const covHtml = document.createElement('div');
      covHtml.style.cssText = 'padding:8px 0;border-top:1px solid var(--border);margin-top:8px;font-size:11px;color:var(--dim);';
      const sc = GAP.score;
      const scCol = sc >= 90 ? '#5eeb96' : sc >= 70 ? '#ffd84d' : '#ff8888';
      covHtml.innerHTML = '<div style="display:flex;justify-content:space-between;"><span>Coverage Score</span><span style="font-weight:700;color:'+scCol+'">'+sc+'/100</span></div>'
        + '<div style="display:flex;justify-content:space-between;margin-top:2px;"><span>Nodes covered</span><span>'+stats.covNodePct+'%</span></div>'
        + '<div style="display:flex;justify-content:space-between;margin-top:2px;"><span>Edges covered</span><span>'+stats.covEdgePct+'%</span></div>'
        + '<div style="display:flex;justify-content:space-between;margin-top:2px;"><span>Findings</span><span style="color:#ff8888">'+GAP.findings.length+'</span></div>';
      sumEl.parentNode.insertBefore(covHtml, sumEl);
    }
  }

  // Coverage rings on nodes (based on scenario coverage from graph)
  const coveredNodeSet = new Set();
  DATA.scenarios.forEach(s => (s.path||[]).forEach(nid => coveredNodeSet.add(nid)));

  // Find nodes mentioned in findings
  const findingNodes = new Map();
  GAP.findings.forEach(f => {
    if (f.node) {
      const existing = findingNodes.get(f.node);
      if (!existing || sevRank(f.severity) > sevRank(existing)) findingNodes.set(f.node, f.severity);
    }
  });
  function sevRank(s) { return s==='critical'?3:s==='warning'?2:1; }

  // Add coverage indicators to nodes
  nodesG.selectAll('.node-group').each(function() {
    const el = d3.select(this);
    const id = el.attr('data-id');
    const n = nodeMap.get(id);
    if (!n || n.shape === 'card') return;

    const covered = coveredNodeSet.has(id);
    const findingSev = findingNodes.get(id);

    // Ring color: finding severity > covered > uncovered
    let ringCol, ringOp;
    if (findingSev === 'critical') { ringCol = '#ff8888'; ringOp = 0.7; }
    else if (findingSev === 'warning') { ringCol = '#ffd84d'; ringOp = 0.6; }
    else if (covered) { ringCol = '#5eeb96'; ringOp = 0.4; }
    else { ringCol = '#ff8888'; ringOp = 0.5; }

    // Draw ring based on shape
    if (n.shape === 'circle') {
      el.insert('circle', ':first-child').attr('cx',40).attr('cy',20).attr('r',23).attr('fill','none').attr('stroke',ringCol).attr('stroke-width',2).attr('stroke-dasharray','4 2').attr('opacity',ringOp);
    } else if (n.shape === 'rect') {
      el.insert('rect', ':first-child').attr('x',-3).attr('y',-3).attr('width',106).attr('height',46).attr('rx',10).attr('fill','none').attr('stroke',ringCol).attr('stroke-width',2).attr('stroke-dasharray','4 2').attr('opacity',ringOp);
    } else if (n.shape === 'pill') {
      el.insert('rect', ':first-child').attr('x',-3).attr('y',-3).attr('width',116).attr('height',32).attr('rx',16).attr('fill','none').attr('stroke',ringCol).attr('stroke-width',1.5).attr('stroke-dasharray','3 2').attr('opacity',ringOp);
    }

    // Badge with scenario count
    if (n.shape === 'rect' && covered) {
      let cnt = 0;
      DATA.scenarios.forEach(s => { if ((s.path||[]).includes(id)) cnt++; });
      el.append('circle').attr('cx',96).attr('cy',4).attr('r',8).attr('fill',ringCol).attr('opacity',0.85);
      el.append('text').attr('x',96).attr('y',7).attr('text-anchor','middle').attr('font-size',8).attr('font-weight',700).attr('fill','#1a1e2e').text(cnt);
    }
  });

  // Enhance tooltip with coverage info
  nodesG.selectAll('.node-group').on('mouseenter', function(ev) {
    const id = d3.select(this).attr('data-id');
    const n = nodeMap.get(id);
    if (!n || n.shape === 'card') return;
    const tt = document.getElementById('tooltip');
    let html = '<strong>' + (n.label||n.id) + '</strong>';
    if (n.sub) html += '<br>' + n.sub;
    // Coverage status
    const covered = coveredNodeSet.has(id);
    html += '<br><span style="color:' + (covered?'#5eeb96':'#ff8888') + '">' + (covered?'Covered':'Uncovered') + '</span>';
    // Scenario count
    let cnt = 0;
    DATA.scenarios.forEach(s => { if ((s.path||[]).includes(id)) cnt++; });
    if (cnt) html += ' (' + cnt + ' scenarios)';
    // Findings for this node
    const nf = GAP.findings.filter(f => f.node === id);
    nf.forEach(f => { html += '<br><span style="color:' + (f.severity==='critical'?'#ff8888':f.severity==='warning'?'#ffd84d':'#5eeb96') + '">' + f.severity + ': ' + f.title + '</span>'; });
    // Spec audit
    if (GAP.spec_audit) {
      const specs = GAP.spec_audit.filter(a => (a.scenarios_covered||[]).some(sc => {
        const scenario = DATA.scenarios.find(s => s.id === sc);
        return scenario && (scenario.path||[]).includes(id);
      }));
      if (specs.length) html += '<br><span style="color:#d0a0ff">Specs: ' + specs.map(s=>s.spec).join(', ') + '</span>';
    }
    tt.innerHTML = html; tt.style.opacity = 1;
    const r = document.getElementById('canvas-wrap').getBoundingClientRect();
    tt.style.left = (ev.clientX - r.left + 12) + 'px';
    tt.style.top = (ev.clientY - r.top - 10) + 'px';
  }).on('mouseleave', function() { document.getElementById('tooltip').style.opacity = 0; });

  // Enhance detail panel with coverage
  const origShowDetail = showDetail;
  showDetail = function(sc) {
    origShowDetail(sc);
    const dp = document.getElementById('dp-content');
    if (!dp) return;
    // Add coverage section
    let covHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">';
    // Covered specs
    covHtml += '<div><div style="font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">SpecDown Suites</div>';
    if (GAP.spec_audit) {
      const matched = GAP.spec_audit.filter(a => (a.scenarios_covered||[]).includes(sc.id));
      if (matched.length) matched.forEach(a => { covHtml += '<div style="font-size:11px;padding:2px 0;display:flex;align-items:center;gap:5px;"><span style="width:6px;height:6px;border-radius:50%;background:#5eeb96;display:inline-block;"></span><code style="font-size:10px;background:var(--surface2);padding:1px 5px;border-radius:3px;">' + a.spec + '</code></div>'; });
      else covHtml += '<div style="font-size:11px;color:var(--dim);">No spec coverage</div>';
    }
    covHtml += '</div>';
    // Findings for nodes in path
    covHtml += '<div><div style="font-size:10px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Findings on path</div>';
    const pathFindings = GAP.findings.filter(f => f.node && (sc.path||[]).includes(f.node));
    if (pathFindings.length) pathFindings.forEach(f => {
      const col = f.severity==='critical'?'#ff8888':f.severity==='warning'?'#ffd84d':'#5eeb96';
      covHtml += '<div style="font-size:11px;padding:2px 0;"><span style="color:'+col+'">'+f.severity+'</span> '+f.title+'</div>';
    });
    else covHtml += '<div style="font-size:11px;color:#5eeb96;">No issues on this path</div>';
    covHtml += '</div></div>';
    dp.insertAdjacentHTML('beforeend', covHtml);
  };
}

// ── Gap Report panel ──
let gapOpen = false;
function toggleGap() {
  gapOpen = !gapOpen;
  document.querySelector('.gap-btn')?.classList.toggle('active', gapOpen);
  const panel = document.getElementById('gap-panel');
  if (gapOpen && GAP) {
    const stats = GAP.structural_stats || {};
    const sc = GAP.score || 0;
    const scCol = sc >= 90 ? '#5eeb96' : sc >= 70 ? '#ffd84d' : '#ff8888';
    const high = GAP.findings.filter(f=>f.severity==='critical');
    const med = GAP.findings.filter(f=>f.severity==='warning');
    const low = GAP.findings.filter(f=>f.severity==='info');

    function renderSec(title, items, cls, col) {
      if (!items.length) return '<div class="gap-sec"><h3>'+title+' <span class="cnt" style="background:'+col+'20;color:'+col+'">0</span></h3><div style="font-size:10px;color:var(--dim);">None</div></div>';
      return '<div class="gap-sec"><h3>'+title+' <span class="cnt" style="background:'+col+'20;color:'+col+'">'+items.length+'</span></h3>'+items.map(f=>
        '<div class="gap-item '+cls+'" data-node="'+(f.node||'')+'" onmouseenter="hlGapNode(this)" onmouseleave="clGapHL()"><div class="gi-t">'+f.title+'</div><div class="gi-d">'+f.detail+'</div><div class="gi-src">'+(f.source||'')+' / '+(f.category||'')+'</div></div>'
      ).join('')+'</div>';
    }

    const exportBtn = '<button onclick="exportGapMd()" style="font-size:10px;padding:3px 10px;border-radius:6px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;">Export .md</button>';

    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><h2>Gap Report</h2>'+exportBtn+'</div>'
      + '<div class="gap-sub">Graph structural + LLM semantic analysis</div>'
      + '<div class="gap-score"><div class="sn" style="color:'+scCol+'">'+sc+'</div><div><div class="sl">Coverage Score</div><div style="font-size:10px;color:var(--dim);">'+(stats.coveredNodes||'?')+'/'+(stats.totalNodes||'?')+' nodes</div></div></div>'
      + '<div class="gap-stats"><div class="gap-stat"><div class="gn" style="color:var(--accent)">'+(stats.covNodePct||0)+'%</div><div class="gl">Nodes</div></div><div class="gap-stat"><div class="gn" style="color:var(--accent)">'+(stats.covEdgePct||0)+'%</div><div class="gl">Edges</div></div><div class="gap-stat"><div class="gn" style="color:var(--teal)">'+(stats.totalScenarios||0)+'</div><div class="gl">Scenarios</div></div><div class="gap-stat"><div class="gn" style="color:#ff8888">'+GAP.findings.length+'</div><div class="gl">Findings</div></div></div>'
      + renderSec('Critical', high, 'risk-c', '#ff8888')
      + renderSec('Warning', med, 'risk-w', '#ffd84d')
      + renderSec('Info', low, 'risk-i', '#5eeb96');
    panel.classList.add('open');
  } else {
    panel.classList.remove('open');
  }
}
function hlGapNode(el) {
  const nid = el.getAttribute('data-node');
  if (!nid) return;
  d3.selectAll('.node-group').attr('opacity', 0.12);
  d3.select('.node-'+nid).attr('opacity', 1);
}
function clGapHL() { d3.selectAll('.node-group').attr('opacity', 1); }
function exportGapMd() {
  if (!GAP) return;
  const now = new Date().toISOString().slice(0,10);
  const sev = {critical:'\\u{1F534}',warning:'\\u{1F7E1}',info:'\\u{1F7E2}'};
  let md = '# Gap Report\\n\\n> Score: **'+GAP.score+'/100** | Generated: '+now+'\\n\\n';
  md += '## Summary\\n\\n'+GAP.summary+'\\n\\n';
  md += '## Findings ('+GAP.findings.length+')\\n\\n';
  md += '| # | Sev | Source | Title |\\n|---|-----|--------|-------|\\n';
  GAP.findings.forEach((f,i) => { md += '| '+(i+1)+' | '+f.severity+' | '+(f.source||'')+' | '+f.title+' |\\n'; });
  GAP.findings.forEach(f => { md += '\\n### '+f.title+'\\n\\n'+f.detail+'\\n'; if(f.recommendation) md += '\\n> '+f.recommendation+'\\n'; });
  const blob = new Blob([md.replace(/\\\\n/g,'\\n')], {type:'text/markdown'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gap-report-'+now+'.md'; a.click();
}
<\/script>
</body>
</html>`;
}

function esc(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
