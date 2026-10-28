/* Constant thermal properties for MCT, with transparent estimation methods. */
(function (root) {
  'use strict';
  const phases=[['cement','Semen'],['flyash','Fly ash'],['water','Air'],['sand','Pasir'],
    ['gravel','Agregat kasar'],['admixture1','Admixture 1'],['admixture2','Admixture 2']];
  const thermal={cpMode:'manual',kMode:'manual',referenceTemperature:30,oldMode:'same',oldCp:.9,oldK:2.4};
  // Editable examples, NOT measurements or properties certified by the cited code.
  const thermalComponents={};
  const properties={cement:[3150,.84,1.5],flyash:[2300,.75,.7],water:[1000,4.18,.6],
    sand:[2650,.8,3],gravel:[2700,.8,3],admixture1:[1100,3.5,.5],admixture2:[1100,3.5,.5]};
  for(const [phase]of phases)for(const [i,name]of ['Density','Cp','K'].entries())thermalComponents[phase+name]=properties[phase][i];
  const sources=[
    {id:'MIX-CP',title:'BAMresearch / FenicsConcrete: constituent volumetric heat-capacity homogenization',
      url:'https://github.com/BAMresearch/FenicsConcrete/blob/master/fenics_concrete/mori_tanaka_homogenization.py#L296',
      scope:'Energy-balance basis for mass-weighted cp. Constituent properties must be supplied; no calibration of this project.'},
    {id:'WIENER',title:'SimPEG Wiener bounds; reference to Torquato, Random Heterogeneous Materials (2002)',
      url:'https://github.com/simpeg/simpeg/blob/main/simpeg/maps/_property_maps.py#L1282',
      scope:'Generic positive scalar conduction: ideal series/parallel bounds, not concrete-specific measurement. Geometric mean is a separate estimate.'},
    {id:'EC2',title:'ConcreteEC2.cpp — OpenSees for Fire implementation of EC2 concrete thermal relations',
      url:'https://github.com/OpenSeesforFire/openseesforfire.github.io/blob/OpenSees-SRC/SRC/HeatTransfer/HeatTransferMaterial/ConcreteEC2.cpp',
      scope:'Dry, hardened concrete under fire-design temperature; code-reference option only. Constant evaluation at reference temperature, not fresh-concrete calibration.'},
    {id:'MIDAS-UNIT',title:'MIDAS unit-system documentation mirror: N (kg), KN (ton)',
      url:'https://github.com/python261/midas-civil-NX-API/blob/main/db/project/Unit-System.md',scope:'Force/mass and heat unit mapping.'},
    {id:'MIDAS-HOH',title:'MIDASIT heat-of-hydration tutorial',
      url:'https://github.com/MIDASIT-Co-Ltd/midas-civil-python/blob/main/examples/python/Tut7%20Heat%20of%20Hydration.py',scope:'Staging and thermal boundary workflow.'}
  ];
  const clone=x=>JSON.parse(JSON.stringify(x));
  function fail(field,message){const e=Error(message);e.field=field;throw e;}
  function ec2(T){
    if(!Number.isFinite(T)||T<20||T>1200)fail('thermal.referenceTemperature','Acuan EC2 memerlukan suhu referensi 20–1200°C.');
    const cpJ=T<=100?900:T<=200?800+T:T<=400?900+.5*T:1100;
    const x=T/100;
    return {cp:cpJ/1000,lower:1.36-.136*x+.0057*x*x,upper:2-.2451*x+.0107*x*x};
  }
  function evaluate(c){
    const t=c.thermal,cpModes=['manual','mixture','ec2_dry'],kModes=['manual','geometric','series','parallel','ec2_lower','ec2_upper'];
    if(!cpModes.includes(t.cpMode))fail('thermal.cpMode','Metode panas jenis tidak dikenal.');
    if(!kModes.includes(t.kMode))fail('thermal.kMode','Metode konduktivitas tidak dikenal.');
    if(!['same','manual'].includes(t.oldMode))fail('thermal.oldMode','Metode material beton lama tidak dikenal.');
    const component=c.thermalComponents,rows=[];let mass=0,sumV=0,capacity=0,validCp=true,validV=true,validK=true;
    let cpError=null,kError=null;
    for(const [id,label]of phases){
      const m=c.mix[id],rho=component[id+'Density'],cp=component[id+'Cp'],k=component[id+'K'];
      if(!Number.isFinite(m)||m<0)fail('mix.'+id,'Massa bahan harus berhingga dan tidak negatif.');
      const volume=m===0?0:(rho>0&&Number.isFinite(rho)?m/rho:NaN);
      mass+=m;
      if(m>0){
        if(!(cp>0&&Number.isFinite(cp))){validCp=false;cpError=cpError||[id+'Cp',label+': panas jenis fase harus positif.'];}
        else capacity+=m*cp;
        if(!Number.isFinite(volume)){validV=false;kError=kError||[id+'Density',label+': massa jenis fase harus positif.'];}
        else sumV+=volume;
        if(!(k>0&&Number.isFinite(k))){validK=false;kError=kError||[id+'K',label+': konduktivitas fase harus positif.'];}
      }
      rows.push({id,label,mass:m,density:rho,cp,k,volume});
    }
    if(!(mass>0))fail('mix.cement','Jumlah massa campuran harus positif.');
    if(!validV)sumV=NaN;
    let series=NaN,parallel=NaN,geometric=NaN;
    if(validK&&validV&&sumV>0){
      let inverse=0,linear=0,logarithm=0;
      for(const row of rows){row.fraction=row.volume/sumV;if(row.mass===0)continue;
        inverse+=row.fraction/row.k;linear+=row.fraction*row.k;logarithm+=row.fraction*Math.log(row.k);}
      series=1/inverse;parallel=linear;geometric=Math.exp(logarithm);
    }else for(const row of rows)row.fraction=Number.isFinite(sumV)?row.volume/sumV:NaN;
    const mixtureCp=validCp?capacity/mass:NaN,codeSelected=t.cpMode==='ec2_dry'||t.kMode.startsWith('ec2_');
    const code=codeSelected?ec2(t.referenceTemperature):null;
    let cp=c.material.cp,k=c.material.conductivity;
    if(t.cpMode==='mixture'){
      if(!Number.isFinite(mixtureCp))fail('thermalComponents.'+cpError[0],cpError[1]);
      cp=mixtureCp;
    }else if(t.cpMode==='ec2_dry')cp=code.cp;
    if(['series','parallel','geometric'].includes(t.kMode)){
      if(!validV||!validK||!(sumV>0))fail('thermalComponents.'+(kError||['cementDensity'])[0],(kError||['','Volume fase harus positif.'])[1]);
      k={series,parallel,geometric}[t.kMode];
    }else if(t.kMode==='ec2_lower')k=code.lower;
    else if(t.kMode==='ec2_upper')k=code.upper;
    if(!(cp>0&&Number.isFinite(cp)))fail('material.cp','Panas jenis aktif harus positif dan berhingga.');
    if(!(k>0&&Number.isFinite(k)))fail('material.conductivity','Konduktivitas aktif harus positif dan berhingga.');
    const oldCp=t.oldMode==='manual'?t.oldCp:cp,oldK=t.oldMode==='manual'?t.oldK:k;
    if(!(oldCp>0&&Number.isFinite(oldCp)))fail('thermal.oldCp','Panas jenis beton lama harus positif.');
    if(!(oldK>0&&Number.isFinite(oldK)))fail('thermal.oldK','Konduktivitas beton lama harus positif.');
    const rho=c.material.density,cv=rho*cp;
    const warnings=[];
    if(codeSelected)warnings.push('Acuan EC2 berasal dari beton mengeras pada desain kebakaran. Hasilnya konstan pada suhu referensi; belum merupakan kalibrasi beton segar/panas hidrasi.');
    if(Number.isFinite(sumV)&&Math.abs(sumV-1)>.05)warnings.push('Jumlah volume absolut fase berbeda >5% dari 1 m³. Periksa massa jenis dan basis campuran; fraksi dinormalisasi, bukan dianggap kadar udara terukur.');
    if(t.kMode==='geometric')warnings.push('Rata-rata geometrik adalah estimasi homogenisasi; batas seri/paralel bukan pengukuran konduktivitas beton.');
    if(t.cpMode==='mixture')warnings.push('Panas jenis campuran memakai sifat fase yang diasumsikan; perubahan hidrasi, air terikat dan kelembapan belum dimodelkan.');
    if(cp>3||k>15)warnings.push('Sifat efektif berada di luar rentang umum beton normal. Periksa satuan dan komposisi fase.');
    return {cp,k,oldCp,oldK,cpMct:cp,kMct:k*3.6,oldCpMct:oldCp,oldKMct:oldK*3.6,
      cpMode:t.cpMode,kMode:t.kMode,oldMode:t.oldMode,referenceTemperature:t.referenceTemperature,
      rows,totalMass:mass,sumVolume:sumV,mixtureCp,series,parallel,geometric,cv,
      diffusivity:k/(cv*1000),heatInfinity:cv*c.heat.K,codeSelected,code,warnings,sources};
  }
  root.HydrationThermal={defaults:()=>({thermal:clone(thermal),thermalComponents:clone(thermalComponents)}),phases,ec2,evaluate,sources};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.HydrationThermal;
})(typeof window!=='undefined'?window:globalThis);
