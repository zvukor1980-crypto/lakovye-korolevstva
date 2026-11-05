/** Original procedural chamber score. Synthesized instruments, not live recordings. */
let ctx, master, timer, enabled=false, level=.4, scene='map', step=0, next=0;
const active=new Set();
const chords=[[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,61]];
const melody=[74,0,77,76,74,69,72,0,70,0,74,72,70,65,69,0,72,0,76,74,72,67,69,0,73,0,76,74,73,69,67,0];
const hz=n=>440*2**((n-69)/12);
function note(n,t,d,v,kind='harp') {
 const g=ctx.createGain();g.connect(master);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+(kind==='strings'?.25:.025));g.gain.exponentialRampToValueAtTime(.0001,t+d);
 const partials=kind==='harp'?[[1,1],[2,.28],[3,.1]]:kind==='strings'?[[1,.65],[2,.2],[3,.09]]:[[1,1],[2,.06]];
 let remaining=partials.length;
 for(const [ratio,amp] of partials){
  const o=ctx.createOscillator(),a=ctx.createGain();o.type='sine';o.frequency.value=hz(n)*ratio;
  if(kind==='strings')o.detune.value=ratio===1?-4:4;
  a.gain.value=amp;o.connect(a);a.connect(g);active.add(o);
  o.onended=()=>{active.delete(o);o.disconnect();a.disconnect();if(!--remaining)g.disconnect();};o.start(t);o.stop(t+d+.05);
 }
}
function schedule(){
 if(!enabled||!ctx||ctx.state!=='running')return;
 const beat=scene==='battle'?.29:.43;
 if(next<ctx.currentTime-.5)next=ctx.currentTime+.04;
 while(next<ctx.currentTime+.18){
  const chord=chords[Math.floor(step/8)%4],i=step%8;
  note(chord[[0,1,2,3,2,1,3,1][i]]+12,next,1.1,.045,'harp');
  if(i===0){note(chord[0]-12,next,beat*7,.045,'strings');note(chord[2],next,beat*7,.018,'strings');}
  const m=melody[step%32];if(m&&step%2===0)note(m,next,beat*1.8,.035,'flute');
  if(scene==='battle'&&i%2===0)note(chord[0]-12,next,.13,.065);
  step++;next+=beat;
 }
}
export function setMusicScene(value){scene=value;}
export function ensureMusic(on,volume=.4){
 enabled=!!on;level=Math.max(0,Math.min(1,Number(volume)||0));
 if(!enabled){stopMusic();return;}
 if(document.hidden)return;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  if(!ctx){ctx=new AC();master=ctx.createGain();master.connect(ctx.destination);}
  master.gain.setTargetAtTime(level*2.2,ctx.currentTime,.1);
  const start=()=>{if(!enabled||document.hidden)return;if(!timer){next=ctx.currentTime+.04;timer=setInterval(schedule,100);schedule();}};
  if(ctx.state!=='running')return ctx.resume().then(()=>{start();return ctx.state==='running';}).catch(()=>false);
  start();return ctx.state==='running';
 }catch{return false;}
}
export function stopMusic(){
 enabled=false;clearInterval(timer);timer=null;
 for(const o of active){try{o.stop();}catch{}}active.clear();
 if(ctx&&master)master.gain.setValueAtTime(0,ctx.currentTime);
}
let voiceOn=false,lastSpoken=0;
export function configureVoice(on){voiceOn=!!on;if(!voiceOn&&window.speechSynthesis)window.speechSynthesis.cancel();}
export function speak(line,force=false){
 if(!voiceOn||document.hidden||!window.speechSynthesis||(!force&&Date.now()-lastSpoken<6000))return;
 const voice=window.speechSynthesis.getVoices().find(v=>/^ru/i.test(v.lang));
 if(!voice)return;
 window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(line);u.lang='ru-RU';u.voice=voice;u.rate=.94;u.volume=.8;
 lastSpoken=Date.now();window.speechSynthesis.speak(u);
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){clearInterval(timer);timer=null;if(ctx)ctx.suspend().catch(()=>{});if(window.speechSynthesis)window.speechSynthesis.cancel();}
 else if(enabled)ensureMusic(true,level);
});
