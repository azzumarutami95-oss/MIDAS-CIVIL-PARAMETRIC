'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../web/engine.js');
const faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
function config(nx=3,ny=2){const c=E.defaults();Object.assign(c.geometry,{shape:'rectangular',width:6,depth:4,heightOld:3,heightNew:2});Object.assign(c.mesh,{divX:nx,divY:ny,layersOld:2,layersNew:3});return c;}
function parse(text){const result={};let section;for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith(';'))continue;if(line.startsWith('*')){section=line;result[section]=[];}else result[section].push(line);}return result;}
function ids(s){return s.trim().split(/\s+/).filter(Boolean).flatMap(x=>{if(!x.includes('to'))return [+x];const [a,b]=x.split('to').map(Number);return Array.from({length:b-a+1},(_,i)=>a+i);});}

test('rectangular mesh has analytic dimensions, positive HEX8 cells and a shared old/new interface',()=>{
  const c=config(),m=E.build(c),s=parse(m.text),g=E.geometryInfo(c);
  assert.equal(g.shape,'rectangular');near(g.area,24);near(g.perimeter,20);near(g.notionalSize,2.4);near(g.volumeSurface,1.2);
  assert.equal(m.stats.quads,6);assert.equal(m.stats.planeNodes,12);assert.equal(m.stats.elements,30);assert.equal(m.stats.nodes,72);
  near(m.stats.volume,120);near(m.checks.volume,120);near(m.checks.volumeDeficitPercent,0);near(m.checks.minScaled,1);assert.ok(m.checks.minDet>0);
  const nodes=s['*NODE'].map(x=>x.split(',').map(Number)),cells=s['*ELEMENT'].map(x=>x.split(',').map(x=>x.trim()));
  assert.equal(new Set(nodes.map(x=>x.slice(1).join(','))).size,72);
  near(Math.min(...nodes.map(x=>x[1])),-3);near(Math.max(...nodes.map(x=>x[1])),3);
  near(Math.min(...nodes.map(x=>x[2])),-2);near(Math.max(...nodes.map(x=>x[2])),2);near(Math.max(...nodes.map(x=>x[3])),5);
  const old=new Set(),fresh=new Set();
  for(const cell of cells){assert.equal(cell[1],'SOLID');assert.equal(cell.length,12);const connected=cell.slice(4).map(Number);assert.equal(new Set(connected).size,8);connected.forEach(id=>{assert.ok(id>0&&id<=72);(cell[2]==='1'?old:fresh).add(id);});}
  const shared=[...old].filter(id=>fresh.has(id));assert.equal(shared.length,12);assert.ok(shared.every(id=>nodes[id-1][3]===3));
  near(m.monitors.find(n=>n.name==='NEW_SIDE').target[0],3);near(m.monitors.find(n=>n.name==='NEW_SIDE').coordinates[0],3);
  near(m.monitors.find(n=>n.name==='NEW_SIDE_Y').target[1],2);near(m.monitors.find(n=>n.name==='NEW_SIDE_Y').coordinates[1],2);
});

test('exported rectangular convection covers every exposed non-base face, including corner element faces, throughout staging',()=>{
  for(const [nx,ny] of [[1,1],[3,2],[7,5]]){
    const c=config(nx,ny),m=E.build(c),s=parse(m.text),nodes=s['*NODE'].map(x=>x.split(',').map(Number));
    const cells=s['*ELEMENT'].map(x=>x.split(',').slice(4).map(Number)),groups={},boundary={};
    for(const line of s['*GROUP']){const f=line.split(',').map(x=>x.trim());groups[f[0]]=ids(f[2]);}
    for(const line of s['*HYD-CONBNDR']){const f=line.split(',').map(x=>x.trim());boundary[f[4]]??=[];for(const id of ids(f[0]))boundary[f[4]].push({id,face:+f[3]});}
    assert.deepEqual(new Set(boundary.OLD_SIDE.map(x=>x.face)),new Set([3,4,5,6]));
    const cornerCounts=new Map();for(const x of boundary.OLD_SIDE)cornerCounts.set(x.id,(cornerCounts.get(x.id)||0)+1);
    assert.ok([...cornerCounts.values()].some(n=>n>=2));
    const stages=[];let stage;
    for(const line of s['*HYD-STAGE']){const at=line.indexOf('='),key=line.slice(0,at),value=line.slice(at+1);if(key==='NAME'){stage={name:value.split(',')[0],AELEM:[],ABNDR:[],DBNDR:[]};stages.push(stage);}else if(['AELEM','ABNDR','DBNDR'].includes(key))stage[key]=value.split(',').map(x=>x.trim());}
    const active=new Set(),activeB=new Set();
    const key=(id,face)=>faces[face-1].map(i=>cells[id-1][i]).sort((a,b)=>a-b).join(':');
    for(const [index,st] of stages.entries()){
      for(const name of st.AELEM)for(const id of groups[name]){assert.ok(!active.has(id));active.add(id);}
      st.DBNDR.forEach(name=>assert.ok(activeB.delete(name)));st.ABNDR.forEach(name=>{assert.ok(!activeB.has(name));activeB.add(name);});
      const all=new Map();for(const id of active)for(let face=1;face<=6;face++){const k=key(id,face);all.set(k,(all.get(k)||0)+1);}
      const expected=new Set([...all].filter(([k,count])=>count===1&&!k.split(':').every(id=>nodes[+id-1][3]===0)).map(([k])=>k));
      const actual=new Set();for(const name of activeB)for(const {id,face} of boundary[name]||[]){assert.ok(active.has(id));const k=key(id,face);assert.equal(all.get(k),1);assert.ok(!actual.has(k));actual.add(k);}
      assert.deepEqual(actual,expected,`${nx}x${ny} stage ${index}`);
      assert.equal(actual.size,2*(nx+ny)*(index===0?c.mesh.layersOld:c.mesh.layersOld+c.mesh.layersNew)+nx*ny);
      if(index>0)assert.ok(!activeB.has('OLD_TOP'));
    }
  }
});

test('rectangle parameters survive JSON, legacy circles migrate, and partial or invalid new models reject export',()=>{
  const c=config(7,5),saved={schema:'civil-heat-studio/v1',config:c};assert.deepEqual(E.cleanConfig(JSON.parse(JSON.stringify(saved))),c);
  const old=E.defaults();old.geometry.diameter=5;delete old.geometry.shape;delete old.geometry.width;delete old.geometry.depth;delete old.mesh.divX;delete old.mesh.divY;
  const migrated=E.cleanConfig(old);assert.equal(migrated.geometry.shape,'circular');assert.equal(migrated.geometry.diameter,5);assert.equal(migrated.mesh.divX,16);assert.equal(E.estimate(migrated).nodes,26433);
  for(const remove of [x=>delete x.geometry.width,x=>delete x.geometry.shape,x=>delete x.mesh.divX]){const next=config();remove(next);assert.throws(()=>E.cleanConfig(next));}
  for(const change of [x=>x.geometry.shape='triangle',x=>x.geometry.width=0,x=>x.geometry.depth=-1,x=>x.geometry.width=Infinity,x=>x.mesh.divX=2.5,x=>x.mesh.divY=0,x=>Object.assign(x.mesh,{divX:128,divY:128,layersOld:64,layersNew:64})]){const next=config();change(next);assert.ok(E.validate(next).errors.length);assert.throws(()=>E.build(next));}
});

test('inactive shape controls do not change the active mesh and circular defaults remain unchanged',()=>{
  const c=config();c.mesh.sideDiv=15;c.mesh.radialDiv=-1;c.geometry.diameter=0;assert.equal(E.validate(c).errors.length,0);assert.equal(E.estimate(c).elements,30);
  const circle=E.defaults();circle.mesh.divX=128;circle.mesh.divY=128;assert.equal(E.validate(circle).errors.length,0);assert.equal(E.estimate(circle).elements,24576);
  const m=E.build(circle);assert.equal(m.stats.nodes,26433);assert.equal(m.stats.elements,24576);assert.deepEqual(m.stages.map(x=>x.convectionFaces),[1792,2816,2816,2816]);
});
