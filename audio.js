const AC = new (window.AudioContext || window.webkitAudioContext)();
function beep(freq,dur,vol,type){
  try {
    const o=AC.createOscillator(),g=AC.createGain();
    o.connect(g);g.connect(AC.destination);
    o.frequency.value=freq||440;o.type=type||'sine';
    g.gain.setValueAtTime(vol||0.3,AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+(dur||0.1));
    o.start();o.stop(AC.currentTime+(dur||0.1));
  } catch(e){}
}
function haptic(p){if(navigator.vibrate)try{navigator.vibrate(p);}catch(e){}}
function playDrop(){beep(180,.18,.5,'sawtooth');haptic([50]);}
function playShake(){beep(320,.05,.15,'square');}
function playDing(){beep(880,.18,.4);setTimeout(()=>beep(1100,.2,.3),120);haptic([30,50,110]);}
function playBuzz(){beep(80,.3,.5,'sawtooth');haptic([200]);}
function playAlarm(){[380,190,380,190].forEach((f,i)=>setTimeout(()=>beep(f,.12,.4,'square'),i*130));haptic([60,50,60,50,220]);}
function playLevelUp(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.15,.4),i*150));haptic([40,30,40,30,150]);}

// 🤖 STEAMPUNK SFX
function playSteam(){ beep(120,.4,.2,'sawtooth'); }
function playClick(){ beep(600,.04,.3); }
function playClunk(){ beep(110,.12,.5,'sawtooth'); haptic(80); }
function playWhir(){ [440,554,659].forEach((f,i)=>setTimeout(()=>beep(f,.08,.2),i*60)); }
function playGrind(){ beep(90,.8,.15,'sawtooth'); haptic([10,20,10,20]); }

