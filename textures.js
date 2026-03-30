function makeBlockTexture(state, value) {
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const ctx=c.getContext('2d');

  // 1. WEATHERED BRONZE BASE (Metallic & Riveted)
  const metal = ctx.createRadialGradient(128, 128, 50, 128, 128, 180);
  metal.addColorStop(0, '#8b5a2b'); // Light bronze
  metal.addColorStop(1, '#3d2b1f'); // Dark, worn iron
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle metallic "scratches"
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for(let i=0; i<8; i++){
    ctx.beginPath(); ctx.moveTo(Math.random()*256,0); ctx.lineTo(Math.random()*256,256); ctx.stroke();
  }

  // Rivets (3D look)
  [[20,20],[236,20],[20,236],[236,236], [128,20], [128,236], [20,128], [236,128]].forEach(([x,y])=>{
    const rg=ctx.createRadialGradient(x-2,y-2,1,x,y,8);
    rg.addColorStop(0,'#b8860b'); rg.addColorStop(0.4,'#8b5a2b'); rg.addColorStop(1,'#1a0f00');
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,y,8,0,6.283); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1; ctx.stroke();
  });

  // 2. THE RECESSED "SCREEN" TRAY
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(40, 40, 176, 176);
  
  // Beveled Edge
  ctx.strokeStyle = '#5a3e1b'; ctx.lineWidth = 4;
  ctx.strokeRect(38, 38, 180, 180);

  // MAGICAL/MR ORANGE EMISSIVE GLOW
  ctx.save();
  ctx.shadowColor = '#ff8c00'; ctx.shadowBlur = 15;
  ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, 172, 172);
  ctx.restore();

  // 3. CONTENT ON THE "SCREEN"
  ctx.save(); ctx.translate(128, 128);
  
  if(state==='envelope'){
    // Sealed Parchment Envelope
    ctx.fillStyle='#d2b48c'; ctx.fillRect(-60,-40,120,80);
    // Wax Seal (Embossed Stopwatch Detail)
    const rg=ctx.createRadialGradient(-3, -3, 2, 0, 0, 18);
    rg.addColorStop(0,'#ff4444'); rg.addColorStop(0.8,'#8b0000'); rg.addColorStop(1,'#400');
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(0,0,18,0,6.283); ctx.fill();
    ctx.strokeStyle='#300'; ctx.lineWidth=1.5; ctx.stroke();
    // Stopwatch symbol on seal
    ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,8,0,6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-6); ctx.moveTo(0,0); ctx.lineTo(4,2); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.fillRect(-2,-10,4,2); // Stem
    // Envelope Folds
    ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-60,-40); ctx.lineTo(0,0); ctx.lineTo(60,-40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-60,40); ctx.lineTo(-20,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60,40); ctx.lineTo(20,0); ctx.stroke();


  } else if(state.startsWith('open-')){
    const type = state.split('-')[1]; 
    const colors = { red:'#ff4444', blue:'#4488ff', green:'#44ff88' };
    const symbols = { red:'Σ', blue:'📁', green:'⑂' };
    const labels = { red:'MATH', blue:'LOAD', green:'JUMP' };
    
    // Torn Envelope background
    ctx.fillStyle='#e8d0a0'; ctx.fillRect(-65,-45,130,90);
    ctx.strokeStyle='#8b6914'; ctx.lineWidth=1; ctx.strokeRect(-65,-45,130,90);
    // Color-coded Ticket
    ctx.fillStyle = colors[type];
    ctx.fillRect(-30, -70, 60, 65);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-28, -68, 56, 61);
    // Ticket symbols
    ctx.fillStyle='#fff'; ctx.font='bold 34px sans-serif'; ctx.textAlign='center';
    ctx.fillText(symbols[type], 0, -35);
    ctx.font='bold 10px monospace'; ctx.fillText(labels[type], 0, -10);

  } else if(state==='data-raw' || state==='data-result'){
    const isRes = state==='data-result';
    const mainCol = isRes ? '#ffd700' : '#4488ff';
    const glowCol = isRes ? '#ffcc00' : '#0066ff';
    
    ctx.fillStyle = mainCol; ctx.shadowColor = glowCol; ctx.shadowBlur = isRes ? 35 : 20;
    ctx.font = `bold ${isRes?72:64}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(value||0).padStart(3,'0'), 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = isRes ? '#ffe566' : 'rgba(68,136,255,0.4)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(isRes ? '★ SUCCESS ★' : 'REGISTER DATA', 0, 45);
    
    if(isRes){
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 85, 0, 6.283); ctx.stroke();
    } else {
      // Punch-card / Matrix feed look
      ctx.strokeStyle = 'rgba(68,136,255,0.4)'; ctx.lineWidth = 1;
      for(let x=-80; x<=80; x+=20) {
        ctx.beginPath(); ctx.moveTo(x, -50); ctx.lineTo(x, 50); ctx.stroke();
      }
      for(let i=0; i<15; i++) {
        ctx.fillStyle = Math.random() < 0.3 ? '#4488ff' : 'rgba(68,136,255,0.1)';
        ctx.fillRect(-80 + Math.floor(Math.random()*8)*20, -40 + Math.random()*80, 18, 4);
      }
    }

  } else if(state==='bug'){
    // Glitchy / Sparking Bug
    ctx.fillStyle = '#1a0000'; ctx.fillRect(-80, -80, 160, 160);
    ctx.shadowBlur = 20; ctx.shadowColor = '#ff3300';
    
    // Sparking lightning / Glitch lines
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2;
    for(let i=0; i<12; i++){
      ctx.beginPath();
      let x = -80+Math.random()*160, y = -80+Math.random()*160;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random()-0.5)*40, y + (Math.random()-0.5)*40);
      ctx.stroke();
    }
    
    // Central icon
    ctx.font = 'bold 100px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🕷️', Math.random()*4-2, -20 + Math.random()*4-2); // Jittery
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#ff4444'; ctx.font = 'bold 14px monospace';
    ctx.fillText('SYSTEM ERROR', 0, 45);
    ctx.font = 'bold 11px monospace'; ctx.fillText('TRASH AT MARKER 4', 0, 65);
    
    // Binary noise glitch
    ctx.font = 'bold 8px monospace'; ctx.fillStyle = 'rgba(255,0,0,0.5)';
    for(let i=0; i<10; i++){
      ctx.fillText(Math.random() < 0.5 ? '101' : '010', -70 + Math.random()*140, -70 + Math.random()*140);
    }
  }



  ctx.restore();
  return c.toDataURL();
}
