// Instructions pool
const INSTRUCTIONS=[
  {op:'ADD',type:'red',desc:'ADD R0 + R1', needsOperand: false},
  {op:'SUB',type:'red',desc:'SUB R2 - R1', needsOperand: false},
  {op:'ADD',type:'red',desc:'ADD R1 + R2', needsOperand: false},
  {op:'ADD',type:'red',desc:'ADD [REG] + R0', needsOperand: true}, // Requires Store trip
  {op:'SUB',type:'red',desc:'SUB [REG] - R1', needsOperand: true}, // Requires Store trip
  {op:'LOD',type:'blue',desc:'LOAD R3 from MEM'},
  {op:'STO',type:'blue',desc:'STORE R0 to MEM'},
  {op:'JMP',type:'green',desc:'JUMP to ADDR 0x1F'},
];
let currentInstr=null,dataA=0,dataB=0;
const VM={}; // visible markers map

function haptic(d){ if(navigator.vibrate) navigator.vibrate(d); }
function thud(){ haptic(100); }
function rumble(){ haptic(20); }

// Initialize motion sensors on first interaction
window.addEventListener('mousedown', function _init() {
  if(typeof initMotion === 'function') initMotion();
  window.removeEventListener('mousedown', _init);
});



AFRAME.registerComponent('delayed-visible', {
  schema: { delay: {type: 'number', default: 5000} },
  init: function () {
    this.timer = null;
    this.el.addEventListener('markerFound', () => {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.el.setAttribute('visible', true);
    });
    this.el.addEventListener('markerLost', () => {
      if (this.timer) return; // Already timing hide
      this.timer = setTimeout(() => {
        this.el.setAttribute('visible', false);
        this.el.object3D.visible = false;
        this.timer = null;
      }, this.data.delay);
    });
    this.el.addEventListener('force-hide', () => {
      if (this.timer) { 
        clearTimeout(this.timer); this.timer = null;
        this.el.setAttribute('visible', false);
        this.el.object3D.visible = false;
      }
    });
  },
  tick: function () {
    if (this.timer) this.el.object3D.visible = true;
  }
});


function _initMarkers(){
  const markerIds=['mk-conveyor','mk-dispatch','mk-registers','mk-alu','mk-debugger','mk-ram'];

  markerIds.forEach(id=>{
    const m=document.getElementById(id);if(!m)return;
    m.hideTimer = null;
    m.addEventListener('markerFound',()=>{
      // Clear timers for all other markers
      markerIds.forEach(otherId=>{
        if(otherId===id) return;
        const om=document.getElementById(otherId);if(!om)return;
        if(om.hideTimer){ clearTimeout(om.hideTimer); om.hideTimer=null; VM[otherId]=false; }
        om.emit('force-hide');
      });
      if(m.hideTimer) { clearTimeout(m.hideTimer); m.hideTimer = null; }
      VM[id]=true; updateButtons(); GS.minDist=99;
    });
    m.addEventListener('markerLost',()=>{
      if(m.hideTimer) return; // Already timing hide
      m.hideTimer = setTimeout(() => {
        VM[id]=false; updateButtons(); GS.minDist=99;
        m.hideTimer = null;
      }, 5000);
    });
  });

  // Global tap for dropping
  window.addEventListener('mousedown',()=>{
    if(GS.inventory.length>0) {
      if(GS.bugActive) {
        if(VM['mk-debugger']) doDebug();
        return;
      }
      // Check if looking at a valid drop marker
      if(VM['mk-dispatch'] && GS.inventory[0].state === 'envelope') doDecode();
      else if(VM['mk-alu'] && (GS.inventory[0].state.startsWith('open') || GS.inventory[0].state === 'data-raw')) doExecute();
      else if(VM['mk-registers']) doDropToRegister();
      else if(VM['mk-debugger']) triggerBug(); // Manually trash something (triggers bug as penalty)
      else if(VM['mk-conveyor']) triggerBug(); // Dropped item back on belt!
      else dropItem(0);
    }
  });


}


function updateButtons(){
  const s=(id,ok)=>{const e=document.getElementById(id);if(e)e.style.display=ok?'block':'none';};
  s('btn-fetch',   GS.phase==='IDLE'&&VM['mk-conveyor']);
  s('btn-decode',  GS.phase==='FETCHED'&&VM['mk-dispatch']);
  s('btn-load',    (GS.phase==='DECODED'||GS.phase==='AWAITING_OPERAND'||GS.phase==='FORGE_WAITING_DATA')&&VM['mk-registers']);
  s('btn-execute', (GS.phase==='LOADED'||GS.phase==='DECODED'||GS.phase==='AWAITING_OPERAND'||GS.phase==='FORGE_WAITING_DATA')&&VM['mk-alu']);
  s('btn-writeback',GS.phase==='EXECUTED'&&VM['mk-registers']);
  s('btn-ram',     GS.phase==='CACHE_MISS'&&VM['mk-ram']);

}

// Belt control
let beltOn=false;
function startBelt(){
  if(beltOn)return;beltOn=true;
  const chip=document.getElementById('belt-chip');if(!chip)return;
  chip.setAttribute('visible','true');
  setImg('chip-img',makeBlockTexture('envelope'));
  chip.removeAttribute('animation__belt');
  chip.setAttribute('animation__belt',{property:'position',from:'-0.7 0.3 0',to:'0.7 0.3 0',loop:true,dur:7500,easing:'linear'});
}
function stopBelt(){
  beltOn=false;
  const chip=document.getElementById('belt-chip');if(!chip)return;
  chip.removeAttribute('animation__belt');chip.setAttribute('visible','false');
}
function setImg(id,src){const e=document.getElementById(id);if(e)e.setAttribute('src',src);}

// ── FETCH ────────────────────────────────────────────────────────────
function doFetch(){
  if(GS.inventory.length >= GS.maxSlots || GS.bugActive) return;

  // Filter instructions by Level Syllabus
  const pool = INSTRUCTIONS.filter(i => {
    if(GS.level < 4) return i.type === 'red';
    if(GS.level < 7) return i.type === 'red' || i.type === 'blue';
    return true;
  });

  currentInstr=pool[Math.floor(Math.random()*pool.length)];
  GS.phase='FETCHED'; GS.heat=Math.min(100,GS.heat+5);
  GS.inventory.push({
    state:'envelope',
    label:currentInstr.desc,
    op: currentInstr.op,
    type: currentInstr.type,
    needsOperand: !!currentInstr.needsOperand
  });
  
  thud(); playSteam(); log('FETCH: '+currentInstr.desc);
  
  const chip=document.getElementById('belt-chip');
  if(chip) {
    chip.setAttribute('visible', 'false');
    setTimeout(() => { chip.setAttribute('visible','true'); }, 2000);
  }

  updateHUD(); updateButtons();
  broadcastState('FETCHED an instruction', { hideChip: true });
}

function triggerBug(){
  GS.bugActive = true;
  GS.inventory = [{state:'bug', label:'!! SYSTEM ERROR !!'}];
  document.body.classList.add('bug-active');
  playAlarm(); haptic([200, 100, 200, 100, 200]);
  log('🚨 WORKSTATION JAMMED! Carry the BUG to INCINERATOR (Marker 4)!');
  updateHUD(); updateButtons();
  broadcastState('🚨 BUG DETECTED!');
}



// ── DECODE ───────────────────────────────────────────────────────────
function doDecode(){
  if(!GS.inventory[0] || GS.inventory[0].state!=='envelope' || GS.bugActive)return;
  const instr = GS.inventory[0];
  GS.phase='DECODING';
  updateButtons();log('DECODE — SHAKE to process!');
  const db=document.getElementById('dispatch-block');
  if(db){db.setAttribute('visible','true');setImg('dispatch-img',makeBlockTexture('envelope'));}
  
  const lv = Object.keys(SYLLABUS).reverse().find(k => GS.level >= k) || 1;
  const targetShakes = Math.floor(15 * SYLLABUS[lv].shakeMult);

  startShake(targetShakes,()=>{
    const ts='open-'+instr.type;
    setImg('dispatch-img',makeBlockTexture(ts));
    GS.currentTicket=instr.type;
    GS.phase='DECODING_COMPLETE';
    log('DECODED: '+instr.op+' — PULL TO COLLECT!');

    if(db){
      db.setAttribute('animation__rattle',{property:'rotation',from:'0 0 -4',to:'0 0 4',loop:5,dur:70,dir:'alternate'});
      setTimeout(()=>{db.setAttribute('visible','false');db.removeAttribute('animation__rattle');},450);
    }
    updateHUD();updateButtons();
    broadcastState('DECODED: '+instr.op);
  });
}



// ── LOAD ─────────────────────────────────────────────────────────────
function doLoad(){
  const instr = GS.inventory[0] || GS.aluInstruction;
  if(!instr || (!instr.state.startsWith('open') && !GS.aluInstruction) || GS.bugActive) return;
  
  if(instr.type==='green'){pipelineFlush();return;}
  if(GS.level>=4&&Math.random()<.28){cacheMiss();return;}
  
  const v1 = GS.registers['R0'];
  const v2 = GS.registers['R1'];
  
  GS.inventory.push({state:'data-raw', label:String(v1).padStart(3,'0'), val: v1});
  GS.phase='LOADED'; thud();
  log('LOAD from Registers: R0='+v1+', R1='+v2);
  updateHUD(); updateButtons();
  broadcastState('LOAD: R0='+v1+', R1='+v2);
}

// ── EXECUTE ────────────────────────────────────────────────────────
function doExecute(){
  const instr = GS.aluInstruction || GS.inventory[0];
  const dataItem = GS.inventory.find(i => i && i.state === 'data-raw');

  if(!instr || GS.bugActive) return;
  
  // Requirement check: if instruction needs operand, it must be in inventory OR already in ALU
  if(instr.needsOperand && !dataItem) {
     log('ALU Error: Operand missing! Go to REGISTERS (Marker 2).');
     return;
  }

  GS.phase='EXECUTING';
  updateButtons(); log('EXECUTE — SHAKE the forge!');
  playGrind();
  const fire=document.getElementById('forge-fire');
  if(fire)fire.setAttribute('animation__pulse',{property:'material.emissiveIntensity',from:0.8,to:3.5,dur:250,dir:'alternate',loop:999});
  
  const lv = Object.keys(SYLLABUS).reverse().find(k => GS.level >= k) || 1;
  const targetShakes = Math.floor(20 * SYLLABUS[lv].shakeMult);

  startShake(targetShakes,()=>{
    if(fire){fire.removeAttribute('animation__pulse');fire.setAttribute('material','color:#cc2200;emissive:#ff2200;emissiveIntensity:0.8');}
    
    // Operands: pulled from current inventory or defaults
    const valA = dataItem ? dataItem.val : (instr.val || GS.registers['R0']);
    const valB = GS.registers['R1'];
    
    let res = valA;
    if(instr.op==='ADD') res = valA + valB;
    else if(instr.op==='SUB') res = Math.max(0, valA - valB);
    
    res = Math.min(999, Math.max(0, res));
    GS.result=res;
    const rs=String(res).padStart(3,'0');
    const fr=document.getElementById('forge-result');
    if(fr){
      fr.setAttribute('visible','true');
      setImg('result-img',makeBlockTexture('data-result',rs));
      fr.setAttribute('animation__bob',{property:'position',from:'0 0.66 -0.16',to:'0 0.74 -0.16',dur:380,dir:'alternate',loop:999});
    }
    GS.phase='EXECUTING_COMPLETE';
    log('EXECUTED: Result ready — PULL TO COLLECT!');

    // Clean up used operands
    if(GS.aluInstruction) GS.aluInstruction = null;
    GS.inventory = GS.inventory.filter(i => i.state !== 'data-raw' && !i.state.startsWith('open'));

    updateHUD();updateButtons();
    broadcastState('RESULT: '+valA+' '+instr.op+' '+valB+' = '+res);
  });
}

function doDropToForge(){
  const item = GS.inventory[0];
  if(!item || !item.state.startsWith('open')) return;
  
  GS.aluInstruction = item;
  GS.inventory.shift();
  GS.phase = 'FORGE_WAITING_DATA';
  log('DEPOSITED '+item.op+' into Forge. Awaiting data operand...');
  thud(); playClunk(); updateHUD(); updateButtons();
  broadcastState('Deposited '+item.op+' into ALU');
}



// ── WRITE-BACK ───────────────────────────────────────────────────────
function doWriteback(){
  if(GS.phase!=='EXECUTED')return;
  const rs=String(GS.result).padStart(3,'0');
  const tgt=currentInstr.op==='SUB'?'R4':'R3';
  
  // Shared Write
  GS.registers[tgt]=GS.result;
  const vEl=document.getElementById('val-'+tgt);if(vEl)vEl.setAttribute('value',rs);
  
  const fr=document.getElementById('forge-result');
  if(fr){fr.removeAttribute('animation__bob');fr.setAttribute('visible','false');}
  
  // Local Reset
  GS.inventory=[]; GS.phase='IDLE'; GS.clockCycles++; GS.heat=Math.max(0,GS.heat-10);
  
  playDing(); log('WRITE-BACK: '+tgt+' = '+rs+' ✓  [Cycle #'+GS.clockCycles+']');
  if(GS.clockCycles%5===0)levelUp();
  
  updateHUD(); updateButtons();
  broadcastState('Cycle #'+GS.clockCycles+' completed!');
  
  setTimeout(()=>{
    GS.programQueue.shift();
    GS.programQueue.push(generateTask());
    updateHUD();
  },700);

}

function dropItem(i){if(!GS.inventory[i])return;log('Dropped slot '+i+'.');}

// ── CACHE MISS ───────────────────────────────────────────────────────
function cacheMiss(){
  log('⚠ CACHE MISS — go to RAM cabinet!');playAlarm();
  GS.phase='CACHE_MISS';GS.heat=Math.min(100,GS.heat+18);
  const el=document.getElementById('val-R0');
  if(el){el.setAttribute('value','MISS');el.setAttribute('color','#ff4400');}
  setTimeout(()=>{if(el){el.setAttribute('value','???');el.setAttribute('color','#44ff88');}},1400);
  updateHUD();updateButtons();
  broadcastState('⚠ CACHE MISS — peer go to RAM cabinet!');
}
function doRAMFetch(){
  if(!GS.inventory[0] || GS.inventory[0].state !== 'open-blue' || GS.bugActive) return;
  
  log('RAM access — SHAKE hard (slow!)');
  updateButtons();
  
  const lv = Object.keys(SYLLABUS).reverse().find(k => GS.level >= k) || 1;
  const targetShakes = Math.floor(38 * SYLLABUS[lv].shakeMult);

  startShake(targetShakes,()=>{
    const val=50+Math.floor(Math.random()*450);
    const rs=String(val).padStart(3,'0');
    const r=document.getElementById('ram-result');
    if(r){r.setAttribute('visible','true');setImg('ram-img',makeBlockTexture('data-raw',val));}
    
    GS.inventory = [{state:'data-raw',label:rs, val: val}];
    GS.phase='LOADED';
    log('RAM retrieved: '+val);
    setTimeout(()=>{if(r)r.setAttribute('visible','false');},2200);
    updateHUD();updateButtons();
    broadcastState('RAM retrieved: '+rs);
  });
}

function doDebug(){
  if(!GS.bugActive) return;
  log('INCINERATING SYSTEM BUGS...');
  startShake(20, ()=>{
    GS.bugActive = false;
    GS.inventory = [];
    GS.phase = 'IDLE';
    document.body.classList.remove('bug-active');
    log('SYSTEM PURIFIED ✓ Clean thermal boot.');
    updateHUD(); updateButtons();
    broadcastState('SYSTEM PURIFIED ✓');
  });
}

function doDropToRegister(){
  if(!GS.inventory[0] || GS.bugActive) return;
  const item = GS.inventory[0];
  if(item.state === 'data-raw' || item.state === 'data-result'){
     const reg = 'R' + Math.floor(Math.random()*5);
     GS.registers[reg] = item.val || parseInt(item.label);
     log('SAVED TO '+reg+': '+GS.registers[reg]);
     GS.inventory = [];
     thud(); playClunk(); updateHUD(); updateButtons();

     broadcastState('Saved to '+reg);
  } else {
     log('Registers only accept RAW DATA or RESULTS!');
  }
}

function doPullFromRegister(){
  if(GS.inventory.length >= GS.maxSlots || GS.bugActive) return;
  // Pick the register with the most 'interesting' value or just R0 for now
  const val = GS.registers['R0'];
  const rs = String(val).padStart(3, '0');
  GS.inventory.push({state:'data-raw', label:rs, val: val});
  log('PULLED R0: '+val);
  thud(); playWhir(); updateHUD(); updateButtons();

  broadcastState('Pulled R0');
}




// ── PIPELINE FLUSH ───────────────────────────────────────────────────
function pipelineFlush(){
  log('🚨 PIPELINE FLUSH — Branch detected!');playAlarm();
  GS.phase='FLUSH';GS.heat=Math.min(100,GS.heat+28);
  const vign=document.getElementById('heat-vignette');
  vign.style.background='radial-gradient(ellipse at center,transparent 35%,rgba(255,0,0,.65) 100%)';
  vign.style.opacity='1';
  const chip=document.getElementById('belt-chip');
  if(chip){chip.setAttribute('visible','true');setImg('chip-img',makeBlockTexture('bug'));
    chip.removeAttribute('animation__belt');
    chip.setAttribute('animation__belt',{property:'position',from:'-0.7 0.3 0',to:'0.7 0.3 0',loop:true,dur:2500,easing:'linear'});}
  setTimeout(()=>{
    vign.style.background='radial-gradient(ellipse at center,transparent 40%,rgba(255,80,0,.7) 100%)';
    vign.style.opacity='0';
    stopBelt();GS.phase='IDLE';GS.inventory=[];GS.clockCycles++;
    log('Flush complete. New PC active.');
    updateHUD();updateButtons();
    broadcastState('🚨 Pipeline flush complete.');
    setTimeout(startBelt,500);
  },3800);
}

// ── OVERCLOCK ────────────────────────────────────────────────────────
function overclock(){
  log('🔵 OVERCLOCK FEVER! One-snap shakes!');haptic([50,30,50,30,200]);
  document.body.style.transition='filter 0.5s';
  document.body.style.filter='hue-rotate(195deg) saturate(2.2) brightness(1.1)';
  setTimeout(()=>{document.body.style.filter='';},9000);
}

// ── LEVEL UP ────────────────────────────────────────────────────────
function levelUp(){
  GS.level++;playLevelUp();
  if(GS.level===2){GS.maxSlots=2;log('UPGRADE → 2-slot Accumulator unlocked!');}
  if(GS.level===3){GS.maxSlots=3;log('UPGRADE → 3-slot Register File unlocked!');}
  if(GS.level===4)log('LEVEL 4 → RAM Cabinet now in play!');
  if(GS.level===7)log('LEVEL 7 → Pipeline hazards & branches active!');
  if(GS.level>=5&&GS.level%5===0)overclock();
  updateHUD();
}

// ── P2P NETWORKING ───────────────────────────────────────────────────
const _uP=new URLSearchParams(window.location.search);
const _roomId=_uP.get('room');
const _isHost=!_roomId;
const _peer=new Peer();
let _conn=null;

function sendPeer(d){if(_conn&&_conn.open)try{_conn.send(d);}catch(e){}}

/** Broadcast the SHARED game state so the peer stays in sync */
function broadcastState(msg, extra){
  sendPeer(Object.assign({
    type:'state',
    msg:msg||'',
    // Shared state only
    registers:Object.assign({},GS.registers),
    clockCycles:GS.clockCycles,
    heat:GS.heat,
    level:GS.level,
    bugActive:GS.bugActive,
    programQueue:GS.programQueue.slice()
  }, extra));

}

/** Apply shared state from peer */
function _applyState(d){
  if(!d) return;
  // Merge shared progress
  if(d.registers) GS.registers = d.registers;
  if(d.clockCycles !== undefined) GS.clockCycles = d.clockCycles;
  if(d.heat !== undefined) GS.heat = d.heat;
  if(d.level !== undefined) GS.level = d.level;
  if(d.bugActive !== undefined) GS.bugActive = d.bugActive;
  if(d.programQueue) GS.programQueue = d.programQueue;


  // Visual event: chip hide
  if(d.hideChip) {
    const chip=document.getElementById('belt-chip');
    if(chip) {
      chip.setAttribute('visible', 'false');
      setTimeout(() => { chip.setAttribute('visible', 'true'); }, 2000);
    }
  }

  // Visual updates for shared state
  updateHUD();
  for(let r in GS.registers) {
    const el = document.getElementById('val-'+r);
    if(el) el.setAttribute('value', String(GS.registers[r]).padStart(3, '0'));
  }
}

function copyLink(){
  navigator.clipboard.writeText(location.origin+location.pathname+'?room='+_peer.id)
    .then(()=>log('Invite link copied!'));
}

_peer.on('open',id=>{
  const ri=document.getElementById('room-info');
  if(ri)ri.textContent='Room: '+id.substring(0,6)+(_isHost?' (Host)':' (Guest)');
  const cb=document.getElementById('copy-btn');
  if(cb)cb.style.display=_isHost?'block':'none';
  if(!_isHost){_conn=_peer.connect(_roomId);_setupConn();}
});
_peer.on('connection',c=>{_conn=c;_setupConn();log('Peer joined!');});

function updateHUD(){
  const dest=document.getElementById('hud-destination');
  if(dest){
    if(GS.bugActive) {
       dest.textContent = '⚠ SYSTEM JAMMED! TRASH BUG AT INCINERATOR (MARKER 4) ⚠';
       dest.style.color = '#ff0000';
       document.body.classList.add('bug-active');
    } else {
       document.body.classList.remove('bug-active');
       dest.style.color = '#44ff88';
       let msg='Go to CONVEYOR (Marker 0)';
       if(GS.phase==='FETCHED') msg='Go to DISPATCH (Marker 1)';
       else if(GS.phase==='DECODING') msg='SHAKE Phone to Process...';
       else if(GS.phase==='DECODING_COMPLETE') msg='Collect from DISPATCH (Marker 1)';
       else if(GS.phase==='DECODED' || GS.phase==='LOADED') {
          // Direct, single-path instructions per user request
          if(GS.inventory[0].type==='blue') msg='Get Data from RAM (Marker 5)';
          else msg='Process at FORGE (Marker 3)';
       }
       else if(GS.phase==='AWAITING_OPERAND') {
          // Scenario A vs B randomization in hint (stable per cycle)
          if((GS.clockCycles + (GS.inventory[0]?GS.inventory[0].val:0)) % 2 === 0) msg='SCENARIO A: Drop at FORGE (Marker 3) first';
          else msg='SCENARIO B: Get DATA from REGISTERS (Marker 2)';
       }
       else if(GS.phase==='FORGE_WAITING_DATA') msg='Fetch DATA from REGISTERS (Marker 2)';
       else if(GS.phase==='EXECUTING') msg='Process at FORGE...';
       else if(GS.phase==='EXECUTING_COMPLETE') msg='Collect from FORGE (Marker 3)';
       else if(GS.phase==='EXECUTED') msg='Go to REGISTERS (Marker 2)';
       else if(GS.phase==='CACHE_MISS') msg='Go to RAM CABINET (Marker 5)';
       else if(GS.phase==='FLUSH') msg='⚠ PIPELINE FLUSH ⚠';
       dest.textContent=msg;
    }
  }

  const clock=document.getElementById('hud-clock');
  if(clock)clock.textContent=(GS.level*10)+' Hz';
  const q=document.getElementById('hud-queue');
  if(q)q.textContent='▶ PC: '+(GS.clockCycles % 100);

  // Level Progress Bar (e.g., progress towards next level-up every 10 cycles)
  const pb=document.getElementById('hud-level-progress');
  if(pb) {
    const progress = (GS.clockCycles % 10) * 10;
    pb.style.width = progress + '%';
  }

  const h=document.getElementById('hud-heat-bar');
  if(h){
    h.style.width=GS.heat+'%';h.style.background=GS.heat>80?'#f00':GS.heat>50?'#f80':'#fb0';
    if(GS.heat > 85 && Math.random() > 0.95) document.body.classList.toggle('bug-active'); // Minor heat flicker
  }
  const vign=document.getElementById('heat-vignette');
  if(vign)vign.style.opacity=(GS.heat/100)*0.5;
  updateInventoryHUD();
}

function triggerBump(id){
  const e=document.getElementById(id);if(!e)return;
  e.classList.remove('hud-bump');void e.offsetWidth;e.classList.add('hud-bump');
}

function updateInventoryHUD(){
  for(let i=0;i<3;i++){
    const s=document.getElementById('slot-'+i);
    const camEl=document.getElementById('cam-inv-'+i);
    const camImg=document.getElementById('cam-inv-img-'+i);
    if(!s)continue;

    s.style.display=(i<GS.maxSlots)?'flex':'none';
    const hasItem = !!GS.inventory[i];
    const alreadyFilled = s.classList.contains('filled');
    
    if(hasItem && !alreadyFilled) {
       thud(); // Haptic on pickup
       triggerBump('slot-'+i);
    }

    s.innerHTML='';
    if(hasItem){
      const item=GS.inventory[i];
      let icon='📦';
      if(item.state==='envelope') icon='✉️';
      else if(item.state.startsWith('open')) icon='📜';
      else if(item.state==='data-result') icon='💎';
      else if(item.state==='bug') icon='🕷️';

      s.innerHTML=`<span>${icon}</span>`;
      s.classList.add('filled');
      
      // 3D Camera Block sync
      if(camEl && camImg){
        camEl.setAttribute('visible', 'true');
        camImg.setAttribute('src', makeBlockTexture(item.state, item.label));
      }
    } else {
      s.classList.remove('filled');
      if(camEl) camEl.setAttribute('visible', 'false');
    }
  }
}





function _setupConn(){
  _conn.on('open',()=>log('P2P link up ✓'));
  _conn.on('data',d=>{
    if(d.type==='state'){
      if(d.msg)log('[Peer] '+d.msg);
      _applyState(d);
    }
  });
}
const _worldPos=new THREE.Vector3();
function _tickGestures(){
  // Candidate markers to watch based on current state
  let candidates = [];
  const inv = GS.inventory[0];

  if(!inv) candidates = ['mk-conveyor', 'mk-registers'];
  else if(inv.state==='envelope') candidates = ['mk-dispatch'];
  else if(inv.state.startsWith('open')) candidates = ['mk-registers', 'mk-ram', 'mk-alu'];
  else if(inv.state==='data-raw') candidates = ['mk-alu', 'mk-registers']; 
  else if(inv.state==='data-result') candidates = ['mk-registers'];
  else if(inv && inv.state==='bug') candidates = ['mk-debugger'];

  if(GS.phase === 'FORGE_WAITING_DATA' || GS.phase === 'EXECUTING_COMPLETE') candidates.push('mk-alu');


  // Find the closest visible candidate
  let activeId = null;
  let minDist = 99;
  
  candidates.forEach(id => {
    if(VM[id]) {
      const m = document.getElementById(id);
      m.object3D.getWorldPosition(_worldPos);
      const d = _worldPos.length();
      if(d < minDist) { minDist = d; activeId = id; }
    }
  });

  const hint=document.getElementById('hud-hint');
  if(!activeId){
    if(hint)hint.style.display='none';
    GS.minDist=99;return;
  }

  if(!GS.minDist || isNaN(GS.minDist)) GS.minDist = 99;
  GS.minDist = Math.min(GS.minDist, minDist);

  if(hint)hint.style.display='block';

  // Increased Threshold: If pulled back by 0.15m (15cm) to prevent accidental triggers
  if(minDist > GS.minDist + 0.15){
    GS.minDist=99; // Reset
    if(activeId==='mk-conveyor') doFetch();
    else if(activeId==='mk-dispatch' && GS.phase==='DECODING_COMPLETE') {
      const item = GS.inventory[0];
      const needs = !!item.needsOperand;
      const ts = 'open-' + item.type;
      
      GS.inventory=[{state:ts, label:item.label, op:item.op, type:item.type, needsOperand: needs}];
      GS.phase = needs ? 'AWAITING_OPERAND' : 'DECODED'; 
      thud(); log('COLLECTED decoded instruction.');
      const db=document.getElementById('dispatch-block');
      if(db) db.setAttribute('visible','false');
    }
    else if(activeId==='mk-alu') {
      if(GS.phase==='EXECUTING_COMPLETE') {
        const d_item = GS.inventory[0];
        const rs=String(GS.result).padStart(3,'0');
        GS.inventory=[{state:'data-result',label:rs, val: GS.result}];
        GS.phase='EXECUTED';
        thud(); log('COLLECTED forge result.');
        const fr=document.getElementById('forge-result');
        if(fr){fr.removeAttribute('animation__bob');fr.setAttribute('visible','false');}
      } else if(GS.phase === 'AWAITING_OPERAND') {
        doDropToForge();
      } else {
        doExecute(); 
      }
    }
    else if(activeId==='mk-registers') { 
       if(GS.phase==='EXECUTED') doWriteback();
       else if(GS.phase==='AWAITING_OPERAND' || GS.phase==='FORGE_WAITING_DATA') doLoad();
       else if(GS.inventory.length > 0 && (GS.inventory[0].state==='data-raw'||GS.inventory[0].state==='data-result')) doDropToRegister();
       else doPullFromRegister();
    }
    else if(activeId==='mk-ram') doRAMFetch();
    else if(activeId==='mk-debugger') { playAlarm(); doDebug(); }
    
    if(hint)hint.textContent='SUCCESS!';
  } else {
    if(activeId==='mk-registers') hint.textContent='PULL BACK TO LOAD | TAP TO STORE';
    else if(activeId==='mk-ram') hint.textContent='PULL BACK TO FETCH RAM';
    else if(activeId==='mk-alu') hint.textContent='SHAKE TO FORGE (ALU)';
    else hint.textContent='PULL BACK TO GRAB';
  }
}





AFRAME.registerComponent('interaction-tracker',{
  tick: function(){ _tickGestures(); }
});

window.addEventListener('load',()=>{
  _initMarkers();initMotion();startBelt();updateHUD();
  const scene=document.querySelector('a-scene');
  if(scene) scene.setAttribute('interaction-tracker', '');
  log('Steampunk FDE Workshop ready!');
});


