(function () {
  'use strict';
  const E=window.MidasEngine, $=id=>document.getElementById(id), storageKey='civil-heat-studio.v1';
  const fields=[...document.querySelectorAll('[data-key]')], desktop=window.hydrationDesktop;
  const format=(v,d=2)=>Number.isFinite(v)?new Intl.NumberFormat('id-ID',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v):'—';
  const integer=v=>format(v,0);
  let config=E.defaults(),lastModel=null,timer,saveAvailable=true;
  let savedFingerprint=JSON.stringify(E.defaults()),projectName='',projectPath='',saveBusy=false,openBusy=false;
  const reference={source:'Transkripsi foto tabel campuran pengguna; satuan kg/m3.',
    strength:{days3:[21.8,27.2],days7:[44.7,50.4,32.3],reportedMean3:24.5,reportedMean7:42.4,days28:null},
    temperatureLab:[{minutes:15,C:31.1},{minutes:60,C:32.3}],reportedSA:49,reportedRatio:28,
    note:'Basis S/A, persentase kekuatan, kondisi SSD dan absorpsi perlu konfirmasi. Tidak mengganti fc atau mengkalibrasi K/a.'};
  function fill(c){fields.forEach(el=>{const [g,k]=el.dataset.key.split('.');el.value=c[g][k];});}
  function read(){const c=E.defaults();fields.forEach(el=>{const [g,k]=el.dataset.key.split('.');c[g][k]=el.type==='number'?el.valueAsNumber:el.value;});return c;}
  function persist(c){
    try{localStorage.setItem(storageKey,JSON.stringify({schema:'civil-heat-studio/v1',config:c}));$('save-status').textContent='Tersimpan di browser';}
    catch(_){saveAvailable=false;$('save-status').textContent='Gunakan JSON untuk menyimpan';}
  }
  function projectStatus(current=read()){
    if(!desktop)return;
    const dirty=JSON.stringify(current)!==savedFingerprint;
    const filename=projectName||'Tanpa nama.json';
    $('project-file-name').textContent=filename;
    $('project-file-name').title=projectPath||'Proyek JSON belum memiliki lokasi penyimpanan';
    $('project-dirty').hidden=!dirty;
    $('save-status').textContent=saveBusy?'Menyimpan…':dirty?'Perubahan belum disimpan':projectName?'Tersimpan ke file':'Belum disimpan ke file';
    $('save-status').title=projectPath||'Gunakan Save / Save As untuk menyimpan proyek JSON.';
    $('save-as').disabled=saveBusy||!!E.validate(current).errors.length;
    if(saveBusy)$('export-json').disabled=true;
    $('import-json').disabled=openBusy||saveBusy;
    const state=document.querySelector('.nx-document-state');
    state.textContent=dirty?'BELUM DISIMPAN':projectName?'TERSIMPAN':'PARAMETER CONTOH';
    state.classList.toggle('has-unsaved',dirty);
    document.title=filename+(dirty?' *':'')+' — Civil Hydration NX';
    desktop.setDirty(dirty);
  }
  let loaded=false;
  try{const saved=localStorage.getItem(storageKey);if(saved){const c=E.cleanConfig(JSON.parse(saved));if(!E.validate(c).errors.length){config=c;loaded=true;}}}
  catch(_){saveAvailable=false;}
  fill(config);
  function svgText(x,y,text,extra=''){return `<text x="${x}" y="${y}" ${extra}>${text}</text>`;}
  function plan(section){
    const g=E.geometryInfo(config),scale=290/Math.max(g.width,g.depth),p=xy=>`${(180+xy[0]*scale).toFixed(2)},${(175-xy[1]*scale).toFixed(2)}`;
    const paths=section.quads.map(q=>`M${q.map(i=>p(section.xy[i])).join('L')}Z`).join('');
    $('mesh-plan').innerHTML=`<rect width="360" height="360" fill="#f9faf9"/><path d="${paths}" fill="#e4edf1" stroke="#527184" stroke-width=".65"/>`+
      '<path d="M35 338H325M35 333V343M325 333V343" stroke="#6c7e8a"/>'+svgText(180,332,g.shape==='rectangular'?`B ${format(g.width)} × L ${format(g.depth)} m`:`Ø ${format(g.width)} m`,'text-anchor="middle" fill="#536b7b" font-size="12"')+
      svgText(180,178,'+','text-anchor="middle" fill="#243e51" font-size="16"');
    $('mesh-plan').setAttribute('aria-label',g.shape==='rectangular'?'Mesh penampang rectangular dengan pembagian X dan Y':'Mesh penampang lingkaran lima blok');
  }
  function side(section){
    if(window.HydrationViewport){window.HydrationViewport.render(section,config);return;}
    const c=config,g=E.geometryInfo(c),D=(g.width+g.depth)/2,h1=c.geometry.heightOld,H=h1+c.geometry.heightNew;
    const scale=Math.min(220/(H+D*.3),220/(D*1.45)), p=([x,y],z)=>[220+(x-y)*.72*scale,263+(x+y)*.20*scale-z*scale];
    const coord=q=>q.map(x=>x.map(v=>v.toFixed(2)).join(',')).join(' ');
    let markup='<rect width="440" height="300" fill="#f9faf9"/>';
    const levels=[];for(let k=0;k<=c.mesh.layersOld;k++)levels.push(h1*k/c.mesh.layersOld);
    for(let k=1;k<=c.mesh.layersNew;k++)levels.push(h1+c.geometry.heightNew*k/c.mesh.layersNew);
    for(let k=0;k<levels.length-1;k++)for(let i=0;i<section.boundaryCount;i++){
      const a=section.xy[i],b=section.xy[(i+1)%section.boundaryCount];
      if((b[1]-a[1])-(b[0]-a[0])<=0)continue;
      const pts=[p(a,levels[k]),p(b,levels[k]),p(b,levels[k+1]),p(a,levels[k+1])];
      markup+=`<polygon points="${coord(pts)}" fill="${k<c.mesh.layersOld?'#c4cdd1':'#eab480'}" stroke="#6d7b7e" stroke-width=".4"/>`;
    }
    for(const q of section.quads)markup+=`<polygon points="${coord(q.map(i=>p(section.xy[i],H)))}" fill="#efbe90" stroke="#99754f" stroke-width=".4"/>`;
    const xLeft=52,base=263,top=263-H*scale,joint=263-h1*scale;
    markup+=`<path d="M${xLeft} ${top}V${base}M${xLeft-5} ${top}H${xLeft+5}M${xLeft-5} ${joint}H${xLeft+5}M${xLeft-5} ${base}H${xLeft+5}" stroke="#8a9aa5"/>`;
    markup+=svgText(xLeft-10,(top+joint)/2,format(c.geometry.heightNew,1)+' m','text-anchor="end" fill="#586f7e" font-size="12"');
    markup+=svgText(xLeft-10,(joint+base)/2,format(h1,1)+' m','text-anchor="end" fill="#586f7e" font-size="12"');
    markup+=svgText(317,top+22,'BETON BARU','fill="#a9632e" font-size="10" font-weight="700"');
    markup+=svgText(317,joint+25,'BETON LAMA','fill="#5b7180" font-size="10" font-weight="700"');
    $('mesh-side').innerHTML=markup;
  }
  function heatChart(){
    const w=620,h=260,L=58,R=18,T=18,B=40,end=config.schedule.end,ymax=Math.max(10,config.heat.K*1.12);
    const x=t=>L+t/end*(w-L-R),y=v=>h-B-v/ymax*(h-T-B);let markup='';
    for(let k=0;k<=4;k++){
      const v=ymax*k/4,yy=y(v);markup+=`<path d="M${L} ${yy}H${w-R}" stroke="#dfe7e9"/>`+
        svgText(L-10,yy+4,format(v,0),'text-anchor="end" fill="#74868f" font-size="11"');
    }
    for(let k=0;k<=5;k++){
      const t=end*k/5;markup+=svgText(x(t),h-17,format(t/24,1),'text-anchor="middle" fill="#74868f" font-size="11"');
    }
    const path=Array.from({length:181},(_,i)=>{const t=end*i/180;return `${i?'L':'M'}${x(t).toFixed(2)},${y(E.heatRise(config,t)).toFixed(2)}`;}).join('');
    markup+=`<path d="${path}L${x(end)},${h-B}L${L},${h-B}Z" fill="#f6e3d3"/><path d="${path}" fill="none" stroke="#c7793c" stroke-width="3"/>`;
    markup+=svgText(L,12,'ΔTad (°C)','fill="#6f818c" font-size="11"')+svgText(w-R,h-2,'Umur beton baru (hari)','text-anchor="end" fill="#6f818c" font-size="11"');
    $('heat-chart').innerHTML=markup;
  }
  function renderStages(){
    const s=config.schedule,items=E.stages(config),ages=[['Sebelum cor','Inisialisasi beton lama saja','Sisi + atas lama; dasar '+(config.boundary.baseMode==='fixed'?'suhu tetap':'adiabatik')],
      [`0 – ${format(s.strip/24,1)} hari`,'Aktifkan seluruh beton baru sekali','Bekisting + curing; konveksi sambungan dihentikan'],
      [`${format(s.strip/24,1)} – ${format(s.cure/24,1)} hari`,'Pertahankan seluruh beton','Ganti konveksi bekisting → udara'],
      [`${format(s.cure/24,1)} – ${format(s.end/24,1)} hari`,'Lanjutkan pendinginan','Ganti curing atas → udara; suhu tidak direset']];
    $('stage-table').innerHTML=items.map((s,i)=>`<tr><td><strong>${s.name}</strong><span>${s.label}</span></td><td>${ages[i][0]}</td><td>${ages[i][1]}</td><td>${ages[i][2]}</td></tr>`).join('');
    $('unit-table').innerHTML=E.units(config).map(r=>`<tr><td>${r[0]}</td><td>${format(r[1],3)}<small>${r[2]}</small></td><td><strong>${format(r[3],3)}</strong><small>${r[4]}</small></td></tr>`).join('');
  }
  function preview(c,checks){
    const s=E.stages(c),m=c.material,th=E.resolvedThermal(c),g=E.geometryInfo(c);
    const lines=['; RINGKASAN INPUT - unduhan MCT berisi seluruh node dan elemen.',
      '; Asumsi contoh, belum diuji dengan parser atau solver MIDAS Civil.',
      '*UNIT','N, M, KJ, C',
      `; Geometry shape=${g.shape}; X=${g.width}m; Y=${g.depth}m; height=${c.geometry.heightOld+c.geometry.heightNew}m.`,
      `; NODE=${E.estimate(c).nodes}; SOLID HEX8=${E.estimate(c).elements}; interface nodes=${checks.sharedInterfaceNodes}`,
      `; fc=${m.fc} MPa; E=${(4700*Math.sqrt(m.fc)*1e6).toFixed(3)} N/m2`,
      `; Metode cp=${th.cpMode}; k=${th.kMode}; old=${th.oldMode}; Tref=${th.referenceTemperature} degC`,
      '*MATERIAL',`1, CONC, FC_OLD, ${th.oldCpMct.toFixed(9)}, ${th.oldKMct.toFixed(9)}, , C, NO, 0.05, 2, ${(4700*Math.sqrt(m.fc)*1e6).toFixed(3)}, ${m.poisson}, ${m.expansion}, ${(m.density*9.80665).toFixed(3)}, 0`,
      `2, CONC, FC_NEW, ${th.cpMct.toFixed(9)}, ${th.kMct.toFixed(9)}, , C, NO, 0.05, 2, ${(4700*Math.sqrt(m.fc)*1e6).toFixed(3)}, ${m.poisson}, ${m.expansion}, ${(m.density*9.80665).toFixed(3)}, 0`,
      ...E.timeDependentCards(c),
      ...E.selfWeightCards(c),
      `*HYD-HEATSRCF`,`FUNC=NEW_ADIABATIC, USER, 1, YES`,
      '0, 0',`24, ${E.heatRise(c,24).toFixed(6)}`,`${c.schedule.end}, ${E.heatRise(c,c.schedule.end).toFixed(6)}`,
      '; Unduhan menyertakan tabel panas lengkap dan kurva OLD_ZERO.',
      `; Dasar termal: ${c.boundary.baseMode==='fixed'?`${c.temperature.base} degC tetap`:'adiabatik / fluks nol'}`,'*HYD-STAGE'];
    for(const t of s){lines.push(`NAME=${t.name}, ${t.temp===null?'NO, 0':`YES, ${t.temp}`}`);
      lines.push('; '+t.steps.length+' waktu lokal, akhir '+t.steps[t.steps.length-1]+' jam');
      for(const [field,key]of [['AELEM','ae'],['ABNDR','ab'],['DBNDR','db']])if(t[key].length)lines.push(field+'='+t[key].join(', '));
      for(const group of t.al)lines.push('ALOAD='+group+', 0');}
    lines.push('*HYD-CTRL',E.hydrationControl(c));
    $('mct-preview').value=lines.join('\n');
  }
  function renderThermal(){
    const t=config.thermal,cpManual=document.querySelector('[data-key="material.cp"]'),kManual=document.querySelector('[data-key="material.conductivity"]');
    cpManual.disabled=t.cpMode!=='manual';kManual.disabled=t.kMode!=='manual';
    $('thermal-old-properties').hidden=t.oldMode!=='manual';
    for(const key of ['oldCp','oldK'])document.querySelector('[data-key="thermal.'+key+'"]').disabled=t.oldMode!=='manual';
    const outputs=['thermal-cp-active','thermal-k-active','thermal-spheat','thermal-heatco','thermal-cvol','thermal-diffusivity','thermal-old-cp-active','thermal-old-k-active','thermal-volume-sum','thermal-k-bounds'];
    try{
      const r=E.resolvedThermal(config);
      for(const [id,value,d]of [['thermal-cp-active',r.cp,6],['thermal-k-active',r.k,6],['thermal-spheat',r.cpMct,6],['thermal-heatco',r.kMct,6],['thermal-cvol',r.cv,3],
        ['thermal-old-cp-active',r.oldCp,6],['thermal-old-k-active',r.oldK,6],['thermal-volume-sum',r.sumVolume,6]])$(id).textContent=format(value,d);
      $('thermal-diffusivity').textContent=Number.isFinite(r.diffusivity)?r.diffusivity.toExponential(4).replace('.',','):'—';
      $('thermal-k-bounds').textContent=format(r.series,6)+' – '+format(r.parallel,6);
      const cpFormula={manual:'cₚ = input manual',mixture:'cₚ = Σ(mᵢ cₚ,ᵢ) / Σmᵢ',ec2_dry:'cₚ = fungsi beton kering EC2(Tref) / 1000 → kJ/kg·°C'};
      const kFormula={manual:'k = input manual',series:'k = 1 / Σ(vᵢ / kᵢ)',parallel:'k = Σ(vᵢ kᵢ)',geometric:'k = exp[Σ(vᵢ ln kᵢ)]',
        ec2_lower:'k = 1,36 − 0,136(T/100) + 0,0057(T/100)²',ec2_upper:'k = 2 − 0,2451(T/100) + 0,0107(T/100)²'};
      $('thermal-formula-cp').textContent=cpFormula[t.cpMode];$('thermal-formula-k').textContent=kFormula[t.kMode];
      const modeCp=t.cpMode==='manual'?'cₚ manual':t.cpMode==='mixture'?'cₚ campuran':'cₚ acuan EC2';
      const modeK=t.kMode==='manual'?'k manual':t.kMode.startsWith('ec2_')?'k acuan EC2':'k komposit '+t.kMode;
      const energy='Dengan K tetap '+format(config.heat.K,1)+'°C, energi asimtotik yang tersirat = '+format(r.heatInfinity,1)+' kJ/m³. Mengubah cₚ juga mengubah energi kurva adiabatik.';
      $('thermal-method-note').textContent=modeCp+'; '+modeK+'. '+energy+' '+r.warnings.join(' ');
      for(const row of r.rows){$('thermal-mass-'+row.id).textContent=format(row.mass,3);$('thermal-volume-'+row.id).textContent=format(row.fraction*100,3)+'%';}
    }catch(error){
      outputs.forEach(id=>$(id).textContent='—');$('thermal-method-note').textContent=error.message;
      $('thermal-formula-cp').textContent='Periksa metode dan nilai masukan.';$('thermal-formula-k').textContent='Perhitungan belum tersedia.';
      for(const [phase]of window.HydrationThermal.phases){$('thermal-mass-'+phase).textContent=format(config.mix[phase],3);$('thermal-volume-'+phase).textContent='—';}
    }
  }
  function renderTimeDependent(){
    const t=config.timeDependent,on=t.enabled==='yes';
    const input=key=>fields.find(f=>f.dataset.key==='timeDependent.'+key);
    fields.filter(f=>f.dataset.key.startsWith('timeDependent.')).forEach(f=>{f.disabled=!on&&f!==input('enabled');});
    function panel(id,show){
      $(id).hidden=!show;
      $(id).querySelectorAll('[data-key]').forEach(f=>{f.disabled=!on||!show;});
    }
    const aci=t.creepModel==='ACI',ceb=t.creepModel==='CEB1990',aashto=t.creepModel==='AASHTO2006',user=t.creepModel==='USER';
    panel('td-cs-common',!user);panel('td-cs-ceb',ceb);panel('td-cs-volume',aci||aashto);
    panel('td-cs-aci',aci);panel('td-aci-ultimate',aci&&t.aciUltimate==='USER');panel('td-cs-user',user);
    panel('td-strength-aci',aci||t.strengthModel==='ACI'||t.strengthModel==='AASHTO');
    panel('td-strength-user',t.strengthModel==='USER');$('td-aashto-note').hidden=t.strengthModel!=='AASHTO';
    input('aashtoExposed').disabled=!on||!aashto;
    input('cementType').disabled=!on||!(ceb||t.strengthModel==='CEB1990');
    for(const key of ['aciCuring','aciMixSource','aciSlump','aciFineAggregate','aciAir'])input(key).disabled=!on||!aci||t.aciUltimate!=='CODE';
    input('aciCementContent').disabled=!on||!aci||t.aciUltimate!=='CODE'||t.aciMixSource!=='manual';
    input('strengthScale').disabled=!on||t.strengthModel!=='USER';
    input('cebMeanOffset').disabled=!on||t.strengthModel!=='CEB1990';
    input('creepReferenceModulus').disabled=!on||!user||t.creepModulusSource!=='user';
    $('td-use-geometry').disabled=!on||user;
    $('td-status').textContent=on?'Aktif':'Nonaktif';
    $('td-fc28').textContent=format(config.material.fc,2)+' MPa';
    const table=$('td-strength-table');table.replaceChildren();
    try{
      const r=E.timeDependent(config);
      $('td-cs-label').textContent=r.creepLabel;
      $('td-strength-label').textContent=r.strengthLabel;
      $('td-cement-active').textContent=format(r.aciCement,2)+' kg/m³';
      for(const link of r.links){
        const names=[link.creep?link.creepName:'',link.strength?link.strengthName:''].filter(Boolean);
        $(link.material===1?'td-link-old':'td-link-new').textContent=on&&names.length?names.join(' / '):'Tidak ada';
      }
      const curve=on?r.strengthCurve:[];
      const shown=curve.length>14?curve.filter((_,i)=>i===0||i===curve.length-1||i%Math.ceil(curve.length/12)===0):curve;
      for(const point of shown){
        const row=document.createElement('tr');
        for(const value of [point.day,point.fc,point.tensile,point.elastic]){const cell=document.createElement('td');cell.textContent=value===null?'—':format(value,3);row.append(cell);}
        table.append(row);
      }
      const basis=r.strengthBasis==='user'?'Tabel USER: fc, ft dan E mengikuti data masukan; skala hanya berlaku pada E. ':r.strengthBasis==='mean'?'Kurva fcm (rata-rata); acuan 28 hari '+format(r.strength28,2)+' MPa. ':'Acuan kuat tekan 28 hari '+format(r.strength28??r.fc28,2)+' MPa. ';
      $('td-strength-note').textContent=on?basis+'Kurva ini input material, bukan hasil analisis suhu atau tegangan.':'Material bergantung waktu nonaktif; definisi dan link tidak diekspor.';
      const count=r.creepCurves.reduce((sum,item)=>sum+item.points.length,0);
      $('td-creep-note').textContent=user?`${r.creepCurves.length} umur pembebanan, ${count} titik creep, dan ${r.shrinkageCurve.length} titik shrinkage USER. Data akan dikonversi ke satuan MCT.`:'Kurva C&S kode dihitung oleh MIDAS dari parameter yang diekspor; aplikasi tidak menggambar pendekatan yang berbeda dari solver.';
      const referenceE=r.creepE??(t.creepModulusSource==='user'?t.creepReferenceModulus:4700*Math.sqrt(config.material.fc));
      $('td-creep-reference').textContent='Modulus acuan creep USER = '+format(referenceE,3)+' MPa. Nilai ini mengubah koefisien φ menjadi specific creep pada fungsi MCT; samakan dengan basis pengujian jobmix.';
      const active=r.links.filter(l=>l.creep||l.strength).length;
      $('td-export-note').textContent=on?`${active} dari 2 material memiliki link terpilih. Definisi fungsi dan link ditulis bersama di MCT; periksa hasil impor pada versi MIDAS Anda.`:'Definisi dan link material bergantung waktu tidak disertakan dalam ekspor ini.';
      renderStrengthCurve(curve);
    }catch(error){
      $('td-strength-note').textContent=error.message;$('td-cs-label').textContent='Periksa parameter';$('td-strength-label').textContent='Periksa parameter';
      $('td-link-old').textContent='Periksa masukan';$('td-link-new').textContent='Periksa masukan';renderStrengthCurve([]);
    }
  }
  function renderStrengthCurve(points){
    const svg=$('td-strength-chart'),W=620,H=250,L=58,R=20,T=22,B=42;
    const data=points.filter(p=>Number.isFinite(p.day)&&Number.isFinite(p.fc)&&p.day>=0);
    if(!data.length){svg.innerHTML=svgText(W/2,H/2,'Kurva belum tersedia','text-anchor="middle" fill="#7a8d9c" font-size="13"');return;}
    const last=Math.max(1,...data.map(p=>p.day)),top=Math.max(1,...data.map(p=>p.fc))*1.1;
    const x=day=>L+Math.log1p(day)/Math.log1p(last)*(W-L-R),y=fc=>H-B-fc/top*(H-T-B);
    let markup='';
    for(let i=0;i<=4;i++){const v=top*i/4;markup+=`<path d="M${L} ${y(v)}H${W-R}" stroke="#e2eaf0"/>`+svgText(L-9,y(v)+4,format(v,1),'text-anchor="end" fill="#74868f" font-size="11"');}
    for(const day of [0,1,7,28,90,365,3650,36500].filter(d=>d<=last))markup+=svgText(x(day),H-19,format(day,0),'text-anchor="middle" fill="#74868f" font-size="10"');
    const line=data.map((p,i)=>`${i?'L':'M'}${x(p.day).toFixed(2)},${y(p.fc).toFixed(2)}`).join('');
    markup+=`<path d="${line}" fill="none" stroke="#407da2" stroke-width="2.6"/>`;
    markup+=svgText(L,13,'fc (MPa)','fill="#6f818c" font-size="11"')+svgText(W-R,H-3,'Umur (hari) · skala log(1+t)','text-anchor="end" fill="#6f818c" font-size="11"');
    svg.innerHTML=markup;
  }
  function messages(validation,checks){
    const list=$('validation-list');list.replaceChildren();
    const add=(text,kind)=>{const li=document.createElement('li');li.className=kind;const badge=document.createElement('span');badge.textContent=kind==='valid'?'✓':kind==='invalid'?'!':'i';const content=document.createElement('span');content.textContent=text;li.append(badge,content);list.append(li);};
    validation.errors.forEach(x=>{
      const field=fields.find(f=>f.dataset.key===x.field);
      const label=field && field.closest('label');
      const name=label && label.querySelector('span');
      const text=name?x.message.replace(x.field+':',name.textContent+':'):x.message;
      add(text,'invalid');
    });
    if(checks){add('Mesh terhubung; Jacobian positif. Min. scaled Jacobian '+format(checks.minScaled,3)+'.','valid');
      add(integer(checks.sharedInterfaceNodes)+' node bersama pada sambungan. Beton lama dipertahankan saat beton baru aktif.','valid');
      add('Rentang rusuk '+format(checks.minEdge,3)+'–'+format(checks.maxEdge,3)+' m; defisit volume poligon '+format(checks.volumeDeficitPercent,3)+'%.','valid');}
    validation.warnings.forEach(x=>add(x.message,'notice'));
    $('validation-summary').textContent=validation.errors.length?validation.errors.length+' perlu diperbaiki':'Input dapat diekspor';
    $('validation-summary').classList.toggle('has-error',!!validation.errors.length);
  }
  const convectionStatus={reference:'Dalam acuan',review:'Tinjau kondisi',adiabatic:'Adiabatik ideal',invalid:'Perbaiki nilai',custom:'Dasar proyek'};
  function renderConvectionGuidance(){
    const table=$('convection-guide-table');table.replaceChildren();
    try{
      const guide=E.convectionGuidance(config);
      $('convection-range-note').textContent=`Batas masukan aplikasi: ${guide.limit.min}–${guide.limit.max} W/(m²·°C). ${guide.note}`;
      for(const item of guide.items){
        const status=Object.hasOwn(convectionStatus,item.status)?item.status:'custom';
        const help=$('convection-help-'+item.key),row=document.createElement('tr');
        help.textContent=(item.rangeLabel||'Bergantung kondisi konstruksi')+' · '+convectionStatus[status];help.dataset.status=status;
        row.dataset.key=item.key;row.dataset.status=status;
        const cells=[item.label,format(item.value,2),format(item.mctValue,2),item.rangeLabel||'Bergantung kondisi konstruksi'];
        const captions=['Permukaan','h · W/(m²·°C)','MCT · kJ/(m²·jam·°C)','Rentang / kriteria acuan'];
        for(const [i,text] of cells.entries()){const cell=document.createElement('td');cell.textContent=text;cell.dataset.label=captions[i];row.append(cell);}
        const detail=document.createElement('td'),badge=document.createElement('strong'),message=document.createElement('span'),instruction=document.createElement('p'),basis=document.createElement('small');
        badge.className='convection-status';badge.textContent=convectionStatus[status];
        message.textContent=item.message||'';instruction.textContent=item.instruction||'';basis.textContent='Dasar: '+(item.basis||'Data kondisi proyek diperlukan.');
        detail.append(badge,message,instruction,basis);row.append(detail);table.append(row);
      }
    }catch(error){$('convection-range-note').textContent='Panduan konveksi belum tersedia: '+error.message;}
  }
  function renderGeometry(){
    const rect=config.geometry.shape==='rectangular';
    document.querySelectorAll('[data-geometry-shape]').forEach(group=>{
      group.hidden=group.dataset.geometryShape!==(rect?'rectangular':'circular');
      group.querySelectorAll('[data-key]').forEach(field=>{field.disabled=group.hidden;});
    });
    $('geometry-shape-label').textContent=rect?'Penampang rectangular solid':'Penampang lingkaran solid';
    $('geometry-mesh-note').textContent=rect?'Mesh rectangular terstruktur X × Y dengan elemen HEX8. Kedua segmen berbagi node pada sambungan.':'Mesh lingkaran memakai 5 blok HEX8. Kedua segmen berbagi node pada sambungan.';
    $('geometry-document-subtitle').textContent=rect?'Pilar rectangular dua tahap / hydration input':'Pilar lingkaran dua tahap / hydration input';
    $('geometry-view-title').textContent=rect?'Pilar rectangular dua tahap':'Pilar lingkaran dua tahap';
    $('td-use-geometry').textContent=rect?'Isi ukuran dari penampang rectangular':'Isi ukuran dari diameter pilar';
    $('td-geometry-formula').textContent=rect?'h = B·L/(B+L) dan V/S = B·L/[2(B+L)] untuk penampang rectangular prismatis dengan paparan sisi saja; muka ujung diabaikan.':'h = D/2 dan V/S = D/4 untuk silinder prismatis dengan paparan sisi saja; muka ujung diabaikan.';
  }
  function render(){
    config=read();lastModel=null;const result=E.validate(config);
    fields.forEach(el=>{const bad=result.errors.some(e=>e.field===el.dataset.key);el.setAttribute('aria-invalid',String(bad));});
    $('export-mct').disabled=!!result.errors.length;$('export-json').disabled=!!result.errors.length;$('download-report').disabled=!!result.errors.length;
    const fixed=config.boundary.baseMode==='fixed';document.querySelector('[data-key="temperature.base"]').disabled=!fixed;
    renderGeometry();renderThermal();renderTimeDependent();renderConvectionGuidance();
    const mix=E.mixMetrics(config),stats=E.estimate(config);
    for(const [id,value,digits]of [['metrics-nodes',stats.nodes,0],['metrics-elements',stats.elements,0],['metrics-volume',stats.volume,2],['metrics-wb',mix.wb,3],
      ['mix-wc',mix.wc,3],['mix-wb',mix.wb,3],['mix-binder',mix.binder,1],['mix-total',mix.total,2],['mix-flyash',mix.flyash,1]])$(id).textContent=format(value,digits);
    for(const [id,value]of [['mix-batch-water',mix.batchWater],['mix-batch-sand',mix.batchSand],['mix-batch-gravel',mix.batchGravel]])$(id).textContent=format(value,3)+' kg';
    let checks;
    if(!result.errors.length){
      try{const section=E.crossSection(config);checks=E.auditCross(section,config);
        if(checks.maxRatio>5)result.warnings.push({message:'Rasio rusuk maksimum '+format(checks.maxRatio,1)+' melebihi 5. Sesuaikan pembagian '+(config.geometry.shape==='rectangular'?'X/Y/vertikal':'radial/vertikal')+' untuk memperbaiki bentuk elemen.'});
        plan(section);side(section);heatChart();renderStages();preview(config,checks);persist(config);}
      catch(error){result.errors.push({message:error.message});$('export-mct').disabled=true;$('download-report').disabled=true;}
    }else{$('save-status').textContent='Perubahan belum disimpan';$('mct-preview').value='Perbaiki masukan yang ditandai sebelum mengekspor file .MCT.';}
    messages(result,checks);projectStatus(config);
  }
  function notify(message){$('export-status').textContent=message;}
  function download(name,text,type='application/octet-stream'){
    const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function snapshot(){return {schema:'civil-heat-studio/v1',created_at:new Date().toISOString(),config:structuredClone(config),reference,thermal_calculation:E.resolvedThermal(config),time_dependent_calculation:E.timeDependent(config),convection_guidance:E.convectionGuidance(config),
    status:{assumptions:true,native_midas_tested:false,journal_validated:false}};}
  fields.forEach(el=>el.addEventListener('input',()=>{projectStatus();clearTimeout(timer);timer=setTimeout(render,160);}));
  fields.filter(el=>el.tagName==='SELECT').forEach(el=>el.addEventListener('change',()=>{clearTimeout(timer);render();}));
  $('use-mix-density').addEventListener('click',()=>{config=read();const sum=E.mixMetrics(config).total;if(!Number.isFinite(sum))return;
    document.querySelector('[data-key="material.density"]').value=sum.toFixed(2);clearTimeout(timer);render();notify('Massa jenis diisi dari jumlah massa campuran. Ini perkiraan, bukan hasil pengukuran massa jenis.');});
  $('td-use-geometry').addEventListener('click',()=>{
    const g=E.geometryInfo(read());if(!Number.isFinite(g.area)||g.area<=0||!Number.isFinite(g.perimeter)||g.perimeter<=0)return;
    document.querySelector('[data-key="timeDependent.notionalSize"]').value=g.notionalSize;
    document.querySelector('[data-key="timeDependent.volumeSurface"]').value=g.volumeSurface;
    clearTimeout(timer);render();notify(g.shape==='rectangular'?'Ukuran C&S diisi dari rectangular: h = B·L/(B+L), V/S = B·L/[2(B+L)]. Asumsi paparan sisi saja; muka ujung diabaikan.':'Ukuran C&S diisi dari diameter: h = D/2 dan V/S = D/4. Asumsi paparan sisi silinder saja; muka ujung diabaikan.');
  });
  $('export-mct').addEventListener('click',async()=>{
    clearTimeout(timer);render();if($('export-mct').disabled){notify('Masukan belum valid. Periksa daftar pemeriksaan.');return;}
    const captured=structuredClone(config);$('export-mct').disabled=true;notify('Menyusun mesh solid dan memeriksa batas aktif…');
    await new Promise(resolve=>setTimeout(resolve,30));
    try{const model=E.build(captured);lastModel=model;download(model.filename,model.text);
      notify('File '+model.filename+' diunduh: '+integer(model.stats.nodes)+' node, '+integer(model.stats.elements)+' elemen. Impor/solver MIDAS belum diuji.');}
    catch(error){notify('Ekspor belum berhasil: '+error.message);}
    finally{$('export-mct').disabled=!!E.validate(read()).errors.length;}
  });
  async function saveProject(saveAs=false){
    if(saveBusy)return false;
    clearTimeout(timer);render();if(E.validate(config).errors.length){notify('Perbaiki input yang ditandai sebelum menyimpan proyek.');return false;}
    if(!desktop){download('PARAMETER_HEAT_HYDRATION.json',JSON.stringify(snapshot(),null,2),'application/json');notify('Parameter disimpan sebagai JSON.');return true;}
    const captured=JSON.stringify(config),text=JSON.stringify(snapshot(),null,2);
    saveBusy=true;projectStatus();
    try{
      const result=await desktop.saveProject(text,saveAs);
      if(result.status==='cancelled'){notify('Penyimpanan dibatalkan. File aktif tetap sama.');return false;}
      if(result.status!=='saved')throw Error(result.message||'File belum berhasil disimpan.');
      savedFingerprint=captured;projectName=result.name;projectPath=result.filePath||'';
      const unchanged=JSON.stringify(read())===captured;
      notify(unchanged?'Proyek '+projectName+' berhasil disimpan.':'Versi proyek tersimpan; perubahan terbaru masih perlu disimpan.');
      return unchanged;
    }catch(error){notify('Proyek belum disimpan: '+error.message);return false;}
    finally{saveBusy=false;render();}
  }
  async function openProject(){
    if(!desktop){$('import-file').click();return;}
    if(openBusy||saveBusy)return;
    openBusy=true;projectStatus();
    try{
      const result=await desktop.openProject();
      if(result.status==='cancelled')return;
      if(result.status!=='opened')throw Error(result.message||'File belum berhasil dibuka.');
      const next=E.cleanConfig(JSON.parse(result.text)),valid=E.validate(next);
      if(valid.errors.length)throw Error(valid.errors[0].message);
      savedFingerprint=JSON.stringify(next);projectName=result.name;projectPath=result.filePath||'';
      fill(next);clearTimeout(timer);render();notify('Proyek '+projectName+' berhasil dimuat. Save akan memperbarui file ini.');
    }catch(error){notify('JSON tidak dimuat: '+error.message+' Parameter sebelumnya dipertahankan.');}
    finally{openBusy=false;projectStatus();}
  }
  $('export-json').addEventListener('click',()=>{void saveProject();});
  $('save-as').addEventListener('click',()=>{void saveProject(true);});
  $('import-json').addEventListener('click',()=>{void openProject();});
  if(desktop){
    $('save-as').hidden=false;
    $('export-json').title='Save — simpan perubahan ke file proyek aktif (Ctrl+S)';
    $('export-json').querySelector('span').textContent='Save';
    $('import-json').title='Buka proyek JSON (Ctrl+O)';
    window.CivilHydrationProject=Object.freeze({save:()=>saveProject()});
  }
  $('import-file').addEventListener('change',async event=>{
    if(desktop){event.target.value='';return;}
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>1024*1024)throw Error('Ukuran JSON maksimum 1 MB.');const next=E.cleanConfig(JSON.parse(await file.text()));const valid=E.validate(next);
      if(valid.errors.length)throw Error(valid.errors[0].message);fill(next);render();notify('Parameter JSON berhasil dimuat.');}
    catch(error){notify('JSON tidak dimuat: '+error.message+' Parameter sebelumnya dipertahankan.');}
    event.target.value='';
  });
  $('reset-defaults').addEventListener('click',()=>{if(!window.confirm('Kembalikan semua parameter ke contoh foto dan pilar 7,5 m? Simpan JSON untuk mempertahankan pekerjaan saat ini.'))return;
    fill(E.defaults());render();notify('Parameter kembali ke contoh awal.');});
  $('download-report').addEventListener('click',()=>{
    clearTimeout(timer);render();if(E.validate(config).errors.length)return;
    try{const model=lastModel||E.build(config),mix=E.mixMetrics(config),s=config.schedule,thermal=model.thermal,g=E.geometryInfo(config);
      const rows=['RINGKASAN INPUT PANAS HIDRASI - CIVIL HYDRATION','Asumsi contoh; bukan hasil analisis suhu/tegangan.',
        'Waktu pembuatan: '+new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB','',
        'SATUAN MCT: N, m, kJ, degC; waktu jam, massa kg.',
        `MODEL: ${g.shape==='rectangular'?`rectangular; lebar B(X)=${g.width} m; panjang L(Y)=${g.depth} m`:`lingkaran; diameter ${g.width} m`}; beton lama ${config.geometry.heightOld} m; baru ${config.geometry.heightNew} m.`,
        `PENAMPANG: luas=${g.area}m2; keliling=${g.perimeter}m; mesh ${g.shape==='rectangular'?`X=${config.mesh.divX}, Y=${config.mesh.divY}`:`sisi=${config.mesh.sideDiv}, radial=${config.mesh.radialDiv}`}.`,
        `MESH: ${model.stats.nodes} node, ${model.stats.elements} HEX8; interface ${model.mesh.nn} node bersama.`,
        `Mesh volume=${model.checks.volume}m3, scaled Jacobian min=${model.checks.minScaled}.`,
        '',`BERAT SENDIRI: ${config.selfWeight.caseName}; tipe Dead Load (${config.selfWeight.caseType}); grup ${config.selfWeight.groupName}.`,
        `Faktor global X, Y, Z = ${config.selfWeight.factorX}, ${config.selfWeight.factorY}, ${config.selfWeight.factorZ} (tanpa satuan).`,
        `Berat isi material = ${config.material.density*9.80665} N/m3; rho = ${config.material.density} kg/m3; g = 9.80665 m/s2.`,
        `Grup ${config.selfWeight.groupName} aktif pada H0 waktu lokal 0 dan dipertahankan saat beton baru aktif pada H1.`,
        'Berat sendiri otomatis HYD-CTRL nonaktif; SW diterapkan melalui grup beban agar tidak dihitung ganda.',
        '',`CAMPURAN: binder ${mix.binder} kg/m3; w/c=${mix.wc}; w/b=${mix.wb}; fly ash ${mix.flyash}%.`,
        `Total massa bahan ${mix.total} kg/m3; density termal terpisah ${config.material.density} kg/m3.`,
        `Batch ${config.mix.batchVolume}m3: air ditambah ${mix.batchWater}kg, pasir basah ${mix.batchSand}kg, agregat basah ${mix.batchGravel}kg.`,
        'Koreksi batch mengasumsikan air bebas terhadap SSD; absorpsi belum tersedia.',
        '',`SUMBER: DeltaTad(t)=K*(1-exp(-a*t/24)), t jam, K=${config.heat.K}degC, a=${config.heat.alpha}/hari.`,
        `Energi asimtotik=${thermal.heatInfinity} kJ/m3; bukan suhu pilar.`,
        `Beton lama panas nol; awal ${config.temperature.old}degC asumsi; suhu cor ${config.temperature.pour}degC.`,
        `DASAR TERMAL: ${config.boundary.baseMode}; tumpuan translasi dasar tetap (idealisasi mekanis).`,
        '','TAHAP:'];
      model.stages.forEach(t=>rows.push(`${t.name}: global ${t.globalStart}-${t.globalEnd}jam; umur baru ${t.newAgeStart}-${t.newAgeEnd}jam; elemen aktif ${t.activeElements}; muka konveksi ${t.convectionFaces}; grup beban aktif ${t.activeLoadGroups.join(', ')}.`));
      const convection=E.convectionGuidance(config);
      rows.push('','CONVECTION BOUNDARIES / KRITERIA RANGE DAN PETUNJUK:',
        `Batas masukan aplikasi ${convection.limit.min}–${convection.limit.max} W/(m2·degC); batas ini berbeda dari rentang acuan fisik.`,convection.note);
      for(const item of convection.items)rows.push(
        `${item.label}: h=${item.value} W/(m2·degC) -> ${item.value*3.6} kJ/(m2·jam·degC); acuan=${item.rangeLabel||'bergantung kondisi konstruksi'}; status=${convectionStatus[item.status]||item.status}.`,
        item.message||'',`Petunjuk: ${item.instruction||''}`,`Dasar: ${item.basis||''}`);
      rows.push('Radiasi, penguapan, dan elemen bekisting terpisah belum dihitung otomatis. Kalibrasi atau uji sensitivitas sesuai kondisi lapangan.','RUJUKAN KONVEKSI:');
      convection.sources.forEach(source=>rows.push(`${source.title}\n${source.url}`));
      const td=E.timeDependent(config),p=config.timeDependent;
      rows.push('','MATERIAL BERGANTUNG WAKTU / TIME DEPENDENT MATERIAL:',
        `Status=${td.enabled?'aktif':'nonaktif'}; C&S=${td.creepLabel}; compression strength=${td.strengthLabel}.`,
        `fck,28 material dasar=${config.material.fc} MPa; acuan ini bukan hasil uji jobmix terukur.`,
        td.strengthBasis==='user'?'Compression strength USER: fc dan ft mengikuti tabel; faktor skala hanya mengalikan E.':`Basis kurva kekuatan=${td.strengthBasis}; acuan 28 hari=${td.strength28} MPa.`,
        'Umur fungsi C&S/kekuatan dalam hari; waktu tahap hidrasi dalam jam.');
      if(td.enabled){
        const activeKeys=['creepModel','strengthModel','csMode','iterations','tolerance'];
        if(p.creepModel!=='USER')activeKeys.push('humidity','shrinkageAge');
        if(p.creepModel==='CEB1990')activeKeys.push('notionalSize','cementType');
        if(p.creepModel==='ACI'||p.creepModel==='AASHTO2006')activeKeys.push('volumeSurface');
        if(p.creepModel==='ACI')activeKeys.push('aciUltimate',...(p.aciUltimate==='CODE'?['aciCuring','aciMixSource','aciSlump','aciFineAggregate','aciAir']:['ultimateCreep','ultimateShrinkage']));
        if(p.creepModel==='AASHTO2006')activeKeys.push('aashtoExposed');
        if(p.strengthModel==='CEB1990')activeKeys.push('cementType','cebMeanOffset');
        if(p.creepModel==='ACI'||['ACI','AASHTO'].includes(p.strengthModel))activeKeys.push('aciA','aciB');
        if(p.strengthModel==='USER')activeKeys.push('strengthScale');
        for(const key of new Set(activeKeys)){
          const field=fields.find(f=>f.dataset.key==='timeDependent.'+key),label=field?.closest('label')?.querySelector('span')?.textContent||key;
          rows.push(`${label} [${key}] = ${p[key]}`);
        }
        if(p.creepModel==='ACI'&&p.aciUltimate==='CODE')rows.push(`Kandungan semen ACI aktif=${td.aciCement} kg/m3; sumber=${p.aciMixSource}.`);
        if(p.creepModel==='USER')rows.push(`Modulus acuan creep USER=${td.creepE} MPa; sumber=${p.creepModulusSource}; specific creep dikonversi dengan modulus acuan ini.`,
          'CREEP USER CSV: umur pembebanan(hari), waktu sejak beban(hari), phi',p.customCreep,
          'SHRINKAGE USER CSV: umur(hari), shrinkage positif(microstrain)',p.customShrinkage);
        if(p.strengthModel==='USER')rows.push('COMPRESSION STRENGTH USER CSV: umur(hari), fc(MPa), ft(MPa), E(MPa)',p.customStrength);
        if(p.strengthModel==='AASHTO')rows.push('AASHTO tidak mendefinisikan kurva kuat tekan terhadap umur; pilihan ini memakai ACI209R-92 mengikuti konvensi WSDOT.');
      }
      rows.push('','TIME DEPENDENT MATERIAL LINK:');
      td.links.forEach(link=>rows.push(`Material ${link.material} ${link.name}: C&S=${td.enabled&&link.creep?link.creepName:'tidak dihubungkan'}; compression strength=${td.enabled&&link.strength?link.strengthName:'tidak dihubungkan'}.`));
      rows.push('Link beton lama tidak merekonstruksi umur matang atau riwayat tegangan sebelum analisis.');
      if(td.enabled)rows.push('','KARTU MATERIAL BERGANTUNG WAKTU MCT:',...E.timeDependentCards(config));
      rows.push('','RUJUKAN MATERIAL BERGANTUNG WAKTU:');
      td.references.forEach(source=>rows.push(`${source.id}: ${source.title}\n${source.url}`));
      rows.push('','PERHITUNGAN MATERIAL TERMAL:',
        `Metode cp=${thermal.cpMode}; k=${thermal.kMode}; Tref=${thermal.referenceTemperature}degC; material lama=${thermal.oldMode}.`,
        `Beton baru: cp=${thermal.cp}kJ/kgC; k=${thermal.k}W/mC; SPHEAT=${thermal.cpMct}; HEATCO=${thermal.kMct}.`,
        `Beton lama: cp=${thermal.oldCp}kJ/kgC; k=${thermal.oldK}W/mC; SPHEAT=${thermal.oldCpMct}; HEATCO=${thermal.oldKMct}.`,
        `Cp_mix=Sigma(mi*cpi)/Sigma(mi)=${thermal.mixtureCp}; Vsum=${thermal.sumVolume}m3; volume dinormalisasi tanpa mengarang udara.`,
        `k_series/geometric/parallel=${thermal.series}/${thermal.geometric}/${thermal.parallel}W/mC.`,
        `Cv=${thermal.cv}kJ/m3C; diffusivity=${thermal.diffusivity}m2/s.`,
        'Properti fase adalah asumsi editable, bukan parameter campuran terukur. EC2 adalah acuan beton mengeras untuk kebakaran; MCT mengekspor konstanta.',...thermal.warnings);
      for(const phase of thermal.rows)rows.push(`${phase.label}: m=${phase.mass}; rho=${phase.density}; cp=${phase.cp}; k=${phase.k}; v_normalized=${phase.fraction}.`);
      rows.push('','SUMBER METODE:');for(const source of thermal.sources)rows.push(`${source.id}: ${source.title}\n${source.url}\n${source.scope}`);
      rows.push('','KONVERSI TERMAL:');model.units.forEach(r=>rows.push(`${r[0]}: ${r[1]} ${r[2]} -> ${r[3]} ${r[4]}`));
      rows.push('','MONITOR:');model.monitors.forEach(n=>rows.push(`${n.name}: node ${n.id}; X,Y,Z=${n.coordinates.join(', ')}m (node terdekat target).`));
      rows.push('','VERIFIKASI NATIVE MASIH DIPERLUKAN:',
        'Periksa rilis Civil, suhu awal hanya pada elemen baru, kontinuitas umur sumber panas, neraca energi, serta konvergensi mesh/waktu.',
        'Belum mengkalibrasi creep/susut, E(t), kuat tarik, riwayat tegangan dan batas mekanis aktual; bukan penilaian retak.',
        'REFERENSI INPUT: https://github.com/MIDASIT-Co-Ltd/midas-civil-python/blob/main/examples/python/Tut7%20Heat%20of%20Hydration.py',
        'IMPOR MCT CIVIL NX: https://github.com/MIDASIT-Co-Ltd/midas-civil-python/blob/main/midas_civil/_model.py#L797',
        'SINTAKS KLASIK: https://github.com/TimmyTran22/Midas/blob/main/generateMct2.py',
        'Verifikasi jurnal belum dilakukan; parameter bukan angka yang diklaim berasal dari jurnal tertentu.','',JSON.stringify(snapshot(),null,2));
      download('RINGKASAN_INPUT_HIDRASI.txt',rows.join('\r\n'),'text/plain;charset=utf-8');notify('Ringkasan input dan parameter berhasil diunduh.');
    }catch(error){notify('Ringkasan belum dibuat: '+error.message);}
  });
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)document.querySelectorAll('.section-nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id));},{rootMargin:'-15% 0px -65% 0px'});
    document.querySelectorAll('.app-section').forEach(s=>observer.observe(s));
  }
  render();if(loaded)notify(desktop?'Parameter lokal dipulihkan. Buka proyek JSON untuk melanjutkan file atau gunakan Save As untuk menyimpan salinan.':'Parameter pekerjaan sebelumnya dimuat dari browser ini.');
  if(!saveAvailable&&!desktop)$('save-status').textContent='Gunakan JSON untuk menyimpan';
})();
