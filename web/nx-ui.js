/* Workspace navigation and real viewport controls; independent of MIDAS itself. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id),panes=[...document.querySelectorAll('.nx-pane')];
  const labels={model:'Model',campuran:'Mix Design','material-waktu':'Material Time',termal:'Heat of Hydration',tahapan:'Construction Stage',ekspor:'Check & Export'};
  let lastValidation='',lastExport='';
  function log(type,message){
    const line=document.createElement('p'),time=document.createElement('time'),tag=document.createElement('b'),text=document.createElement('span');
    time.textContent=new Date().toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour12:false});
    tag.textContent=type;text.textContent=message;line.append(time,tag,text);$('nx-console').append(line);
    while($('nx-console').children.length>7)$('nx-console').firstElementChild.remove();
    $('nx-console').scrollTop=$('nx-console').scrollHeight;
  }
  function select(name,updateHash=true){
    if(!Object.hasOwn(labels,name))name='model';
    panes.forEach(p=>p.hidden=p.id!==name);
    document.querySelectorAll('[data-workspace]').forEach(b=>{
      const selected=b.dataset.workspace===name;
      b.classList.toggle('is-active',selected);
      if(b.tagName==='BUTTON')b.setAttribute('aria-selected',String(selected));
      if(b.tagName==='A'){if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
    });
    $('nx-active-tab').textContent=labels[name];document.body.dataset.workspace=name;
    if(updateHash){try{history.replaceState(null,'','#'+name);}catch(_){/* Local browser may restrict history. */}}
    if(name==='model')window.HydrationViewport.refresh();
  }
  document.querySelectorAll('[data-workspace]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();select(button.dataset.workspace);}));
  window.addEventListener('hashchange',()=>select(location.hash.slice(1),false));
  document.querySelectorAll('[data-nx-view]').forEach(button=>button.addEventListener('click',()=>{
    window.HydrationViewport.setView(button.dataset.nxView);
  }));
  function updateViewButtons(){
    const view=window.HydrationViewport.state.view;
    document.querySelectorAll('[data-nx-view]').forEach(button=>{
      const active=button.dataset.nxView===view;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));
    });
  }
  new MutationObserver(updateViewButtons).observe($('mesh-side'),{attributes:true,attributeFilter:['data-render-view']});
  $('nx-fit-view').addEventListener('click',()=>{window.HydrationViewport.fit();log('VIEW','Model disesuaikan ke viewport.');});
  $('nx-toggle-mesh').addEventListener('click',()=>{
    const on=!window.HydrationViewport.state.mesh;window.HydrationViewport.setMesh(on);
    $('nx-toggle-mesh').classList.toggle('is-active',on);$('nx-toggle-mesh').setAttribute('aria-pressed',String(on));
  });
  $('nx-stage-select').addEventListener('change',event=>{
    const value=event.target.value;window.HydrationViewport.setStage(value);
    const label=value==='all'?'Seluruh model':value==='old'?'Beton lama':'Beton baru';
    $('nx-status-stage').textContent='Visual: '+label;log('VIEW',label+' ditampilkan. Filter visual tidak mengubah model MCT.');
  });
  window.HydrationViewport.attach();
  function mirrorCounts(){
    $('nx-model-node-count').textContent=$('metrics-nodes').textContent;
    $('nx-model-element-count').textContent=$('metrics-elements').textContent;
  }
  for(const id of ['metrics-nodes','metrics-elements'])new MutationObserver(mirrorCounts).observe($(id),{childList:true,subtree:true,characterData:true});
  new MutationObserver(()=>{
    const message=$('export-status').textContent;
    if(message!==lastExport){lastExport=message;log('FILE',message);}
  }).observe($('export-status'),{childList:true,subtree:true,characterData:true});
  new MutationObserver(()=>{
    const text=$('validation-summary').textContent;
    if(text!==lastValidation){lastValidation=text;log('CHECK',text+'. '+($('export-mct').disabled?'Buka Check & Export untuk memperbaiki masukan.':'Parser dan solver NX belum dijalankan.'));}
  }).observe($('validation-summary'),{childList:true,subtree:true,characterData:true});
  const badInput=document.querySelector('[data-key][aria-invalid="true"]');
  if(badInput)log('CHECK','Ada masukan yang perlu diperbaiki sebelum ekspor.');
  else log('CHECK','Geometri dan parameter siap diekspor. Node bersama pada sambungan.');
  mirrorCounts();updateViewButtons();select(Object.hasOwn(labels,location.hash.slice(1))?location.hash.slice(1):'model',false);
  $('nx-status-stage').textContent='Visual: Seluruh model';
  window.NXWorkspace={select,log};
})();
