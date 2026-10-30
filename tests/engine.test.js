'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../web/engine.js');
const model=E.build(E.defaults());

function parseMCT(text){
  const sections={};let section;
  for(const line of text.split(/\r?\n/)){
    if(!line.trim()||line.trim().startsWith(';'))continue;
    if(line.startsWith('*')){section=line.trim();sections[section]=[];}
    else sections[section].push(line.trim());
  }
  return sections;
}
const sections=parseMCT(model.text);
function expand(text){
  const ids=[];
  for(const span of text.trim().split(/\s+/)){
    if(!span)continue;
    if(span.includes('to')){const [a,b]=span.split('to').map(Number);for(let i=a;i<=b;i++)ids.push(i);}
    else ids.push(Number(span));
  }
  return ids;
}
function close(a,b,tolerance=1e-8){assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);}
const faceNodes=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];

test('photo mix distinguishes w/c, w/b and water correction without changing thermal inputs',()=>{
  const c=E.defaults(),r=E.mixMetrics(c);
  close(r.wc,151/432);close(r.wb,151/540);close(r.binder,540);close(r.flyash,20);
  close(r.total,2426.26);close(r.batchWater,4.18516);close(r.batchSand,27.2636);close(r.batchGravel,34.21124);
  c.mix.flyash=150;E.mixMetrics(c);
  assert.equal(c.heat.K,45);assert.equal(c.material.fc,30);assert.equal(c.material.density,2400);
});

test('exported geometry has required counts, shared interface and no coincident nodes',()=>{
  const nodes=sections['*NODE'].map(s=>s.split(',').map(Number));
  const elements=sections['*ELEMENT'].map(s=>s.split(',').map(s=>s.trim()));
  assert.equal(nodes.length,26433);assert.equal(elements.length,24576);
  assert.equal(new Set(nodes.map(p=>p.slice(1).join(':'))).size,nodes.length);
  const old=new Set(),fresh=new Set();
  for(const el of elements){
    assert.equal(el[1],'SOLID');assert.equal(el.length,12);
    const ids=el.slice(4).map(Number);assert.equal(new Set(ids).size,8);
    assert.ok(ids.every(id=>id>=1&&id<=nodes.length));
    for(const id of ids)(el[2]==='1'?old:fresh).add(id);
  }
  const shared=[...old].filter(n=>fresh.has(n));assert.equal(shared.length,801);
  assert.ok(shared.every(n=>nodes[n-1][3]===4));
  assert.equal(new Set([...old,...fresh]).size,nodes.length);
});

test('actual material cards use mass kg and hour heat units consistently',()=>{
  assert.equal(sections['*UNIT'][0],'N, M, KJ, C');
  for(const line of sections['*MATERIAL']){
    const f=line.split(',').map(s=>s.trim());assert.equal(f.length,15);
    close(+f[3],.9);close(+f[4],8.64);close(+f[10],4700*Math.sqrt(30)*1e6,.001);
    close(+f[13],2400*9.80665);
  }
  const f=sections['*HYD-CONVCOEF'].join('\n');
  assert.match(f,/FUNC=H_FORM, CONST, 10\.800000000/);assert.match(f,/FUNC=H_AIR, CONST, 36\.000000000/);
});

test('SW is a Dead Load in LG_SW and is activated once throughout hydration stages',()=>{
  assert.deepEqual(E.defaults().selfWeight,{caseName:'SW',caseType:'D',groupName:'LG_SW',factorX:0,factorY:0,factorZ:-1});
  assert.deepEqual(sections['*LOAD-GROUP'],['LG_SW']);
  assert.deepEqual(sections['*STLDCASE'][0].split(',').slice(0,2).map(s=>s.trim()),['SW','D']);
  assert.ok(Object.hasOwn(sections,'*USE-STLD, SW'));
  assert.deepEqual(sections['*SELFWEIGHT'],['0, 0, -1, LG_SW']);
  assert.equal((model.text.match(/^\*SELFWEIGHT$/gm)||[]).length,1);
  const stageLines=sections['*HYD-STAGE'];
  const activation=stageLines.indexOf('ALOAD=LG_SW, 0');
  assert.ok(activation>stageLines.findIndex(s=>s.startsWith('NAME=H0_OLD_INIT,')));
  assert.ok(activation<stageLines.findIndex(s=>s.startsWith('NAME=H1_POUR_FORM,')));
  assert.equal(stageLines.filter(s=>s.startsWith('ALOAD=')).length,1);
  assert.ok(!stageLines.some(s=>s.startsWith('DLOAD=')));
  assert.ok(model.stages.every(s=>s.activeLoadGroups.length===1&&s.activeLoadGroups[0]==='LG_SW'));
  // Explicit SW must not also enable automatic hydration self-weight.
  assert.equal(sections['*HYD-CTRL'][0].split(',')[6].trim(),'NO');
});

test('edited self-weight factors survive JSON and drive actual MCT cards',()=>{
  const c=E.defaults();Object.assign(c.mesh,{sideDiv:4,radialDiv:2,layersOld:1,layersNew:1});
  Object.assign(c.selfWeight,{factorX:0.25,factorY:-0.5,factorZ:-1.2});
  const restored=E.cleanConfig(JSON.parse(JSON.stringify({schema:'civil-heat-studio/v1',config:c})));
  assert.deepEqual(restored.selfWeight,c.selfWeight);
  const updated=E.build(restored),s=parseMCT(updated.text);
  assert.deepEqual(s['*SELFWEIGHT'],['0.25, -0.5, -1.2, LG_SW']);
  assert.deepEqual(updated.config.selfWeight,c.selfWeight);
});

test('old JSON receives SW defaults while malformed self-weight parameters are rejected',()=>{
  const legacy=E.defaults();delete legacy.selfWeight;
  assert.deepEqual(E.cleanConfig({schema:'civil-heat-studio/v1',config:legacy}).selfWeight,E.defaults().selfWeight);
  // The migration must also work for JSON preceding the thermal calculator.
  delete legacy.thermal;delete legacy.thermalComponents;
  assert.deepEqual(E.cleanConfig(legacy).selfWeight,E.defaults().selfWeight);
  for(const bad of [null,[],{}, {...E.defaults().selfWeight,factorZ:'-1'}, {...E.defaults().selfWeight,factorZ:Infinity}]){
    const c=E.defaults();c.selfWeight=bad;
    assert.throws(()=>E.cleanConfig({schema:'civil-heat-studio/v1',config:c}));
  }
  for(const [key,value] of [['caseName','SW\n*ENDDATA'],['caseType','L'],['groupName','OTHER'],['factorX',NaN],['factorZ',Infinity]]){
    const c=E.defaults();c.selfWeight[key]=value;
    assert.ok(E.validate(c).errors.some(e=>e.field==='selfWeight.'+key),key);
    assert.throws(()=>E.build(c));
  }
});

test('source cards assign zero heat to old lift and adiabatic rise to fresh lift only',()=>{
  assert.deepEqual(sections['*HYD-HEATSRC'],['1to12288, OLD_ZERO','12289to24576, NEW_ADIABATIC']);
  const source=sections['*HYD-HEATSRCF'];
  assert.equal(source[0],'FUNC=OLD_ZERO, USER, 1, YES');assert.equal(source[1],'0, 0');
  assert.equal(+source[2].split(',')[1],0);
  const index=source.indexOf('FUNC=NEW_ADIABATIC, USER, 1, YES');
  const curve=source.slice(index+1).map(s=>s.split(',').map(Number));
  assert.deepEqual(curve[0],[0,0]);
  assert.ok(curve.at(-1)[0]>720);
  assert.ok(curve.every((p,i)=>p[1]>=0&&p[1]<=45&&(!i||p[0]>curve[i-1][0]&&p[1]>=curve[i-1][1])));
  close(curve.find(p=>p[0]===24)[1],45*(1-Math.exp(-.5)),1e-8);
});

test('independent audit of exported staging gives only exposed, uniquely convecting active faces',()=>{
  const groups={};
  for(const line of sections['*GROUP']){const f=line.split(',').map(s=>s.trim());groups[f[0]]=expand(f[2]);}
  const cells=sections['*ELEMENT'].map(s=>s.split(',').slice(4).map(Number));
  const boundary={};
  for(const line of sections['*HYD-CONBNDR']){
    const [ids,, ,face,group]=line.split(',').map(s=>s.trim());
    if(!boundary[group])boundary[group]=[];
    for(const id of expand(ids))boundary[group].push([id,+face]);
  }
  const stages=[];let current;
  for(const line of sections['*HYD-STAGE']){
    const [key,...rest]=line.split('=');const value=rest.join('=');
    if(key==='NAME'){current={name:value.split(',')[0].trim(),AELEM:[],ABNDR:[],DBNDR:[],temperature:value.split(',')[1].trim()};stages.push(current);}
    else current[key]=value.split(',').map(s=>s.trim());
  }
  assert.equal(stages.length,4);assert.equal(stages[2].temperature,'NO');assert.equal(stages[3].temperature,'NO');
  const active=new Set(),activeB=new Set(),expectedFaces=[1792,2816,2816,2816];
  const endpoints=[];let elapsed=0;
  for(const [i,s] of stages.entries()){
    for(const g of s.AELEM)for(const id of groups[g]){assert.ok(!active.has(id));active.add(id);}
    s.DBNDR.forEach(g=>assert.ok(activeB.delete(g)));s.ABNDR.forEach(g=>{assert.ok(!activeB.has(g));activeB.add(g);});
    const faces=new Map();
    for(const id of active)for(const fn of faceNodes){const key=fn.map(j=>cells[id-1][j]).sort((a,b)=>a-b).join(':');faces.set(key,(faces.get(key)||0)+1);}
    const assigned=new Set();
    for(const group of activeB)for(const [id,f] of boundary[group]||[]){
      assert.ok(active.has(id));const key=faceNodes[f-1].map(j=>cells[id-1][j]).sort((a,b)=>a-b).join(':');
      assert.equal(faces.get(key),1);assert.ok(!assigned.has(key));assigned.add(key);
    }
    assert.equal(assigned.size,expectedFaces[i]);
    if(i>0)assert.ok(!activeB.has('OLD_TOP'));
    const step=s.STEP.map(Number);assert.ok(step.every((v,j)=>v>0&&(!j||v>step[j-1])));
    elapsed+=step.at(-1);endpoints.push(elapsed);
  }
  assert.deepEqual(endpoints,[1,73,169,721]);assert.equal(active.size,24576);
});

test('non-default mesh and adiabatic base really change geometry and boundary cards',()=>{
  const c=E.defaults();Object.assign(c.geometry,{diameter:5,heightOld:3,heightNew:2});
  Object.assign(c.mesh,{sideDiv:8,radialDiv:3,layersOld:6,layersNew:4});c.boundary.baseMode='adiabatic';
  const m=E.build(c),s=parseMCT(m.text);assert.equal(m.stats.elements,1600);assert.equal(m.stats.nodes,1947);
  assert.equal(s['*NODE'].length,1947);assert.equal(s['*ELEMENT'].length,1600);
  assert.ok(!s['*HYD-PRTEMPER']);assert.ok(!s['*BNDR-GROUP'].some(l=>l.startsWith('BASE_TEMP')));
  const maxZ=Math.max(...s['*NODE'].map(l=>+l.split(',')[3]));close(maxZ,5);
  assert.ok(m.stages.every(stage=>!stage.activeBoundaries.includes('BASE_TEMP')));
});

test('invalid geometry, stage order, mesh budgets and long schedules are rejected before exporting',()=>{
  for(const change of [c=>c.geometry.diameter=0,c=>c.mesh.sideDiv=15,c=>c.material.cp=NaN,
    c=>c.schedule.strip=c.schedule.cure,c=>Object.assign(c.mesh,{sideDiv:32,radialDiv:24,layersOld:64,layersNew:64}),
    c=>c.schedule.dtLate=.05,c=>c.mix.sandMoisture=100]){
    const c=E.defaults();change(c);assert.ok(E.validate(c).errors.length);assert.throws(()=>E.build(c));
  }
});

test('JSON schema is strict and does not accept coercions or unknown schema versions',()=>{
  const config=E.defaults();assert.deepEqual(E.cleanConfig({schema:'civil-heat-studio/v1',config}),config);
  assert.throws(()=>E.cleanConfig({schema:'unknown',config}));
  config.geometry.diameter='7.5';assert.throws(()=>E.cleanConfig({schema:'civil-heat-studio/v1',config}));
  assert.throws(()=>E.cleanConfig({}));
});

test('convection guidance distinguishes air references, construction-dependent covers and the software guard',()=>{
  const c=E.defaults(),before=JSON.stringify(c),guide=E.convectionGuidance(c);
  assert.deepEqual(guide.limit,{min:0,max:200});
  assert.deepEqual(guide.items.map(item=>item.key),Object.keys(c.convection));
  assert.ok(guide.sources.length>=3);
  assert.ok(guide.sources.every(source=>source.title&&source.url.startsWith('https://')));
  assert.ok(guide.note);
  for(const key of ['oldSide','oldTop','air','topAir']){
    const item=guide.items.find(item=>item.key===key);
    assert.equal(item.min,2);assert.equal(item.max,25);assert.equal(item.status,'reference');
    assert.ok(item.instruction&&item.basis&&item.message);
    close(item.mctValue,item.value*3.6);
  }
  for(const key of ['form','curing']){
    const item=guide.items.find(item=>item.key===key);
    assert.equal(item.min,null);assert.equal(item.max,null);assert.equal(item.status,'custom');
    assert.ok(item.rangeLabel&&item.instruction&&item.basis);
  }
  assert.equal(JSON.stringify(c),before,'Guidance must not replace user coefficients.');
});

test('convection reference warnings are advisory while numerical export limits remain enforced',()=>{
  const c=E.defaults();
  for(const [value,status,valid] of [[1,'review',true],[2,'reference',true],[10,'reference',true],
    [25,'reference',true],[30,'review',true],[200,'review',true],[201,'invalid',false],[-1,'invalid',false],[NaN,'invalid',false]]){
    c.convection.air=value;
    const item=E.convectionGuidance(c).items.find(item=>item.key==='air');
    assert.equal(item.status,status,String(value));
    assert.equal(E.validate(c).errors.some(error=>error.field==='convection.air'),!valid,String(value));
    assert.ok(Object.is(c.convection.air,value),'Guidance must not clamp a selected coefficient.');
  }
  for(const key of Object.keys(c.convection)){
    const zero=E.defaults();zero.convection[key]=0;
    assert.equal(E.convectionGuidance(zero).items.find(item=>item.key===key).status,'adiabatic');
    assert.equal(E.validate(zero).errors.length,0);
  }
});

test('actual convection exports and JSON roundtrip retain advisory and zero coefficients with hour conversion',()=>{
  const c=E.defaults();Object.assign(c.mesh,{sideDiv:4,radialDiv:2,layersOld:1,layersNew:1});
  Object.assign(c.convection,{oldSide:0,oldTop:1,form:3.2,air:30,curing:5.4,topAir:200});
  const before=JSON.stringify(c),guidance=E.convectionGuidance(c),s=parseMCT(E.build(c).text);
  const expected={H_OLD_SIDE:0,H_OLD_TOP:3.6,H_FORM:11.52,H_AIR:108,H_CURING:19.44,H_TOP_AIR:720};
  const actual={};
  for(const line of s['*HYD-CONVCOEF']){
    const [name,method,value]=line.split(',').map(value=>value.trim());
    assert.equal(method,'CONST');actual[name.replace('FUNC=','')]=+value;
  }
  assert.deepEqual(Object.keys(actual),Object.keys(expected));
  for(const [name,value] of Object.entries(expected))close(actual[name],value);
  const restored=E.cleanConfig(JSON.parse(JSON.stringify({schema:'civil-heat-studio/v1',config:c,convection_guidance:guidance})));
  assert.deepEqual(restored.convection,c.convection);
  assert.equal(JSON.stringify(c),before);
});
