/* Time-dependent concrete definitions and classic MIDAS MCT cards.
 * The built-in code models are exported to MIDAS; this module is not a creep solver.
 */
(function (root) {
  'use strict';
  const DEFAULTS={
    enabled:'yes',creepModel:'CEB1990',strengthModel:'CEB1990',
    humidity:70,notionalSize:3.75,volumeSurface:1.875,shrinkageAge:3,cementType:'NR',
    aciA:4,aciB:0.85,aciCuring:'MOIST',aciUltimate:'CODE',aciSlump:100,
    aciFineAggregate:43.42,aciAir:2,aciMixSource:'jobmix',aciCementContent:432,
    ultimateCreep:2.35,ultimateShrinkage:780,aashtoExposed:'no',cebMeanOffset:8,
    csMode:'BOTH',iterations:10,tolerance:0.001,
    linkOldCreep:'no',linkOldStrength:'no',linkNewCreep:'yes',linkNewStrength:'yes',
    strengthScale:1,creepModulusSource:'material',creepReferenceModulus:25742.96020274281,
    customStrength:'0, 0, 0, 0\n1, 8, 0.6, 13000\n3, 16, 1.2, 19000\n7, 23, 1.8, 23000\n28, 30, 2.5, 25743\n90, 34, 2.8, 27500',
    customCreep:[3,7,14,28,60].map((age,i)=>[
      `${age}, 0, 0`,`${age}, 1, ${0.25/(1+i*0.15)}`,
      `${age}, 7, ${0.7/(1+i*0.15)}`,`${age}, 28, ${1.1/(1+i*0.15)}`,
      `${age}, 90, ${1.5/(1+i*0.15)}`,`${age}, 365, ${1.9/(1+i*0.15)}`
    ].join('\n')).join('\n'),
    customShrinkage:'0, 0\n3, 0\n7, 80\n28, 220\n90, 380\n365, 550'
  };
  const enumValues={
    enabled:['yes','no'],creepModel:['ACI','CEB1990','AASHTO2006','USER'],
    strengthModel:['ACI','CEB1990','AASHTO','USER'],cementType:['RS','NR','SL'],
    aciCuring:['MOIST','STEAM'],aciUltimate:['CODE','USER'],aciMixSource:['jobmix','manual'],
    aashtoExposed:['yes','no'],csMode:['BOTH','CREEP','SHRINK'],creepModulusSource:['material','user'],
    linkOldCreep:['yes','no'],linkOldStrength:['yes','no'],linkNewCreep:['yes','no'],linkNewStrength:['yes','no']
  };
  const labels={ACI:'ACI 209(1982)',CEB1990:'CEB-FIP(1990)',AASHTO2006:'AASHTO(2006)',USER:'User / custom jobmix'};
  const refs={
    mct:{id:'MIDAS-MCT',title:'MIDAS Civil MCT Quick Reference: TDM-FUNC / TDM-TYPE / TDM-ELAST / TDM-LINK',url:'https://manual.midasuser.com/EN_Common/Civil/865/Start/14_Appendix/MCT_File_Quick_Reference.htm'},
    cs:{id:'MIDAS-CS',title:'MIDAS Civil: Creep/Shrinkage (ACI 209(1982), CEB-FIP, AASHTO(2006))',url:'https://manual.midasuser.com/EN_Common/Civil/895/Start/04_Model/05_Properties/Time_Dependent_Material_(Creep_Shrinkage).htm'},
    strength:{id:'MIDAS-STRENGTH',title:'MIDAS: Time Dependent Material (Comp. Strength)',url:'https://support.midasuser.com/hc/en-us/articles/29786771254809-Time-Dependent-Material-Comp-Strength'},
    mean:{id:'MIDAS-FCM',title:'MIDAS Civil FCM tutorial: characteristic C&S strength and mean strength development',url:'https://support.midasuser.com/hc/en-us/articles/47452644584985--CIVIL-Construction-Stage-Analysis-using-FCM-Bridge-Wizard'},
    aashto:{id:'WSDOT-ACI',title:'WSDOT PGSuper: AASHTO has no age-strength model; ACI 209R-92 convention',url:'https://www.wsdot.wa.gov/eesc/bridge/software/Documentation/PGSLibrary/8.0/tg_time_dependent_material_models.html'},
    user:{id:'MIDAS-USER',title:'MIDAS: user-defined creep and shrinkage functions',url:'https://support.midasuser.com/hc/en-us/articles/17536540979353-User-Define'},
    control:{id:'MIDAS-HYD',title:'MIDAS Civil: Heat of Hydration Analysis Control',url:'https://manual.midasuser.com/EN_Common/Civil/865/Start/06_Analysis/Hydration_Heat_Analysis_Control.htm'}
  };
  const copy=o=>JSON.parse(JSON.stringify(o));
  const yes=x=>x==='yes';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  function fail(field,message){const e=Error(message);e.field='timeDependent.'+field;throw e;}
  function csv(text,columns,field){
    if(typeof text!=='string'||text.length>64000)fail(field,'Tabel custom harus berupa teks CSV, maksimum 64.000 karakter.');
    const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
    if(lines.length<2||lines.length>512)fail(field,'Tabel custom harus memuat 2–512 baris data.');
    return lines.map((line,i)=>{
      const parts=line.split(/[,;\t]/).map(x=>x.trim());
      if(parts.length!==columns||parts.some(x=>!x))fail(field,`Tabel custom baris ${i+1}: diperlukan ${columns} kolom angka; gunakan titik desimal.`);
      const row=parts.map(Number);
      if(row.some(x=>!finite(x)))fail(field,`Tabel custom baris ${i+1}: semua kolom harus berupa angka berhingga.`);
      return row;
    });
  }
  function strengthRows(t){
    const rows=csv(t.customStrength,4,'customStrength');
    rows.forEach((r,i)=>{
      if(r[0]<0||r[0]>36500||i&&r[0]<=rows[i-1][0])fail('customStrength','Umur kuat tekan harus tidak negatif dan meningkat tanpa duplikasi (maksimum 36.500 hari).');
      if(r.slice(1).some(x=>x<0)||r[1]>500||r[2]>100||r[3]>200000)fail('customStrength','Kolom fc, ft dan E memakai MPa, harus tidak negatif dan berada dalam rentang material beton.');
      if(r[0]>0&&(r[1]<=0||r[3]<=0))fail('customStrength','fc dan E harus positif untuk umur lebih dari nol.');
    });
    if(rows[0][0]!==0)fail('customStrength','Tabel kuat tekan harus dimulai pada umur 0 hari agar tidak mengekstrapolasi kondisi awal.');
    return rows.map(([day,fc,tensile,elastic])=>({day,fc,tensile,elastic:elastic*t.strengthScale}));
  }
  function creepRows(t){
    const rows=csv(t.customCreep,3,'customCreep'),groups=new Map();
    for(const [loadingAge,day,value] of rows){
      if(loadingAge<=0||loadingAge>36500||day<0||day>36500||value<0||value>100)
        fail('customCreep','CSV creep: umur pembebanan > 0 hari; durasi dan koefisien creep tidak negatif.');
      if(!groups.has(loadingAge))groups.set(loadingAge,[]);
      const points=groups.get(loadingAge);
      if(points.length&&day<=points.at(-1).day)fail('customCreep','Durasi tiap fungsi creep harus meningkat tanpa duplikasi.');
      points.push({day,value});
    }
    if(groups.size>16)fail('customCreep','Maksimum 16 umur pembebanan creep untuk ekspor MCT ini.');
    return [...groups].sort((a,b)=>a[0]-b[0]).map(([loadingAge,points])=>{
      if(points.length<2||points[0].day!==0||points[0].value!==0)
        fail('customCreep','Setiap umur pembebanan harus memiliki minimal dua titik, dimulai durasi 0 dan koefisien 0.');
      return {loadingAge,points};
    });
  }
  function shrinkageRows(t){
    const rows=csv(t.customShrinkage,2,'customShrinkage');
    rows.forEach((r,i)=>{
      if(r[0]<0||r[0]>36500||i&&r[0]<=rows[i-1][0]||r[1]<0||r[1]>10000)
        fail('customShrinkage','CSV susut: umur meningkat tanpa duplikasi, nilai susut positif dalam microstrain (0–10.000).');
    });
    if(rows[0][0]!==0)fail('customShrinkage','Tabel susut harus dimulai pada umur 0 hari.');
    return rows.map(([day,value])=>({day,value}));
  }
  function links(c){
    const t=c.timeDependent;
    return [[1,'FC_OLD','Old'],[2,'FC_NEW','New']].map(([material,name,suffix])=>{
      const creep=yes(t.enabled)&&yes(t['link'+suffix+'Creep']),strength=yes(t.enabled)&&yes(t['link'+suffix+'Strength']);
      return {material,name,creep,strength,creepName:creep?'TD_CS':'',strengthName:strength?'TD_FC':''};
    });
  }
  function validate(c){
    const errors=[],warnings=[],t=c.timeDependent;
    const err=(field,message)=>errors.push({field:'timeDependent.'+field,message});
    if(!t||typeof t!=='object'||Array.isArray(t))return {errors:[{field:'timeDependent',message:'Kelompok material bergantung waktu tidak lengkap.'}],warnings};
    for(const [key,allowed] of Object.entries(enumValues))if(!allowed.includes(t[key]))err(key,'Pilihan material bergantung waktu tidak dikenal: '+key+'.');
    for(const [key,value] of Object.entries(DEFAULTS)){
      if(typeof value==='number'&&!finite(t[key]))err(key,'Parameter material bergantung waktu harus berupa angka berhingga: '+key+'.');
      if(typeof value==='string'&&typeof t[key]!=='string')err(key,'Parameter material bergantung waktu harus berupa teks: '+key+'.');
    }
    if(errors.length||!yes(t.enabled))return {errors,warnings};
    const range=(key,min,max,strict=false)=>{if((strict?t[key]<=min:t[key]<min)||t[key]>max)err(key,`${key}: nilai harus ${strict?'>':'≥'} ${min} dan ≤ ${max}.`);};
    range('humidity',40,99);range('notionalSize',0,100,true);range('volumeSurface',0,50,true);range('shrinkageAge',0,36500);
    range('aciA',0,100,true);range('aciB',0,10,true);range('cebMeanOffset',0,50);
    range('iterations',1,100);if(!Number.isInteger(t.iterations))err('iterations','Jumlah iterasi creep harus bilangan bulat.');
    range('tolerance',0,0.1,true);range('strengthScale',0,100,true);
    if(t.creepModel==='USER'&&t.creepModulusSource==='user')range('creepReferenceModulus',0,200000,true);
    if(t.creepModel==='ACI'){
      if(t.aciUltimate==='CODE'){
        range('aciSlump',0,300);range('aciFineAggregate',0,100);range('aciAir',0,20);
        const cement=t.aciMixSource==='jobmix'?c.mix?.cement:t.aciCementContent;
        if(!finite(cement)||cement<=0||cement>1500)err('aciCementContent','Kadar semen aktif untuk ACI harus > 0 dan ≤ 1.500 kg/m³.');
        else if(cement<260||cement>500)warnings.push({message:'Kadar semen ACI di luar rentang acuan 260–500 kg/m³; kalibrasi terhadap jobmix diperlukan.'});
      }else{range('ultimateCreep',0,100,true);range('ultimateShrinkage',0,10000);}
    }
    const period=(c.schedule?.end||0)/24;
    const parse=(fn,field)=>{try{return fn(t);}catch(e){err(field,e.message);return null;}};
    if(t.strengthModel==='USER'){
      const curve=parse(strengthRows,'customStrength');
      if(curve&&yes(t.linkNewStrength)&&curve.at(-1).day<period)err('customStrength','Tabel kuat tekan harus mencakup akhir analisis hidrasi dalam hari.');
    }
    if(t.creepModel==='USER'){
      const curves=parse(creepRows,'customCreep'),shrink=parse(shrinkageRows,'customShrinkage');
      if(curves&&curves.length<5)warnings.push({message:'Creep custom memakai kurang dari lima umur pembebanan; MIDAS menyarankan minimal lima fungsi untuk interpolasi umur.'});
      if(curves&&yes(t.linkNewCreep)&&curves.some(x=>x.points.at(-1).day<period))err('customCreep','Setiap fungsi creep harus mencakup durasi analisis hidrasi dalam hari.');
      if(shrink&&yes(t.linkNewCreep)&&shrink.at(-1).day<period)err('customShrinkage','Tabel susut harus mencakup akhir analisis hidrasi dalam hari.');
    }
    if(yes(t.linkOldCreep)||yes(t.linkOldStrength))warnings.push({message:'Link beton lama diaktifkan: tahap hidrasi ini tidak menetapkan umur awal beton lama atau merekonstruksi riwayat tegangan/susutnya. Periksa atau gunakan fungsi mature custom sebelum analisis native.'});
    if(!links(c).some(x=>x.creep||x.strength))warnings.push({message:'Definisi material bergantung waktu tersedia tetapi tidak dihubungkan ke material mana pun.'});
    if(t.strengthModel==='AASHTO')warnings.push({message:'Pilihan kuat tekan AASHTO menggunakan ACI 209R-92 (konvensi WSDOT); bukan model kuat tekan AASHTO tersendiri.'});
    if(t.creepModel==='CEB1990'&&(c.material.fc<12||c.material.fc>80))warnings.push({message:'Kuat tekan karakteristik di luar rentang umum beton normal CEB-FIP(1990); periksa cakupan model dan kalibrasi.'});
    return {errors,warnings};
  }
  function checked(c){const v=validate(c);if(v.errors.length){const e=Error(v.errors[0].message);e.field=v.errors[0].field;throw e;}return v;}
  function nativeStrength(c,day){
    const t=c.timeDependent;
    if(day<=0)return 0;
    if(t.strengthModel==='CEB1990'){
      const s={RS:0.2,NR:0.25,SL:0.38}[t.cementType];
      return (c.material.fc+t.cebMeanOffset)*Math.exp(s*(1-Math.sqrt(28/day)));
    }
    return c.material.fc*day/(t.aciA+t.aciB*day);
  }
  function evaluate(c){
    const validation=checked(c),t=c.timeDependent,enabled=yes(t.enabled),isUser=t.strengthModel==='USER';
    const strengthCurve=enabled?(isUser?strengthRows(t):[0,1,3,7,14,28,60,90,180,365].map(day=>({day,fc:nativeStrength(c,day),tensile:null,elastic:null}))):[];
    const references=[refs.mct,refs.cs,refs.strength,refs.control];
    if(t.strengthModel==='CEB1990')references.push(refs.mean);
    if(t.strengthModel==='AASHTO')references.push(refs.aashto);
    if(t.creepModel==='USER')references.push(refs.user);
    return {enabled,creepLabel:labels[t.creepModel],strengthLabel:t.strengthModel==='AASHTO'?'ACI 209R-92 (konvensi AASHTO/WSDOT)':t.strengthModel==='ACI'?'ACI 209R-92':labels[t.strengthModel],
      fc28:c.material.fc,strength28:isUser?null:c.material.fc+(t.strengthModel==='CEB1990'?t.cebMeanOffset:0),
      strengthBasis:isUser?'user':t.strengthModel==='CEB1990'?'mean':'nominal',
      aciCement:t.aciMixSource==='jobmix'?c.mix.cement:t.aciCementContent,
      creepE:t.creepModulusSource==='user'?t.creepReferenceModulus:4700*Math.sqrt(c.material.fc),
      creepEMct:(t.creepModulusSource==='user'?t.creepReferenceModulus:4700*Math.sqrt(c.material.fc))*1e6,
      sizeAssumption:'Nilai awal h=D/2 dan V/S=D/4 untuk silinder D=7,5 m dengan permukaan sisi saja; muka ujung diabaikan. Ukuran tetap editable dan tidak berubah otomatis saat geometri diedit.',
      links:links(c),strengthCurve,creepCurves:enabled&&t.creepModel==='USER'?creepRows(t):[],
      shrinkageCurve:enabled&&t.creepModel==='USER'?shrinkageRows(t):[],references,warnings:validation.warnings,
      previewScope:'Kurva kuat tekan acuan; native CODE menentukan E(t) dan ft(t) di MIDAS. Tabel USER memakai nilai yang diberikan. Creep/susut kode dihitung oleh MIDAS.',
      customAssumption:'Tabel custom awal adalah contoh asumsi, bukan hasil uji jobmix.'};
  }
  const num=x=>Object.is(x,-0)?'0':String(+x.toPrecision(12));
  function cards(c){
    checked(c);const t=c.timeDependent;if(!yes(t.enabled))return [];
    const result=evaluate(c),E=result.creepEMct,lines=[
      '; TIME DEPENDENT MATERIAL: age/duration in DAYS; stress in N/m2; lengths in m.',
      '; Material 1 (old) has no reconstructed age/stress history; link defaults off.',
      `; fck28=${num(c.material.fc)}MPa; strength basis=${result.strengthBasis}; exported strength28=${result.strength28===null?'USER TABLE':num(result.strength28)+'MPa'}.`
    ];
    if(t.creepModel==='USER'){
      lines.push('*TDM-FUNC','; Creep uses dimensionless coefficient CC with reference modulus in N/m2.');
      result.creepCurves.forEach((curve,i)=>{
        lines.push(`FUNC=TD_CREEP_${i+1}, CREEP, 1, CC, ${num(E)}, Custom creep`);
        curve.points.forEach(p=>lines.push(`${num(p.day)}, ${num(p.value)}`));
      });
      lines.push('FUNC=TD_SHRINK, SHRINK, 1, , , Custom shrinkage','; Positive shrinkage microstrain input converted to dimensionless strain.');
      result.shrinkageCurve.forEach(p=>lines.push(`${num(p.day)}, ${num(p.value*1e-6)}`));
    }
    lines.push('*TDM-TYPE');
    if(t.creepModel==='CEB1990')lines.push(`NAME=TD_CS, CEB, ${num(c.material.fc*1e6)}, ${num(t.humidity)}, ${num(t.notionalSize)}, ${t.cementType}, ${num(t.shrinkageAge)}, 0`);
    if(t.creepModel==='AASHTO2006')lines.push(`NAME=TD_CS, AASHTO, ${num(c.material.fc*1e6)}, ${num(t.humidity)}, ${num(t.volumeSurface)}, ${num(t.shrinkageAge)}, ${yes(t.aashtoExposed)?'YES':'NO'}`);
    if(t.creepModel==='ACI'){
      const common=`NAME=TD_CS, ACI, ${num(c.material.fc*1e6)}, ${num(t.humidity)}, ${num(t.volumeSurface)}, ${num(t.shrinkageAge)}, ${num(t.aciA)}, ${num(t.aciB)}, ${t.aciUltimate}`;
      lines.push(t.aciUltimate==='CODE'?`${common}, ${t.aciCuring}, ${num(t.aciSlump/1000)}, ${num(t.aciFineAggregate)}, ${num(t.aciAir)}, ${num(result.aciCement)}`:`${common}, ${num(t.ultimateCreep)}, ${num(t.ultimateShrinkage)}`);
    }
    if(t.creepModel==='USER'){
      lines.push('NAME=TD_CS, USER, YES, TD_SHRINK');
      lines.push(result.creepCurves.map((curve,i)=>`TD_CREEP_${i+1}, ${num(curve.loadingAge)}`).join(', '));
    }
    lines.push('*TDM-ELAST');
    if(t.strengthModel==='USER'){
      lines.push(`NAME=TD_FC, USER, ${num(t.strengthScale)}`,'; USER rows: age(days), fc(N/m2), ft(N/m2), E(N/m2); SCALE applies to E only.');
      strengthRows({...t,strengthScale:1}).forEach(p=>lines.push(`${num(p.day)}, ${num(p.fc*1e6)}, ${num(p.tensile*1e6)}, ${num(p.elastic*1e6)}`));
    }else if(t.strengthModel==='CEB1990'){
      lines.push(`; CEB mean fcm28=fck28+${num(t.cebMeanOffset)}MPa; do not confuse with characteristic C&S strength.`);
      lines.push(`NAME=TD_FC, CODE, CEB-FIP(1990), ${num(result.strength28*1e6)}, ${{RS:1,NR:2,SL:3}[t.cementType]}`);
    }else{
      if(t.strengthModel==='AASHTO')lines.push('; AASHTO selection uses ACI 209R-92 age-strength convention documented by WSDOT.');
      lines.push(`NAME=TD_FC, CODE, ACI, ${num(c.material.fc*1e6)}, ${num(t.aciA)}, ${num(t.aciB)}`);
    }
    const active=result.links.filter(x=>x.creep||x.strength);
    if(active.length){lines.push('*TDM-LINK','; Material ID, creep/shrinkage property, compressive-strength property.');
      active.forEach(x=>lines.push(`${x.material}, ${x.creepName}, ${x.strengthName}`));}
    return lines;
  }
  function control(c){
    const t=c.timeDependent,active=yes(t.enabled)&&links(c).some(x=>x.creep);
    return `YES, , 1, ${c.temperature.old}, GAUSS, NO, NO, -1, ${active?'YES':'NO'}, ${yes(t.enabled)?t.csMode:'BOTH'}, 0, ${yes(t.enabled)?t.iterations:5}, ${yes(t.enabled)?t.tolerance:0.001}`;
  }
  const api={defaults:()=>({timeDependent:copy(DEFAULTS)}),validate,evaluate,cards,control};
  root.HydrationTimeDependent=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
