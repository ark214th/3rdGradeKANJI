// 漢字の塔 — 音（Web Audio だけで鳴らす。外部の音声ファイルは使わない）。
// BGM は 場面ごとに 3曲（home／battle／boss）。効果音は sfx(名前)。音を消す設定は この端末に 保存する。
"use strict";
(function(){
let ctx=null,master,music,fx,noiseBuf,timer=null,song=null,step=0,nextT=0;
const KEY='kanjiTower_sound';
let muted=false;try{muted=localStorage.getItem(KEY)==='off'}catch(e){}

// 音名 → 周波数（"A4" "C#5" "Bb2"）
function hz(n){const m=/^([A-G])(#|b)?(\d)$/.exec(n);if(!m)return 0;const b={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);return 440*Math.pow(2,(b+12*(+m[3]+1)-69)/12)}
const seq=s=>s.split(/\s+/).filter(x=>x&&x!=='|');

// 曲（8分音符の ます目。"." は 休み）
const SONGS={
  home:{bpm:104,mel:seq('E5 G5 C6 G5 A5 G5 E5 D5 | C5 E5 G5 E5 F5 E5 D5 . | E5 G5 C6 D6 E6 D6 C6 A5 | G5 E5 D5 E5 C5 . . .'),
    bass:seq('C3 . G3 . F3 . G3 . | A2 . E3 . F3 . G3 . | C3 . G3 . A2 . F3 . | G3 . G2 . C3 . . .'),drum:'k.h.s.h.',wave:'triangle',vol:.05},
  battle:{bpm:152,mel:seq('A4 C5 E5 A5 G5 E5 C5 E5 | F5 E5 D5 C5 D5 . B4 . | A4 C5 E5 A5 B5 A5 G5 E5 | F5 G5 A5 G5 E5 . E5 .'),
    bass:seq('A2 A3 A2 A3 F2 F3 F2 F3 | D3 D2 D3 D2 E2 E3 E2 E3 | A2 A3 A2 A3 F2 F3 G2 G3 | D3 D2 E3 E2 A2 . A2 .'),drum:'khshkhsh',wave:'square',vol:.035},
  boss:{bpm:168,mel:seq('D5 . F5 D5 A5 . G5 F5 | E5 . G5 E5 C6 . A5 . | D5 . F5 D5 A5 . D6 C6 | A5 G5 F5 E5 D5 . C#5 .'),
    bass:seq('D2 D2 D3 D2 D2 D2 D3 D2 | C2 C2 C3 C2 C2 C2 C3 C2 | Bb1 Bb1 Bb2 Bb1 A1 A1 A2 A1 | D2 D2 D3 D2 A1 A1 A2 A1'),drum:'kkskkhsk',wave:'sawtooth',vol:.028},
};

function init(){
  if(ctx)return true;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  try{ctx=new AC()}catch(e){return false}
  master=ctx.createGain();master.gain.value=muted?0:1;master.connect(ctx.destination);
  music=ctx.createGain();music.gain.value=.9;music.connect(master);
  fx=ctx.createGain();fx.gain.value=1;fx.connect(master);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  return true;
}
// iPad では さいしょの タッチの あとでないと 音が出ない
function unlock(){if(!init())return;if(ctx.state==='suspended')ctx.resume();if(song&&!timer)startLoop()}
function tone(out,f,t,d,type,vol,slide){if(!f)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0008,t+d);o.connect(g).connect(out);o.start(t);o.stop(t+d+.02)}
function noise(out,t,d,vol,hp){const s=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();s.buffer=noiseBuf;f.type=hp?'highpass':'lowpass';f.frequency.value=hp||1200;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+d);s.connect(f).connect(g).connect(out);s.start(t);s.stop(t+d+.02)}

/* ---------- BGM ---------- */
function startLoop(){if(!ctx||ctx.state!=='running'&&ctx.state!=='suspended')return;clearInterval(timer);nextT=ctx.currentTime+.08;timer=setInterval(schedule,25)}
function schedule(){
  if(!song||!ctx)return;const sp=60/song.bpm/2;
  while(nextT<ctx.currentTime+.12){
    const i=step%song.mel.length,dr=song.drum[step%song.drum.length];
    tone(music,hz(song.mel[i]),nextT,sp*.9,song.wave,song.vol);
    tone(music,hz(song.bass[i%song.bass.length]),nextT,sp*.95,'triangle',.07);
    if(dr==='k')tone(music,140,nextT,.12,'sine',.18,40);
    if(dr==='s')noise(music,nextT,.12,.08,1500);
    if(dr==='h'||dr==='s'||dr==='k')noise(music,nextT,.03,.025,7000);
    step++;nextT+=sp;
  }
}
function play(name){
  const s=SONGS[name]||null;if(s===song)return;song=s;step=0;
  if(!s){clearInterval(timer);timer=null;return}
  if(ctx)startLoop();
}

/* ---------- 効果音 ---------- */
const SFX={
  ok:n=>{const t=ctx.currentTime;tone(fx,440+Math.min(n||0,12)*40,t,.09,'square',.07)},
  no:()=>{const t=ctx.currentTime;tone(fx,170,t,.18,'sawtooth',.05,90)},
  tap:()=>tone(fx,880,ctx.currentTime,.05,'square',.04),
  hit:big=>{const t=ctx.currentTime;tone(fx,big?240:340,t,.14,'sawtooth',.09,big?60:120);noise(fx,t,.12,.12,800);tone(fx,1000,t+.01,.05,'square',.04)},
  crit:()=>{const t=ctx.currentTime;tone(fx,1200,t,.08,'square',.06);tone(fx,1800,t+.06,.12,'square',.06);noise(fx,t,.2,.15,600)},
  block:()=>{const t=ctx.currentTime;tone(fx,1500,t,.12,'triangle',.08);tone(fx,2200,t+.02,.1,'triangle',.05);noise(fx,t,.06,.06,3000)},
  enemy:()=>{const t=ctx.currentTime;tone(fx,300,t,.2,'square',.05,150)},
  breath:()=>{const t=ctx.currentTime;noise(fx,t,.6,.18,300);tone(fx,120,t,.6,'sawtooth',.06,60)},
  roar:()=>{const t=ctx.currentTime;tone(fx,90,t,.9,'sawtooth',.12,45);tone(fx,135,t,.9,'square',.05,60);noise(fx,t,.9,.14,200)},
  warn:()=>{const t=ctx.currentTime;for(let i=0;i<3;i++){tone(fx,660,t+i*.36,.16,'square',.07);tone(fx,440,t+i*.36+.18,.16,'square',.07)}},
  charge:()=>{const t=ctx.currentTime;tone(fx,200,t,.7,'sawtooth',.05,1600);noise(fx,t,.7,.05,2000)},
  boom:()=>{const t=ctx.currentTime;tone(fx,160,t,.7,'sine',.25,30);noise(fx,t,.8,.25,150);tone(fx,880,t,.3,'square',.05,220)},
  kill:()=>{const t=ctx.currentTime;[523,784,1047].forEach((f,i)=>tone(fx,f,t+i*.07,.14,'square',.06))},
  coin:()=>{const t=ctx.currentTime;tone(fx,988,t,.07,'square',.06);tone(fx,1319,t+.07,.18,'square',.06)},
  lvup:()=>{const t=ctx.currentTime;[392,523,659,784,1047,1319].forEach((f,i)=>tone(fx,f,t+i*.09,.18,'triangle',.11))},
  win:()=>{const t=ctx.currentTime;[523,523,523,659,784,0,659,784].forEach((f,i)=>tone(fx,f,t+i*.11,i===7?.5:.1,'square',.08));[262,330,392].forEach((f,i)=>tone(fx,f,t+.77+i*.0,.5,'triangle',.08))},
  climb:()=>{const t=ctx.currentTime;tone(fx,260,t,.5,'triangle',.08,780)},
  hop:()=>tone(fx,600,ctx.currentTime,.08,'triangle',.05,900),
  shake:k=>{const t=ctx.currentTime;tone(fx,200+(k||1)*60,t,.08,'square',.05);noise(fx,t,.08,.06,1000)},
  open:()=>{const t=ctx.currentTime;[659,784,988,1319,1568].forEach((f,i)=>tone(fx,f,t+i*.06,.3,'triangle',.08));noise(fx,t,.4,.06,4000)},
  heal:()=>{const t=ctx.currentTime;[523,659,784,1047].forEach((f,i)=>tone(fx,f,t+i*.08,.25,'sine',.08))},
};
function sfx(name,arg){if(!ctx||muted)return;try{SFX[name]&&SFX[name](arg)}catch(e){}}
function setMuted(m){muted=!!m;try{localStorage.setItem(KEY,muted?'off':'on')}catch(e){}if(master)master.gain.value=muted?0:1}

window.TowerSound={unlock,play,sfx,get muted(){return muted},setMuted,toggle(){setMuted(!muted);return muted}};
})();
