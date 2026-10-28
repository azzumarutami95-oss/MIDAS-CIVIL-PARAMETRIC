/* Civil Heat Studio: local numerical model and classic MCT writer. */
(function (root) {
  'use strict';
  const DEFAULTS = {
    geometry: {diameter:7.5, heightOld:4, heightNew:4},
    material: {fc:30, density:2400, cp:0.9, conductivity:2.4, poisson:0.2, expansion:0.00001},
    temperature: {old:28, pour:30, ambient:28, base:28},
    heat: {K:45, alpha:0.5},
    convection: {oldSide:10, oldTop:10, form:3, air:10, curing:5, topAir:10},
    schedule: {init:1, strip:72, cure:168, end:720, dtEarly:0.5, dtMiddle:1, dtStrip:2, dtLate:6},
    mesh: {sideDiv:16, radialDiv:8, layersOld:16, layersNew:16},
    mix: {cement:432, flyash:108, water:151, admixture1:2.16, admixture2:8.1, sand:749, gravel:976,
          batchVolume:0.035, sandMoisture:4, gravelMoisture:0.15},
    boundary: {baseMode:'fixed'}
  };
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const number = x => Number.isFinite(x);
  const faceNodes = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  function cleanConfig(value) {
    const source = value && value.schema ? value.config : value;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw Error('Format JSON parameter tidak sesuai.');
    if (value.schema && value.schema !== 'civil-heat-studio/v1') throw Error('Versi JSON parameter belum didukung.');
    const result = clone(DEFAULTS);
    for (const group of Object.keys(DEFAULTS)) {
      if (!source[group] || typeof source[group] !== 'object') throw Error('Kelompok parameter tidak lengkap: '+group);
      for (const key of Object.keys(DEFAULTS[group])) {
        const x = source[group][key];
        if (typeof DEFAULTS[group][key] === 'number' ? !number(x) : typeof x !== 'string')
          throw Error('Nilai parameter tidak valid: '+group+'.'+key);
        result[group][key] = x;
      }
    }
    return result;
  }
  function mixMetrics(c) {
    const m=c.mix, binder=m.cement+m.flyash;
    const total=m.cement+m.flyash+m.water+m.admixture1+m.admixture2+m.sand+m.gravel;
    const sandWater=m.sand*m.batchVolume*m.sandMoisture/100;
    const gravelWater=m.gravel*m.batchVolume*m.gravelMoisture/100;
    return {binder,total,wc:m.water/m.cement,wb:m.water/binder,flyash:m.flyash/binder*100,
      sandFraction:m.sand/(m.sand+m.gravel)*100,
      sandWater,gravelWater,batchWater:m.water*m.batchVolume-sandWater-gravelWater,
      batchSand:m.sand*m.batchVolume+sandWater,batchGravel:m.gravel*m.batchVolume+gravelWater};
  }
  function estimate(c) {
    const n=c.mesh.sideDiv, r=c.mesh.radialDiv, layers=c.mesh.layersOld+c.mesh.layersNew;
    const quads=n*n+4*n*r, planeNodes=quads+2*n+1;
    return {quads,planeNodes,layers,elements:quads*layers,nodes:planeNodes*(layers+1),
      volume:Math.PI*c.geometry.diameter**2/4*(c.geometry.heightOld+c.geometry.heightNew)};
  }
  function validate(c) {
    const errors=[],warnings=[];
    function err(field,message) {errors.push({field,message});}
    function range(group,key,min,max,strictMin=false) {
      const v=c[group] && c[group][key];
      if (!number(v) || (strictMin ? v<=min : v<min) || v>max)
        err(group+'.'+key,`${group}.${key}: nilai harus ${strictMin?'>':'≥'} ${min} dan ≤ ${max}.`);
    }
    for (const k of ['diameter','heightOld','heightNew']) range('geometry',k,0.1,100);
    range('material','fc',1,120);range('material','density',1000,4000);
    range('material','cp',0.1,3);range('material','conductivity',0.1,15);
    range('material','poisson',0,0.49);range('material','expansion',0,0.0001);
    for (const k of Object.keys(DEFAULTS.temperature)) range('temperature',k,-30,100);
    range('heat','K',0,150);range('heat','alpha',0,10,true);
    for (const k of Object.keys(DEFAULTS.convection)) range('convection',k,0,200);
    range('schedule','init',0,24,true);
    for (const k of ['strip','cure','end']) range('schedule',k,0,8760,true);
    for (const k of ['dtEarly','dtMiddle','dtStrip','dtLate']) range('schedule',k,0.05,24);
    if (!(c.schedule.strip<c.schedule.cure && c.schedule.cure<c.schedule.end))
      err('schedule.strip','Jadwal harus: bongkar bekisting < akhir curing < akhir analisis.');
    for (const [key,lo,hi] of [['sideDiv',4,32],['radialDiv',2,24],['layersOld',1,64],['layersNew',1,64]]) {
      range('mesh',key,lo,hi);
      if (!Number.isInteger(c.mesh[key])) err('mesh.'+key,'Pembagian mesh harus bilangan bulat.');
    }
    if (c.mesh.sideDiv%2!==0) err('mesh.sideDiv','Pembagian sisi tengah harus genap agar ada node sumbu.');
    for (const k of ['cement','water','sand','gravel']) range('mix',k,0,3000,true);
    for (const k of ['flyash','admixture1','admixture2']) range('mix',k,0,1500);
    range('mix','batchVolume',0,20,true);
    range('mix','sandMoisture',0,100);range('mix','gravelMoisture',0,100);
    if (!['fixed','adiabatic'].includes(c.boundary.baseMode)) err('boundary.baseMode','Kondisi dasar tidak dikenal.');
    const stats=estimate(c);
    if (stats.elements>100000 || stats.nodes>125000) err('mesh.sideDiv','Mesh terlalu besar untuk ekspor lokal: batas 100.000 elemen / 125.000 node.');
    if (number(c.schedule.end/c.schedule.dtEarly) && c.schedule.end/Math.min(c.schedule.dtEarly,c.schedule.dtMiddle,c.schedule.dtStrip,c.schedule.dtLate)>20000)
      err('schedule.end','Jadwal terlalu besar; batasi hingga 20.000 langkah perkiraan.');
    const mix=mixMetrics(c);
    if (mix.batchWater<0) err('mix.sandMoisture','Air agregat melebihi air desain. Koreksi basis kelembapan sebelum mengekspor.');
    if (!errors.length && stages(c).some(s=>('STEP='+s.steps.join(', ')).length>1024))
      err('schedule.dtLate','Daftar STEP terlalu panjang untuk ekspor klasik yang konservatif. Perbesar langkah waktu atau pendekkan durasi.');
    if (c.temperature.pour+c.heat.K>90) warnings.push({message:'Batas adiabatik suhu awal + K melebihi 90°C. Periksa sumber panas; ini bukan prediksi suhu pilar.'});
    if (Math.abs(c.material.density-mix.total)>0.05*mix.total) warnings.push({message:'Massa jenis termal berbeda >5% dari total massa campuran. Periksa data; massa jenis tetap merupakan input terpisah.'});
    warnings.push({message:'Suhu awal beton lama dan sisa panasnya perlu data lapangan; umur >2 bulan tidak membuktikan suhu sudah sama dengan udara.'});
    warnings.push({message:'K dan a, sifat termal, serta h adalah asumsi contoh; foto campuran tidak mengkalibrasi kurva panas.'});
    return {errors,warnings};
  }
  function crossSection(c) {
    const n=c.mesh.sideDiv, nr=c.mesh.radialDiv, R=c.geometry.diameter/2, a=.45*R;
    const xy=[],quads=[],lookup=new Map();
    function add(x,y) {
      const key=x.toFixed(11)+','+y.toFixed(11);
      if (!lookup.has(key)) {lookup.set(key,xy.length);xy.push([x,y]);}
      return lookup.get(key);
    }
    const grid=[];
    for (let j=0;j<=n;j++) {
      const row=[]; for (let i=0;i<=n;i++) row.push(add(-a+2*a*i/n,-a+2*a*j/n)); grid.push(row);
    }
    for (let j=0;j<n;j++) for (let i=0;i<n;i++) quads.push([grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]]);
    for (let side=0;side<4;side++) {
      const rows=[];
      for (let radial=0;radial<=nr;radial++) {
        const row=[],t=radial/nr;
        for (let i=0;i<=n;i++) {
          const u=-a+2*a*i/n, q=[[u,-a],[a,u],[-u,a],[-a,-u]][side], length=Math.hypot(...q);
          row.push(add(q[0]*(1-t+t*R/length),q[1]*(1-t+t*R/length)));
        }
        rows.push(row);
      }
      for (let j=0;j<nr;j++) for (let i=0;i<n;i++) quads.push([rows[j][i],rows[j+1][i],rows[j+1][i+1],rows[j][i+1]]);
    }
    const boundary=xy.map((p,i)=>i).filter(i=>Math.abs(Math.hypot(...xy[i])-R)<1e-8)
      .sort((i,j)=>Math.atan2(xy[i][1],xy[i][0])-Math.atan2(xy[j][1],xy[j][0]));
    const bs=new Set(boundary),order=boundary.concat(xy.map((_,i)=>i).filter(i=>!bs.has(i))), inv=[];
    order.forEach((old,i)=>inv[old]=i);
    return {xy:order.map(i=>xy[i].map(x=>+x.toFixed(10))),quads:quads.map(q=>q.map(i=>inv[i])),boundaryCount:boundary.length};
  }
  function auditCross(section,c) {
    let area=0,minScaled=Infinity,minDet=Infinity,minEdge=Infinity,maxEdge=0,maxRatio=0;
    const edges=new Map(),adj=section.quads.map(()=>[]), used=new Set();
    const signs=[[-1,-1],[1,-1],[1,1],[-1,1]];
    const dzs=[c.geometry.heightOld/c.mesh.layersOld,c.geometry.heightNew/c.mesh.layersNew];
    const g=1/Math.sqrt(3),samples=[...signs,[0,0],[-g,-g],[g,-g],[g,g],[-g,g]];
    section.quads.forEach((q,qi)=>{
      const ps=q.map(i=>section.xy[i]); q.forEach(i=>used.add(i));
      let qa=0;const lengths=[];
      for(let i=0;i<4;i++) {
        const j=(i+1)%4,a=ps[i],b=ps[j];qa+=a[0]*b[1]-b[0]*a[1];
        lengths.push(Math.hypot(a[0]-b[0],a[1]-b[1]));
        const key=Math.min(q[i],q[j])+':'+Math.max(q[i],q[j]);
        if(!edges.has(key))edges.set(key,[]);edges.get(key).push(qi);
      }
      if(qa<=0)throw Error('Orientasi elemen penampang terbalik.');area+=qa/2;
      for(const dz of dzs){
        const mn=Math.min(dz,...lengths),mx=Math.max(dz,...lengths);
        minEdge=Math.min(minEdge,mn);maxEdge=Math.max(maxEdge,mx);maxRatio=Math.max(maxRatio,mx/mn);
      }
      for(const [s,t] of samples) {
        const ds=[0,0],dt=[0,0];
        for(let i=0;i<4;i++)for(let d=0;d<2;d++){
          ds[d]+=ps[i][d]*signs[i][0]*(1+signs[i][1]*t)/4;
          dt[d]+=ps[i][d]*signs[i][1]*(1+signs[i][0]*s)/4;
        }
        const det=ds[0]*dt[1]-ds[1]*dt[0];
        minDet=Math.min(minDet,det*Math.min(...dzs)/2);
        minScaled=Math.min(minScaled,det/(Math.hypot(...ds)*Math.hypot(...dt)));
        if(!(det>0))throw Error('Jacobian elemen tidak positif.');
      }
    });
    let exterior=0;
    edges.forEach(owners=>{
      if(owners.length===1)exterior++;
      else if(owners.length===2){adj[owners[0]].push(owners[1]);adj[owners[1]].push(owners[0]);}
      else throw Error('Sisi mesh non-manifold.');
    });
    const seen=new Set([0]),stack=[0];while(stack.length){const v=stack.pop();for(const n of adj[v])if(!seen.has(n)){seen.add(n);stack.push(n);}}
    if(seen.size!==section.quads.length || exterior!==4*c.mesh.sideDiv || used.size!==section.xy.length)throw Error('Mesh terpisah atau memiliki sisi/node tak terhubung.');
    const volume=area*(c.geometry.heightOld+c.geometry.heightNew);
    return {area,volume,minScaled,minDet,minEdge,maxEdge,maxRatio,sharedInterfaceNodes:section.xy.length,
      volumeDeficitPercent:100*(estimate(c).volume-volume)/estimate(c).volume};
  }
  function mesh(c) {
    const section=crossSection(c),audit=auditCross(section,c),nodes=[],cells=[],zlevels=[];
    for(let k=0;k<=c.mesh.layersOld;k++)zlevels.push(c.geometry.heightOld*k/c.mesh.layersOld);
    for(let k=1;k<=c.mesh.layersNew;k++)zlevels.push(c.geometry.heightOld+c.geometry.heightNew*k/c.mesh.layersNew);
    for(const z of zlevels) for(const p of section.xy)nodes.push([p[0],p[1],+z.toFixed(10)]);
    const nn=section.xy.length,nq=section.quads.length;
    for(let k=0;k<zlevels.length-1;k++)for(const q of section.quads)cells.push(q.map(i=>i+k*nn).concat(q.map(i=>i+(k+1)*nn)));
    return {nodes,cells,section,audit,zlevels,nn,nq,oldElements:nq*c.mesh.layersOld};
  }
  function ranges(values) {
    if(!values.length)return '';
    const a=[...new Set(values)].sort((a,b)=>a-b),parts=[];let start=a[0],end=a[0];
    for(let i=1;i<a.length;i++){if(a[i]===end+1)end=a[i];else{parts.push(start===end?String(start):`${start}to${end}`);start=end=a[i];}}
    parts.push(start===end?String(start):`${start}to${end}`);return parts.join(' ');
  }
  function chunks(values) {
    const out=[];let line='';for(const span of ranges(values).split(' ')) {
      const trial=(line+' '+span).trim();if(trial.length>300){out.push(line);line=span;}else line=trial;
    } if(line)out.push(line);return out;
  }
  function steps(end,dt,start=0) {
    const out=[];for(let t=start+dt;t<end-1e-8;t+=dt)out.push(+t.toFixed(8));
    if(end>start)out.push(+end.toFixed(8));return out;
  }
  function stages(c) {
    const s=c.schedule,early=Math.min(24,s.strip),fixed=c.boundary.baseMode==='fixed';
    return [
      {name:'H0_OLD_INIT',label:'Kondisi awal beton lama',temp:c.temperature.old,steps:[s.init],ae:['STAGE1_OLD'],ab:['MECH_BASE',...(fixed?['BASE_TEMP']:[]),'OLD_SIDE','OLD_TOP'],db:[]},
      {name:'H1_POUR_FORM',label:'Pengecoran + bekisting',temp:c.temperature.pour,steps:steps(early,s.dtEarly).concat(steps(s.strip,s.dtMiddle,early)),ae:['STAGE2_NEW'],ab:['NEW_FORM','TOP_CURE'],db:['OLD_TOP']},
      {name:'H2_STRIP_FORM',label:'Bongkar bekisting',temp:null,steps:steps(s.cure-s.strip,s.dtStrip),ae:[],ab:['NEW_AIR'],db:['NEW_FORM']},
      {name:'H3_END_CURING',label:'Akhir curing / pendinginan',temp:null,steps:steps(s.end-s.cure,s.dtLate),ae:[],ab:['TOP_AIR'],db:['TOP_CURE']}
    ];
  }
  function units(c) {
    const h=c.convection;
    return [
      ['Panas jenis',c.material.cp,'kJ/(kg·°C)',c.material.cp,'kJ/(kg·°C)'],
      ['Konduktivitas',c.material.conductivity,'W/(m·°C)',c.material.conductivity*3.6,'kJ/(m·jam·°C)'],
      ['Berat isi',c.material.density,'kg/m³',c.material.density*9.80665,'N/m³'],
      ...Object.entries({oldSide:'Sisi lama',oldTop:'Atas lama sebelum cor',form:'Bekisting',air:'Udara sisi baru',curing:'Curing atas',topAir:'Udara atas'}).map(([k,n])=>[n,h[k],'W/(m²·°C)',h[k]*3.6,'kJ/(m²·jam·°C)'])
    ];
  }
  function heatRise(c,hours) {return c.heat.K*(-Math.expm1(-c.heat.alpha*hours/24));}
  function build(c) {
    const validation=validate(c);if(validation.errors.length)throw Error(validation.errors.map(x=>x.message).join('\n'));
    const data=mesh(c),{nodes,cells,nn,nq,oldElements}=data,stageData=stages(c),baseFixed=c.boundary.baseMode==='fixed';
    const allIds=Array.from({length:cells.length},(_,i)=>i+1),oldIds=allIds.slice(0,oldElements),newIds=allIds.slice(oldElements);
    const groups={STAGE1_OLD:{start:1,end:(c.mesh.layersOld+1)*nn,elements:oldIds},STAGE2_NEW:{start:c.mesh.layersOld*nn+1,end:nodes.length,elements:newIds}};
    const surfaces={OLD_SIDE:[],NEW_SIDE:[],OLD_TOP:[],NEW_TOP:[]};
    const outer=[];
    data.section.quads.forEach((q,i)=>{if(q[1]<data.section.boundaryCount && q[2]<data.section.boundaryCount)outer.push(i);});
    if(outer.length!==4*c.mesh.sideDiv)throw Error('Jumlah muka luar tidak sesuai.');
    for(let k=0;k<data.zlevels.length-1;k++)for(const qi of outer)surfaces[k<c.mesh.layersOld?'OLD_SIDE':'NEW_SIDE'].push(k*nq+qi+1);
    surfaces.OLD_TOP=Array.from({length:nq},(_,i)=>oldElements-nq+i+1);
    surfaces.NEW_TOP=Array.from({length:nq},(_,i)=>cells.length-nq+i+1);
    const bc={OLD_SIDE:['OLD_SIDE','H_OLD_SIDE',4],OLD_TOP:['OLD_TOP','H_OLD_TOP',2],NEW_FORM:['NEW_SIDE','H_FORM',4],NEW_AIR:['NEW_SIDE','H_AIR',4],TOP_CURE:['NEW_TOP','H_CURING',2],TOP_AIR:['NEW_TOP','H_TOP_AIR',2]};
    // Audit boundary changes using actual element faces at each stage.
    const activeE=new Set(),activeB=new Set(),auditStages=[];let elapsed=0;
    const faceKey=(e,f)=>faceNodes[f-1].map(i=>cells[e-1][i]).sort((a,b)=>a-b).join(':');
    for(const stage of stageData){
      for(const name of stage.ae)for(const id of groups[name].elements){if(activeE.has(id))throw Error('Elemen diaktifkan ulang.');activeE.add(id);}
      for(const name of stage.db){if(!activeB.delete(name))throw Error('Grup batas belum aktif: '+name);}
      for(const name of stage.ab){if(activeB.has(name))throw Error('Grup batas aktif dua kali.');activeB.add(name);}
      const assigned=new Set();
      for(const name of activeB){if(!bc[name])continue;const [surface,,face]=bc[name];
        if(name==='OLD_TOP' && activeE.size>oldElements)throw Error('Konveksi pada sambungan internal.');
        for(const id of surfaces[surface]){
          if(!activeE.has(id))throw Error('Konveksi pada elemen belum aktif.');
          const key=faceKey(id,face);if(assigned.has(key))throw Error('Konveksi rangkap.');assigned.add(key);
        }
      }
      const end=stage.steps[stage.steps.length-1];
      auditStages.push({name:stage.name,label:stage.label,globalStart:elapsed,globalEnd:elapsed+end,
        newAgeStart:elapsed-c.schedule.init,newAgeEnd:elapsed+end-c.schedule.init,activeElements:activeE.size,
        convectionFaces:assigned.size,activeBoundaries:[...activeB],temperatureOverride:stage.temp,steps:stage.steps.length});
      elapsed+=end;
    }
    const E=4700*Math.sqrt(c.material.fc)*1e6,m=c.material,T=c.temperature;
    const lines=['; CIVIL HEAT STUDIO - ILLUSTRATIVE HEAT OF HYDRATION MODEL',
      '; Offline HTML generator. NOT project calibrated. Native MIDAS import/solver not tested.',
      '; Units N,m,kJ,degC; hydration time HOURS; mass kg.',
      '; Old concrete starts mature with ASSUMED initial temperature and zero residual heat.',
      '; No reconstructed pre-existing temperature/stress history. Shared joint: perfect contact.',
      '; Mix information is provenance; it does NOT calibrate heat curve or strength development.',
      `; MIX kg/m3: cement=${c.mix.cement}, flyash=${c.mix.flyash}, water=${c.mix.water}, sand=${c.mix.sand}, gravel=${c.mix.gravel}`,
      `; MIX kg/m3 admixtures=${c.mix.admixture1}+${c.mix.admixture2}; w/b=${mixMetrics(c).wb.toFixed(8)}`,
      `; fc=${m.fc}MPa basis for E; no nonlinear strength/age law. Creep/equivalent age/selfweight disabled.`,
      `; Base thermal boundary=${c.boundary.baseMode}. Base mechanical translations fixed: illustrative only.`,
      '; Do not interpret illustrative elastic stress as a validated cracking assessment.',
      '*UNIT','N, M, KJ, C','','*STRUCTYPE',`0, 1, 3, NO, NO, 9.80665, ${T.old}, NO, NO, NO`,'','*MATERIAL',
      '; iMAT,TYPE,MNAME,SPHEAT,HEATCO,PLAST,TUNIT,bMASS,DAMP,2,E,nu,alpha,DEN,MASS'];
    for(const [id,name] of [[1,'FC_OLD'],[2,'FC_NEW']])lines.push(`${id}, CONC, ${name}, ${m.cp.toFixed(9)}, ${(m.conductivity*3.6).toFixed(9)}, , C, NO, 0.05, 2, ${E.toFixed(6)}, ${m.poisson}, ${m.expansion}, ${(m.density*9.80665).toFixed(6)}, 0`);
    lines.push('','*MATL-COLOR','1, 90, 100, 110, 180, 186, 193, 48, 60, 72, NO, 0.5','2, 160, 90, 35, 220, 139, 61, 48, 60, 72, NO, 0.5','','*NODE');
    nodes.forEach((p,i)=>lines.push(`${i+1}, ${p.map(x=>x.toFixed(10)).join(', ')}`));
    lines.push('','*ELEMENT');cells.forEach((cell,i)=>lines.push(`${i+1}, SOLID, ${i<oldElements?1:2}, 0, ${cell.map(x=>x+1).join(', ')}`));
    lines.push('','*GROUP');for(const [name,g] of Object.entries(groups))lines.push(`${name}, ${g.start}to${g.end}, ${ranges(g.elements)}, 0`);
    lines.push(`JOINT, ${c.mesh.layersOld*nn+1}to${(c.mesh.layersOld+1)*nn}, , 0`,'','*BNDR-GROUP');
    ['MECH_BASE',...(baseFixed?['BASE_TEMP']:[]),...Object.keys(bc)].forEach(name=>lines.push(`${name}, 0`));
    lines.push('','*CONSTRAINT',`1to${nn}, 111000, MECH_BASE`);
    if(baseFixed)lines.push('','*HYD-PRTEMPER',`1to${nn}, ${T.base}, BASE_TEMP`);
    lines.push('','*HYD-HEATSRCF','; USER + YES: adiabatic temperature RISE table vs material age in HOURS.',
      'FUNC=OLD_ZERO, USER, 1, YES','0, 0',`${c.schedule.end+48}, 0`,'FUNC=NEW_ADIABATIC, USER, 1, YES');
    const heatTimes=[0,...steps(Math.min(72,c.schedule.end),0.5)];
    if(c.schedule.end>72)heatTimes.push(...steps(c.schedule.end,2,72));
    heatTimes.push(c.schedule.end+48);
    for(const time of heatTimes)lines.push(`${time.toFixed(6)}, ${heatRise(c,time).toFixed(9)}`);
    lines.push('','*HYD-CONVCOEF');
    const hv={H_OLD_SIDE:c.convection.oldSide,H_OLD_TOP:c.convection.oldTop,H_FORM:c.convection.form,H_AIR:c.convection.air,H_CURING:c.convection.curing,H_TOP_AIR:c.convection.topAir};
    Object.entries(hv).forEach(([name,value])=>lines.push(`FUNC=${name}, CONST, ${(value*3.6).toFixed(9)}`));
    lines.push('','*HYD-AMBTEMPF',`FUNC=AMBIENT, CONST, ${T.ambient}`,'','*HYD-HEATSRC',`${ranges(oldIds)}, OLD_ZERO`,`${ranges(newIds)}, NEW_ADIABATIC`,'','*HYD-CONBNDR');
    for(const [name,[surface,func,face]] of Object.entries(bc))for(const chunk of chunks(surfaces[surface]))lines.push(`${chunk}, ${func}, AMBIENT, ${face}, ${name}`);
    lines.push('','*HYD-STAGE','; STEP = cumulative LOCAL stage times in HOURS; no invented AGE field.');
    for(const stage of stageData){
      lines.push(`NAME=${stage.name}, ${stage.temp===null?'NO, 0':`YES, ${stage.temp}`}`);
      // Keep STEP on one conservative line rather than inventing continuation.
      lines.push('STEP='+stage.steps.join(', '));
      for(const [field,key] of [['AELEM','ae'],['ABNDR','ab'],['DBNDR','db']])if(stage[key].length)lines.push(field+'='+stage[key].join(', '));
    }
    lines.push('','*HYD-CTRL','; TYPE=BOTH is disabled creep/shrinkage selection, not thermal/stress mode.',
      `YES, , 1, ${T.old}, GAUSS, NO, NO, -1, NO, BOTH, 0, 5, 0.001`,'','*HYD-NODE');
    const monitors=[];
    for(const [name,target] of [['OLD_CORE',[0,0,c.geometry.heightOld/2]],['JOINT_CORE',[0,0,c.geometry.heightOld]],
      ['NEW_CORE',[0,0,c.geometry.heightOld+c.geometry.heightNew/2]],['NEW_SIDE',[c.geometry.diameter/2,0,c.geometry.heightOld+c.geometry.heightNew/2]],
      ['NEW_TOP',[0,0,c.geometry.heightOld+c.geometry.heightNew]]]){
      let idx=0,dist=Infinity;nodes.forEach((p,i)=>{const d=p.reduce((v,x,k)=>v+(x-target[k])**2,0);if(d<dist){dist=d;idx=i;}});
      monitors.push({name,id:idx+1,coordinates:nodes[idx],target});lines.push(`${name}, ${idx+1}, 3, 0`);
    }
    lines.push('','*ENDDATA','');
    if(lines.some(x=>x.length>1024))throw Error('Terlalu banyak timestep dalam satu tahap. Perbesar timestep agar baris MCT tetap ringkas.');
    return {text:lines.join('\r\n'),filename:'PILAR_HEAT_HYDRATION.MCT',mesh:data,
      stats:estimate(c),stages:auditStages,monitors,units:units(c),checks:data.audit,
      config:clone(c),nativeMidasTested:false,journalValidated:false};
  }
  root.MidasEngine={defaults:()=>clone(DEFAULTS),cleanConfig,mixMetrics,estimate,validate,crossSection,auditCross,mesh,ranges,stages,units,heatRise,build};
  if(typeof module!=='undefined' && module.exports)module.exports=root.MidasEngine;
})(typeof window!=='undefined'?window:globalThis);
