const GS = {
  phase:'IDLE',
  inventory:[],
  maxSlots:1,
  clockCycles:0,
  heat:0,
  level:1,
  programQueue:['Render Frame 1','Calc Physics Vector','Draw Pixel Row','Execute Shader','Rasterize Tri'],
  registers:{R0:42,R1:17,R2:99,R3:0,R4:0},
  currentTicket:null,
  result:null,
  shakeInProgress:false
};

// HUD updates moved to gameplay.js


function log(msg){
  const d=document.getElementById('log-panel');if(!d)return;
  const t=new Date().toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const div=document.createElement('div');div.textContent='['+t+'] '+msg;
  d.insertBefore(div,d.firstChild);
  while(d.children.length>7)d.removeChild(d.lastChild);
}

// Heat system
function heatTick(){
  GS.heat=Math.max(0,GS.heat-.4);updateHUD();
  document.getElementById('heat-vignette').style.opacity=GS.heat>70?(GS.heat-70)/50:0;
}
setInterval(heatTick,500);
setInterval(()=>{GS.heat=Math.min(100,GS.heat+.25);updateHUD();},2000);

// Motion controls
let _lastX=0;
function initMotion(){
  const listen=()=>{
    window.addEventListener('devicemotion',e=>{
      const a=e.accelerationIncludingGravity;if(!a)return;
      const sc=document.querySelector('a-scene');if(!sc)return;
      if(a.y>13) sc.emit('gesture-lift');
      if(a.y<-13) sc.emit('gesture-drop');
      if(GS.shakeInProgress){const dx=Math.abs((a.x||0)-_lastX);if(dx>12)sc.emit('gesture-shake');}
      _lastX=a.x||0;
    });
  };
  if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
    DeviceMotionEvent.requestPermission().then(s=>{if(s==='granted')listen();}).catch(listen);
  } else listen();
}

// Shake progress system
let _shakeCnt=0,_shakeTgt=20,_shakeCb=null,_shakeH=null;
function startShake(target,cb){
  _shakeCnt=0;_shakeTgt=target;_shakeCb=cb;GS.shakeInProgress=true;
  document.getElementById('shake-indicator').style.display='block';
  document.getElementById('shake-progress').style.width='0%';
  const sc=document.querySelector('a-scene');
  if(_shakeH)sc.removeEventListener('gesture-shake',_shakeH);
  _shakeH=()=>{
    _shakeCnt++;
    document.getElementById('shake-progress').style.width=(_shakeCnt/_shakeTgt*100)+'%';
    GS.heat=Math.min(100,GS.heat+.4);
    playShake();
    if(_shakeCnt>=_shakeTgt){
      GS.shakeInProgress=false;
      document.getElementById('shake-indicator').style.display='none';
      sc.removeEventListener('gesture-shake',_shakeH);_shakeH=null;
      playDing();if(_shakeCb)_shakeCb();
    }
  };
  sc.addEventListener('gesture-shake',_shakeH);
}
// Fallback: desktop shake button
function simulateShake(){if(GS.shakeInProgress&&_shakeH)_shakeH();}
