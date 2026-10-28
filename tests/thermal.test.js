'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../web/engine.js');
const T=require('../web/thermal.js');
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const calculated=()=>{const c=E.defaults();c.thermal.cpMode='mixture';c.thermal.kMode='geometric';return c;};
function materials(model){
  const lines=model.text.split(/\r?\n/);let i=lines.indexOf('*MATERIAL')+1;const result=[];
  for(;i<lines.length&&!lines[i].startsWith('*');i++)if(lines[i]&&!lines[i].startsWith(';'))result.push(lines[i].split(',').map(s=>s.trim()));
  return result;
}

test('specific heat balances constituent sensible heat and uses mass, not volume fractions',()=>{
  const c=calculated(),r=E.resolvedThermal(c);
  const independentEnergy=432*.84+108*.75+151*4.18+749*.8+976*.8+(2.16+8.1)*3.5;
  close(r.cp,independentEnergy/2426.26);
  close(r.cp,1.0266706783279616);close(r.cp*r.totalMass,independentEnergy,1e-8);
  const changed=structuredClone(c);changed.thermalComponents.waterDensity*=2;
  close(E.resolvedThermal(changed).cp,r.cp);
  assert.notEqual(E.resolvedThermal(changed).k,r.k);
});

test('conductivity uses normalized absolute phase volumes with transparent closure',()=>{
  const c=calculated(),r=E.resolvedThermal(c);
  const V=[432/3150,108/2300,151/1000,749/2650,976/2700,2.16/1100,8.1/1100];
  const k=[1.5,.7,.6,3,3,.5,.5],sum=V.reduce((a,b)=>a+b,0);
  const f=V.map(v=>v/sum);
  close(r.sumVolume,.9885496425247041);close(r.sumVolume,sum);
  close(r.series,1/f.reduce((a,v,i)=>a+v/k[i],0));
  close(r.parallel,f.reduce((a,v,i)=>a+v*k[i],0));
  close(r.geometric,Math.exp(f.reduce((a,v,i)=>a+v*Math.log(k[i]),0)));
  close(r.k,1.955367943417368);close(r.kMct,7.039324596302525);
  close(r.rows.reduce((a,b)=>a+b.fraction,0),1);
  assert.ok(r.series<=r.geometric&&r.geometric<=r.parallel);
  assert.ok(!r.rows.some(row=>row.id==='air'),'No invented air phase');
});

test('mixture estimates preserve equal-property limits and are invariant to uniform recipe scaling',()=>{
  const c=calculated(),base=E.resolvedThermal(c);
  const scaled=structuredClone(c);for(const [phase]of T.phases)scaled.mix[phase]*=2;
  const r=E.resolvedThermal(scaled);close(r.cp,base.cp);close(r.k,base.k);close(r.sumVolume,2*base.sumVolume);
  for(const [phase]of T.phases){c.thermalComponents[phase+'Cp']=1.234;c.thermalComponents[phase+'K']=2.7;}
  const equal=E.resolvedThermal(c);close(equal.cp,1.234);close(equal.series,2.7);close(equal.parallel,2.7);close(equal.geometric,2.7);
});

test('zero-mass fly ash or admixtures do not divide by absent constituent properties',()=>{
  const c=calculated();
  for(const phase of ['flyash','admixture1','admixture2']){c.mix[phase]=0;for(const key of ['Density','Cp','K'])c.thermalComponents[phase+key]=0;}
  assert.equal(E.validate(c).errors.length,0);
  const r=E.resolvedThermal(c);assert.ok(Number.isFinite(r.cp)&&Number.isFinite(r.k));
  assert.ok(r.rows.filter(row=>row.mass===0).every(row=>row.volume===0&&row.fraction===0));
});

test('EC2 code anchors and piecewise continuity agree with verified dry-concrete relations',()=>{
  close(T.ec2(20).cp,.9);close(T.ec2(20).lower,1.333028);close(T.ec2(20).upper,1.951408);
  close(T.ec2(100).cp,.9);close(T.ec2(150).cp,.95);close(T.ec2(200).cp,1);
  close(T.ec2(300).cp,1.05);close(T.ec2(400).cp,1.1);close(T.ec2(1200).cp,1.1);
  close(T.ec2(1200).lower,.5488);close(T.ec2(1200).upper,.5996);
  assert.throws(()=>T.ec2(19.99));assert.throws(()=>T.ec2(1200.01));
  const c=E.defaults();c.thermal.cpMode='ec2_dry';c.thermal.kMode='ec2_upper';c.thermal.referenceTemperature=20;
  const r=E.resolvedThermal(c);close(r.cp,.9);close(r.k,1.951408);assert.ok(r.warnings.some(w=>w.includes('kebakaran')));
});

test('manual values survive method switches and are not clamped to an unrelated EC2 curve',()=>{
  const c=E.defaults();c.material.cp=1.11;c.material.conductivity=2.78;
  c.thermal.cpMode='mixture';c.thermal.kMode='series';E.resolvedThermal(c);
  assert.equal(c.material.cp,1.11);assert.equal(c.material.conductivity,2.78);
  c.thermal.cpMode='manual';c.thermal.kMode='manual';
  close(E.resolvedThermal(c).cp,1.11);close(E.resolvedThermal(c).k,2.78);
  assert.equal(E.validate(c).errors.length,0);
});

test('actual MCT, conversion rows and volumetric energy use resolved values for each material',()=>{
  const c=calculated();c.thermal.oldMode='manual';c.thermal.oldCp=.95;c.thermal.oldK=1.7;
  const r=E.resolvedThermal(c),m=E.build(c),cards=materials(m);
  assert.equal(cards.length,2);assert.equal(cards[0].length,15);assert.equal(cards[1].length,15);
  close(+cards[0][3],.95);close(+cards[0][4],6.12);
  close(+cards[1][3],r.cp,1e-9);close(+cards[1][4],r.k*3.6,1e-9);
  const units=E.units(c);close(units[0][3],r.cp);close(units[1][3],r.k*3.6);close(units[2][3],.95);close(units[3][3],6.12);
  close(r.cv,2400*r.cp);close(r.heatInfinity,r.cv*45);close(r.diffusivity,r.k/(r.cv*1000),1e-15);
  assert.match(m.text,/1to12288, OLD_ZERO/);assert.match(m.text,/cp=mixture, k=geometric, old=manual/);
  c.thermal.cpMode='manual';c.thermal.kMode='ec2_lower';c.thermal.referenceTemperature=20;
  const independent=materials(E.build(c));close(+independent[1][3],.9);close(+independent[1][4],1.333028*3.6,1e-9);
});

test('legacy v1 projects migrate to manual methods while preserving user thermal values',()=>{
  const legacy=E.defaults();delete legacy.thermal;delete legacy.thermalComponents;
  legacy.material.cp=1.17;legacy.material.conductivity=2.63;
  const migrated=E.cleanConfig({schema:'civil-heat-studio/v1',config:legacy});
  assert.equal(migrated.thermal.cpMode,'manual');assert.equal(migrated.thermal.kMode,'manual');
  assert.equal(migrated.material.cp,1.17);assert.equal(migrated.material.conductivity,2.63);
  const cards=materials(E.build(migrated));close(+cards[0][3],1.17);close(+cards[1][4],2.63*3.6,1e-9);
  const partial=E.defaults();delete partial.thermalComponents;assert.throws(()=>E.cleanConfig(partial));
});

test('invalid code domains, active phase properties and inactive NaNs reject export',()=>{
  for(const mutation of [c=>{c.thermal.cpMode='ec2_dry';c.thermal.referenceTemperature=19;},
    c=>{c.thermal.kMode='geometric';c.thermalComponents.waterK=-.5;},
    c=>{c.thermal.cpMode='mixture';c.thermalComponents.cementCp=0;},
    c=>{c.thermalComponents.flyashK=NaN;},c=>{c.thermal.oldMode='manual';c.thermal.oldK=0;}]){
    const c=E.defaults();mutation(c);assert.ok(E.validate(c).errors.length);assert.throws(()=>E.build(c));
  }
});

test('finite dormant manual values do not prevent export of valid selected calculations',()=>{
  const c=calculated();c.material.cp=0;c.material.conductivity=-1;c.thermal.oldCp=0;c.thermal.oldK=0;
  assert.equal(E.validate(c).errors.length,0);
  const actual=materials(E.build(c));close(+actual[1][3],1.0266706783279616,1e-9);
  c.thermal.cpMode='manual';assert.ok(E.validate(c).errors.length);
  c.thermal.cpMode='mixture';c.thermal.oldMode='manual';assert.ok(E.validate(c).errors.length);
});
