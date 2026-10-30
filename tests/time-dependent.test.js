'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../web/engine.js');
const TD=require('../web/time-dependent.js');

const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function config(){
  const c=E.defaults();
  Object.assign(c.mesh,{sideDiv:4,radialDiv:2,layersOld:1,layersNew:1});
  return c;
}
function sections(text){
  const result={};let current;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith(';'))continue;
    if(line.startsWith('*')){current=line;result[current]=[];}
    else result[current].push(line);
  }
  return result;
}
const fields=line=>line.replace(/^NAME=/,'').split(',').map(value=>value.trim());
const model=c=>sections(E.build(c).text);

test('new projects export CEB C&S, mean compression strength, material links and hydration control',()=>{
  const c=config(),s=model(c);
  assert.equal(c.timeDependent.enabled,'yes');
  assert.equal(c.timeDependent.creepModel,'CEB1990');
  assert.equal(c.timeDependent.strengthModel,'CEB1990');
  const cs=fields(s['*TDM-TYPE'][0]),strength=fields(s['*TDM-ELAST'][0]);
  assert.deepEqual(cs.slice(0,2),['TD_CS','CEB']);
  close(+cs[2],30e6);close(+cs[3],70);close(+cs[4],3.75);
  assert.equal(cs[5],'NR');close(+cs[6],3);
  assert.deepEqual(strength.slice(0,3),['TD_FC','CODE','CEB-FIP(1990)']);
  close(+strength[3],38e6);assert.equal(strength[4],'2');
  assert.deepEqual(s['*TDM-LINK'].map(fields),[['2','TD_CS','TD_FC']]);
  const control=fields(s['*HYD-CTRL'][0]);
  assert.equal(control.length,13);assert.equal(control[6],'NO');
  assert.equal(control[8],'YES');assert.equal(control[9],'BOTH');assert.equal(control[10],'0');
  assert.deepEqual(s['*SELFWEIGHT'],['0, 0, -1, LG_SW']);
  assert.equal(s['*HYD-STAGE'].filter(line=>line==='ALOAD=LG_SW, 0').length,1);
});

test('CEB code parameters preserve metres/days and distinguish fck from user-adjusted mean offset',()=>{
  const c=config();c.material.fc=42;
  Object.assign(c.timeDependent,{humidity:63,notionalSize:.876,shrinkageAge:5,cementType:'SL',cebMeanOffset:6.5});
  const s=model(c),cs=fields(s['*TDM-TYPE'][0]),strength=fields(s['*TDM-ELAST'][0]);
  close(+cs[2],42e6);close(+cs[3],63);close(+cs[4],.876);assert.equal(cs[5],'SL');close(+cs[6],5);
  close(+strength[3],48.5e6);assert.equal(strength[4],'3');
  c.timeDependent.cementType='RS';assert.equal(fields(model(c)['*TDM-ELAST'][0])[4],'1');
  // A material age is in days; hydration initialization remains one hour.
  assert.equal(s['*HYD-STAGE'][1],'STEP=1');
});

test('ACI exports physical units and uses active jobmix cement or explicit manual cement content',()=>{
  const c=config();c.material.fc=35;c.mix.cement=455;
  Object.assign(c.timeDependent,{creepModel:'ACI',strengthModel:'ACI',aciA:3.7,aciB:.91,humidity:65,
    volumeSurface:.345,shrinkageAge:6,aciCuring:'STEAM',aciSlump:120,aciFineAggregate:47,aciAir:3,
    aciMixSource:'jobmix',aciCementContent:390});
  const s=model(c),cs=fields(s['*TDM-TYPE'][0]);
  assert.deepEqual(cs.slice(0,2),['TD_CS','ACI']);close(+cs[2],35e6);close(+cs[3],65);
  close(+cs[4],.345);close(+cs[5],6);close(+cs[6],3.7);close(+cs[7],.91);
  assert.equal(cs[8],'CODE');assert.equal(cs[9],'STEAM');close(+cs[10],.12);
  close(+cs[11],47);close(+cs[12],3);close(+cs[13],455);
  assert.deepEqual(fields(s['*TDM-ELAST'][0]),['TD_FC','CODE','ACI','35000000','3.7','0.91']);
  c.timeDependent.aciMixSource='manual';close(+fields(model(c)['*TDM-TYPE'][0]).at(-1),390);
  Object.assign(c.timeDependent,{aciUltimate:'USER',ultimateCreep:2.8,ultimateShrinkage:650});
  const user=fields(model(c)['*TDM-TYPE'][0]);assert.equal(user[8],'USER');
  close(+user.at(-2),2.8);close(+user.at(-1),650);
});

test('AASHTO C&S uses the documented token while strength explicitly follows ACI rather than an invented AASHTO code',()=>{
  const c=config();
  Object.assign(c.timeDependent,{creepModel:'AASHTO2006',strengthModel:'AASHTO',humidity:72,volumeSurface:.41,shrinkageAge:4,aashtoExposed:'yes'});
  const s=model(c),cs=fields(s['*TDM-TYPE'][0]),strength=fields(s['*TDM-ELAST'][0]);
  assert.deepEqual(cs,['TD_CS','AASHTO','30000000','72','0.41','4','YES']);
  assert.deepEqual(strength.slice(0,3),['TD_FC','CODE','ACI']);
  assert.ok(!s['*TDM-ELAST'].some(line=>/CODE,\s*AASHTO/.test(line)));
  assert.match(JSON.stringify(E.timeDependent(c)),/ACI/);
});

test('age-strength previews preserve the CEB mean-strength anchor and unnormalised ACI age equation',()=>{
  const c=config();c.material.fc=40;c.timeDependent.cebMeanOffset=8;
  const curve=TD.evaluate(c).strengthCurve,point=day=>curve.find(p=>p.day===day);
  close(point(28).fc,48);close(point(7).fc,48*Math.exp(.25*(1-Math.sqrt(28/7))));
  assert.equal(point(28).elastic,null);assert.equal(point(28).tensile,null);
  c.timeDependent.strengthModel='ACI';Object.assign(c.timeDependent,{aciA:4,aciB:.85});
  const aci=TD.evaluate(c).strengthCurve;
  close(aci.find(p=>p.day===7).fc,40*7/(4+.85*7));
  close(aci.find(p=>p.day===28).fc,40*28/(4+.85*28));
  assert.notEqual(aci.find(p=>p.day===28).fc,40,'Do not normalise an approximate ACI preset to an invented endpoint');
  c.timeDependent.strengthModel='AASHTO';
  assert.deepEqual(TD.evaluate(c).strengthCurve,aci);
});

test('custom creep functions retain distinct loading ages, dimensionless coefficients and reference stiffness',()=>{
  const c=config();Object.assign(c.timeDependent,{creepModel:'USER',strengthModel:'USER',
    creepModulusSource:'user',creepReferenceModulus:35000,strengthScale:1.4,
    customCreep:'7, 0, 0\n7, 30, 1.4\n7, 90, 1.9\n3, 0, 0\n3, 30, 1.7\n3, 90, 2.2',
    customShrinkage:'0, 0\n7, 220\n30, 400\n90, 600',
    customStrength:'0, 0, 0, 0\n1, 9, 0.7, 12500\n7, 25, 1.9, 25000\n30, 35, 2.6, 32000\n90, 39, 2.9, 35000'});
  const s=model(c),func=s['*TDM-FUNC'];
  const definitions=func.filter(line=>line.startsWith('FUNC='));
  assert.deepEqual(definitions.map(line=>line.slice(5).split(',')[0]),['TD_CREEP_1','TD_CREEP_2','TD_SHRINK']);
  const first=fields(definitions[0].slice(5));
  assert.deepEqual(first.slice(0,4),['TD_CREEP_1','CREEP','1','CC']);close(+first[4],35000e6);
  assert.deepEqual(s['*TDM-TYPE'],['NAME=TD_CS, USER, YES, TD_SHRINK','TD_CREEP_1, 3, TD_CREEP_2, 7']);
  const one=func.indexOf(definitions[0]),two=func.indexOf(definitions[1]),shrink=func.indexOf(definitions[2]);
  assert.deepEqual(func.slice(one+1,two).map(fields).map(row=>row.map(Number)),[[0,0],[30,1.7],[90,2.2]]);
  assert.deepEqual(func.slice(two+1,shrink).map(fields).map(row=>row.map(Number)),[[0,0],[30,1.4],[90,1.9]]);
  const eps=func.slice(shrink+1).map(fields).map(row=>row.map(Number));
  close(eps[1][0],7);close(eps[1][1],220e-6,1e-15);close(eps.at(-1)[1],600e-6,1e-15);
  assert.deepEqual(fields(s['*TDM-ELAST'][0]),['TD_FC','USER','1.4']);
  const strength=s['*TDM-ELAST'].slice(1).map(fields).map(row=>row.map(Number));
  assert.deepEqual(strength[1],[1,9e6,.7e6,12500e6]);
  const r=E.timeDependent(c),atOne=r.strengthCurve.find(p=>p.day===1);
  close(atOne.fc,9);close(atOne.tensile,.7);close(atOne.elastic,12500*1.4);
  close(r.creepE,35000);close(r.creepEMct,35000e6);
  c.timeDependent.creepModulusSource='material';
  close(+fields(model(c)['*TDM-FUNC'].find(line=>line.startsWith('FUNC=TD_CREEP_1')).slice(5))[4],4700*Math.sqrt(30)*1e6,.1);
  assert.equal(c.material.fc,30,'User measured table must not overwrite the separate mechanical design strength');
});

test('material links are keyed by material IDs and C&S control follows actual selected links',()=>{
  const c=config();
  Object.assign(c.timeDependent,{linkOldCreep:'yes',linkOldStrength:'no',linkNewCreep:'no',linkNewStrength:'yes',csMode:'SHRINK'});
  let s=model(c);
  assert.deepEqual(s['*TDM-LINK'].map(fields),[['1','TD_CS',''],['2','','TD_FC']]);
  assert.equal(fields(s['*HYD-CTRL'][0])[9],'SHRINK');
  c.timeDependent.linkOldCreep='no';s=model(c);
  assert.deepEqual(s['*TDM-LINK'].map(fields),[['2','','TD_FC']]);
  assert.equal(fields(s['*HYD-CTRL'][0])[8],'NO');
  c.timeDependent.enabled='no';s=model(c);
  assert.ok(!s['*TDM-TYPE']&&!s['*TDM-ELAST']&&!s['*TDM-LINK']);
  assert.equal(fields(s['*HYD-CTRL'][0])[8],'NO');
  assert.equal(fields(s['*HYD-CTRL'][0])[6],'NO');
});

test('legacy JSON preserves constant materials while explicit complete TD settings round-trip without coercion',()=>{
  const c=config(),legacy=structuredClone(c);delete legacy.timeDependent;
  const migrated=E.cleanConfig({schema:'civil-heat-studio/v1',config:legacy});
  assert.equal(migrated.timeDependent.enabled,'no');assert.ok(!model(migrated)['*TDM-LINK']);
  Object.assign(c.timeDependent,{creepModel:'USER',strengthModel:'USER',strengthScale:1.25,
    customStrength:'1, 8, 0.8, 12000\n7, 24, 1.8, 25000\n28, 34, 2.5, 32000',
    customCreep:'3, 0, 0\n3, 7, 1.1\n7, 0, 0\n7, 28, 1.3',customShrinkage:'0, 0\n7, 220\n28, 400'});
  assert.deepEqual(E.cleanConfig(JSON.parse(JSON.stringify({schema:'civil-heat-studio/v1',config:c}))),c);
  for(const bad of [null,[],{}, {...c.timeDependent,humidity:'70'}]){
    const invalid=structuredClone(c);invalid.timeDependent=bad;assert.throws(()=>E.cleanConfig(invalid));
  }
});

test('invalid model, code inputs, link values and active custom data reject MCT before serialization',()=>{
  const mutations=[
    c=>c.timeDependent.creepModel='FAKE',c=>c.timeDependent.strengthModel='CODE\n*ENDDATA',
    c=>c.timeDependent.humidity=101,c=>c.timeDependent.notionalSize=0,c=>c.timeDependent.cebMeanOffset=-1,
    c=>c.timeDependent.linkNewCreep='maybe',c=>c.timeDependent.iterations=0,c=>c.timeDependent.tolerance=0,
    c=>{c.timeDependent.strengthModel='USER';c.timeDependent.customStrength='1, 10, 1, 20000\n1, 20, 2, 30000';},
    c=>{c.timeDependent.strengthModel='USER';c.timeDependent.customStrength='1, 10, 1';},
    c=>{c.timeDependent.strengthModel='USER';c.timeDependent.customStrength='1, -10, 1, 20000\n7, 20, 2, 30000';},
    c=>{c.timeDependent.creepModel='USER';c.timeDependent.customCreep='3, 7, 1\n3, 2, 2';},
    c=>{c.timeDependent.creepModel='USER';c.timeDependent.customCreep='3, 0, -1\n3, 7, 1';},
    c=>{c.timeDependent.creepModel='USER';c.timeDependent.customShrinkage='0, 0\n7, -200';},
    c=>{c.timeDependent.creepModel='USER';c.timeDependent.customShrinkage='0, 0\n7, 200\n3, 250';},
    c=>{c.timeDependent.strengthModel='USER';c.timeDependent.customStrength='1, 10, 1, Infinity\n7, 20, 2, 30000';},
  ];
  for(const mutate of mutations){const c=config();mutate(c);assert.ok(E.validate(c).errors.length,mutate.toString());assert.throws(()=>E.build(c));}
});
