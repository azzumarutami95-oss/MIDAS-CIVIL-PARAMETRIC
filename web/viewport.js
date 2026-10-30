/* Independent SVG model viewport. Geometry comes from the actual HEX8 section. */
(function () {
  'use strict';
  const state={yaw:-Math.PI/4,pitch:.42,zoom:1,panX:0,panY:0,mesh:true,stage:'all',view:'iso'};
  let lastSection,lastConfig,scheduled=false;
  const svg=()=>document.getElementById('mesh-side');
  const fmt=v=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(v);
  function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function render(section,c){
    lastSection=section;lastConfig=c;
    const target=svg();if(!target)return;
    target.setAttribute('viewBox','0 0 900 600');
    const geometry=window.MidasEngine.geometryInfo(c),hOld=c.geometry.heightOld,H=hOld+c.geometry.heightNew;
    const zmin=state.stage==='new'?hOld:0,zmax=state.stage==='old'?hOld:H;
    const center=(zmin+zmax)/2;
    const C=Math.cos(state.yaw),S=Math.sin(state.yaw),P=Math.sin(state.pitch),Q=Math.cos(state.pitch);
    const ring=section.xy.slice(0,section.boundaryCount),horizontal=ring.map(p=>p[0]*C-p[1]*S),vertical=[];
    for(const p of ring)for(const z of [zmin,zmax])vertical.push((z-center)*Q-(p[0]*S+p[1]*C)*P);
    const fit=Math.min(570/Math.max(1e-9,Math.max(...horizontal)-Math.min(...horizontal)),400/Math.max(1e-9,Math.max(...vertical)-Math.min(...vertical)));
    const scale=fit*state.zoom,cy=295+state.panY,cx=450+state.panX;
    const project=(p,z)=>[cx+scale*(p[0]*C-p[1]*S),cy-scale*((z-center)*Q-(p[0]*S+p[1]*C)*P)];
    const depth=(p,z)=>(p[0]*S+p[1]*C)*Q+(z-center)*P;
    const path=ps=>'M'+ps.map(p=>p.map(v=>v.toFixed(2)).join(',')).join('L')+'Z';
    const faces=[],levels=[];
    if(state.stage!=='new')for(let k=0;k<=c.mesh.layersOld;k++)levels.push(hOld*k/c.mesh.layersOld);
    else levels.push(hOld);
    if(state.stage!=='old')for(let k=1;k<=c.mesh.layersNew;k++)levels.push(hOld+c.geometry.heightNew*k/c.mesh.layersNew);
    for(let k=0;k<levels.length-1;k++)for(let i=0;i<section.boundaryCount;i++){
      const a=section.xy[i],b=section.xy[(i+1)%section.boundaryCount],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      const dx=b[0]-a[0],dy=b[1]-a[1],normal=(dy*S-dx*C)/Math.hypot(dx,dy);
      if(normal*Q<=1e-7)continue;
      const fresh=(levels[k]+levels[k+1])/2>hOld;
      const light=.75+.25*Math.max(0,normal);
      const base=fresh?[220,163,103]:[174,190,202];
      const color='rgb('+base.map(v=>Math.round(v*light)).join(',')+')';
      faces.push({d:depth(mid,(levels[k]+levels[k+1])/2),p:path([project(a,levels[k]),project(b,levels[k]),project(b,levels[k+1]),project(a,levels[k+1])]),color});
    }
    if(P>1e-7)for(const q of section.quads){
      const ps=q.map(i=>section.xy[i]),mid=[ps.reduce((v,p)=>v+p[0],0)/4,ps.reduce((v,p)=>v+p[1],0)/4];
      faces.push({d:depth(mid,zmax),p:path(ps.map(p=>project(p,zmax))),color:state.stage==='old'?'#c7d2da':'#efc28f'});
    }
    faces.sort((a,b)=>a.d-b.d);
    let markup='<defs><pattern id="nx-grid-minor" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#d9e3ec" stroke-width=".5"/></pattern><pattern id="nx-grid-major" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" fill="url(#nx-grid-minor)"/><path d="M120 0H0V120" fill="none" stroke="#c7d4df" stroke-width=".7"/></pattern></defs>';
    markup+='<rect width="900" height="600" fill="#f3f7fb"/><rect width="900" height="600" fill="url(#nx-grid-major)"/>';
    markup+='<path d="M0 300H900M450 0V600" stroke="#d1deea" stroke-width=".8" stroke-dasharray="4 5"/>';
    markup+=`<path d="${path(ring.map(p=>{const v=project(p,zmin);return [v[0],v[1]+8];}))}" fill="#6f8795" opacity=".12"/>`;
    const stroke=state.mesh?'#566b7a':'none',width=state.mesh?'.55':'0';
    markup+=faces.map(f=>`<path d="${f.p}" fill="${f.color}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`).join('');
    if(state.stage==='all'){
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1];
        if((dy*S-dx*C)*Q/Math.hypot(dx,dy)>1e-7)
          markup+=`<path d="M${project(a,hOld).join(',')}L${project(b,hOld).join(',')}" fill="none" stroke="#233e58" stroke-width="1.6"/>`;
      }
    }
    // Axes are the camera projection of world axes, not an analysis result.
    const axes=[['X',[C,S*P],'#c35253'],['Y',[-S,C*P],'#34865e'],['Z',[0,-Q],'#3377b8']];
    markup+='<g font-family="Segoe UI,Arial,sans-serif" font-size="12" font-weight="600">';
    for(const [name,dir,color]of axes){const x=62+dir[0]*36,y=533+dir[1]*36;markup+=`<path d="M62 533L${x} ${y}" stroke="${color}" stroke-width="2.3"/><circle cx="${x}" cy="${y}" r="2.8" fill="${color}"/><text x="${x+5}" y="${y-3}" fill="${color}">${name}</text>`;}
    markup+='</g>';
    const label=state.stage==='old'?'BETON LAMA':state.stage==='new'?'BETON BARU':'DUA SEGMEN • KONTAK SEMPURNA';
    const dimensions=geometry.shape==='rectangular'?`B ${fmt(geometry.width)} × L ${fmt(geometry.depth)} m`:`Ø ${fmt(geometry.width)} m`;
    markup+=`<g font-family="Segoe UI,Arial,sans-serif"><text x="24" y="29" fill="#48637b" font-size="11" letter-spacing="1">${label}</text><text x="24" y="49" fill="#7a8fa2" font-size="10">${dimensions} · Z ${fmt(zmin)}–${fmt(zmax)} m · HEX8</text><text x="876" y="576" text-anchor="end" fill="#6d8296" font-size="10">${Math.round(state.zoom*100)}% · ${escape(state.view.toUpperCase())} · warna segmen</text></g>`;
    target.innerHTML=markup;
    target.dataset.renderView=state.view;target.dataset.mesh=String(state.mesh);target.dataset.stage=state.stage;target.dataset.shape=geometry.shape;
    const caption=document.getElementById('nx-view-caption');if(caption)caption.textContent=`${state.view==='iso'?'Isometrik':state.view==='front'?'Tampak depan':state.view==='top'?'Tampak atas':'Orbit bebas'} · ${Math.round(state.zoom*100)}%`;
  }
  function refresh(){if(lastSection&&lastConfig)render(lastSection,lastConfig);}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh();});}
  function fit(){state.zoom=1;state.panX=0;state.panY=0;refresh();}
  function setView(view){
    if(!['iso','front','top'].includes(view))return;
    Object.assign(state,view==='iso'?{yaw:-Math.PI/4,pitch:.42}:view==='front'?{yaw:0,pitch:0}:{yaw:0,pitch:Math.PI/2});
    state.view=view;fit();
  }
  function attach(){const target=svg();if(!target)return;let dragging=false,lastX,lastY;
    target.addEventListener('pointerdown',event=>{if(event.button!==0&&event.button!==1)return;event.preventDefault();dragging=true;lastX=event.clientX;lastY=event.clientY;target.setPointerCapture(event.pointerId);target.classList.add('is-dragging');});
    target.addEventListener('pointermove',event=>{if(!dragging)return;const dx=event.clientX-lastX,dy=event.clientY-lastY;lastX=event.clientX;lastY=event.clientY;
      if(event.shiftKey||event.buttons===4){const rect=target.getBoundingClientRect();state.panX+=dx*900/Math.max(1,rect.width);state.panY+=dy*600/Math.max(1,rect.height);}
      else{state.yaw+=dx*.009;state.pitch=Math.max(.02,Math.min(1.5,state.pitch-dy*.007));state.view='orbit';}
      schedule();});
    const stop=()=>{dragging=false;target.classList.remove('is-dragging');};target.addEventListener('pointerup',stop);target.addEventListener('pointercancel',stop);target.addEventListener('lostpointercapture',stop);
    target.addEventListener('wheel',event=>{event.preventDefault();state.zoom=Math.max(.35,Math.min(4,state.zoom*Math.exp(-event.deltaY*.001)));schedule();},{passive:false});
    target.addEventListener('dblclick',fit);
  }
  window.HydrationViewport={render,refresh,fit,setView,attach,state,setMesh(value){state.mesh=!!value;refresh();},setStage(value){if(['all','old','new'].includes(value)){state.stage=value;fit();}}};
})();
