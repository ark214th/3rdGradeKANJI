// 漢字の塔 — 画面の動き。判定・出題の順番・ごほうびの計算は tower-core.js、3Dの絵は scene.mjs。
"use strict";
(function(){
const C=TowerCore,ST=StrokeTrace;
const $=id=>document.getElementById(id);
const COLORS=['#f08a00','#1e88e5','#43a047','#8e44ad'],CHIP=['#ffb347','#6ec6ff','#b9f18c','#d7b0ff'];
const STEP_NAME={meet:'であう',pick:'どの字？',build:'くみたて',order:'書きじゅん',trace:'なぞる',recall:'思い出して 書く',part:'部品えらび'};
// 3Dの絵（読み込めないときは 何もしない）
const scene=(fn,...a)=>{try{if(window.TowerScene)return window.TowerScene[fn](...a)}catch(e){}};

/* ---------- 保存（塔だけのキー。第1〜4章の記録にはさわらない） ---------- */
const SAVE_KEY='kanjiTower_v1';
const blank=()=>({v:1,hero:{xp:0,gold:0,floor:0,owned:['w0'],weapon:'w0'},range:'',ranges:{},dayOffset:0});
const blankRange=()=>({recs:{},startDay:0,tq:{},ink:{},crest:0,day:{d:0,floors:0,chest:false,boss:false}});
function loadSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(!s||typeof s!=='object')return blank();const b=blank();
  s.hero=Object.assign(b.hero,s.hero||{});if(!Array.isArray(s.hero.owned)||!s.hero.owned.includes('w0'))s.hero.owned=['w0'];if(!s.ranges||typeof s.ranges!=='object')s.ranges={};
  return Object.assign(b,s)}catch(e){return blank()}}
let save=loadSave();
function store(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch(e){}}
const today=()=>C.dayKey(new Date(),save.dayOffset|0);

/* ---------- テスト範囲（data/<id>.js を 必要なときに読みこむ） ---------- */
let RANGE=null,STROKES={},MODELS={},BYK={};
const LIST=window.TOWER_RANGE_LIST||[];
function loadRange(id,done){
  const use=()=>{RANGE=window.TOWER_RANGES[id];STROKES=RANGE.strokes;MODELS={};BYK={};for(const e of RANGE.kanji){MODELS[e.k]=C.prep(STROKES[e.k]);BYK[e.k]=e}
    save.range=id;if(!save.ranges[id])save.ranges[id]=blankRange();else save.ranges[id]=Object.assign(blankRange(),save.ranges[id]);store();done()};
  if(window.TOWER_RANGES&&window.TOWER_RANGES[id])return use();
  const s=document.createElement('script');s.src=`data/${id}.js`;s.onload=use;s.onerror=()=>alert('テストの はんいを 読みこめませんでした：'+id);document.head.appendChild(s);
}
const R=()=>save.ranges[save.range];
const entryOf=k=>BYK[k];
const lvOf=k=>C.lvOf(R().recs[k],entryOf(k));
const met=k=>!!R().recs[k];
const guide=()=>C.guide(R().recs,RANGE.kanji,today(),R().startDay||today());
const nextFloor=()=>C.nextFloor(R().recs,RANGE.kanji,today());
const examOk=()=>RANGE.questions.filter(q=>R().tq[q.id]&&R().tq[q.id].r==='good').length;
// きょうの記録（のぼった かい数、たからばこ、ボス）
function day(){const r=R();if(!r.day||r.day.d!==today())r.day={d:today(),floors:0,chest:false,boss:false};return r.day}

/* ---------- 音（Web Audio） ---------- */
let actx=null;
function beep(f,d,type,vol,when,slide){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();const t=actx.currentTime+(when||0),o=actx.createOscillator(),g=actx.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);g.gain.setValueAtTime(vol||.07,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(actx.destination);o.start(t);o.stop(t+d)}catch(e){}}
const sfx={ok:n=>beep(440+Math.min(n||0,12)*40,.09,'square'),no:()=>beep(150,.16,'sawtooth',.05),
  hit:big=>{beep(big?220:330,.14,'sawtooth',.09,0,big?60:120);beep(900,.06,'square',.05,.02)},
  win:()=>[523,659,784,1047].forEach((f,i)=>beep(f,.18,'triangle',.1,i*.12)),
  coin:()=>{beep(988,.07,'square',.06);beep(1319,.16,'square',.06,.07)},
  lvup:()=>[392,523,659,784,1047,1319].forEach((f,i)=>beep(f,.16,'triangle',.11,i*.09)),
  climb:()=>beep(260,.5,'triangle',.08,0,780)};

/* ---------- 共通 ---------- */
let sceneHost='';
function attachScene(){const battle=$('quest').classList.contains('active');const id=battle?'battleScene':'homeScene';
  if(scene('attach',$(id),battle?'battle':'home')!==false&&window.TowerScene){sceneHost=id;scene('setZone',C.zoneOf(save.hero.floor));scene('setWeapon',C.weaponOf(save.hero.weapon))}}
function show(id){for(const s of document.querySelectorAll('.screen'))s.classList.toggle('active',s.id===id);attachScene();if(id==='quest')requestAnimationFrame(fit)}
addEventListener('towerscene',attachScene);
function banner(text,ms){const b=$('banner');b.textContent=text;b.classList.add('on');clearTimeout(banner.t);banner.t=setTimeout(()=>b.classList.remove('on'),ms||1100)}
function msg(text,type){const m=$('msg');m.textContent=text;m.className='msg'+(type?' '+type:'')}
function anim(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const stars=lv=>'★'.repeat(lv)+'☆'.repeat(C.MAX_LV-lv);
const hex=n=>'#'+n.toString(16).padStart(6,'0');
const GUIDE='<path d="M54.5,3V106M3,54.5H106" stroke="#d9d2bd" stroke-width=".5" stroke-dasharray="2 2" fill="none"/>';
const pathOf=(d,color,w,extra)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w||5}" stroke-linecap="round" stroke-linejoin="round"${extra||''}/>`;
const polyD=pts=>'M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L');
// 字ぜんたい。color(i) で画ごとの色
function kanjiSvg(k,color,w){const e=entryOf(k);return STROKES[k].map((d,i)=>pathOf(d,color?color(i):COLORS[C.partOf(e,i)],w)).join('')}
// 部品だけを、わくいっぱいに見せる
function pieceSvg(src,from,to,color){const M=C.prep(STROKES[src]),b=C.boxOf(M,from,to,6),s=Math.max(b[2]-b[0],b[3]-b[1]),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  return `<svg viewBox="${(cx-s/2).toFixed(1)} ${(cy-s/2).toFixed(1)} ${s.toFixed(1)} ${s.toFixed(1)}">${STROKES[src].slice(from-1,to).map(d=>pathOf(d,color||'#2b2760',s/16)).join('')}</svg>`}
// ごほうびを足す。レベルが上がったら 新しいレベルを返す
function gain(g){const h=save.hero,before=C.levelOf(h.xp);h.gold+=g.gold|0;h.xp+=g.xp|0;const after=C.levelOf(h.xp);return after>before?after:0}
function showGain(g,lv){$('winGain').innerHTML=(g.gold?`<span>🪙 +${g.gold} G</span>`:'')+(g.xp?`<span>⭐ +${g.xp}</span>`:'');$('winLv').textContent=lv?`🎉 レベルアップ！ Lv ${lv}`:'';if(lv){sfx.lvup();scene('levelUp')}else if(g.gold)sfx.coin()}

/* ---------- ホーム ---------- */
function renderHome(){
  const h=save.hero,w=C.weaponOf(h.weapon),g=guide(),list=nextFloor(),d=day(),zone=C.zoneOf(h.floor);
  $('hudLv').textContent=`Lv ${C.levelOf(h.xp)}`;$('hudXp').style.width=Math.round(C.levelProgress(h.xp)*100)+'%';$('hudGold').textContent=h.gold;
  $('hudWeapon').textContent=w.name;$('hudAtk').textContent=`こうげき ${C.attackOf(h.xp,h.weapon)}`;$('rangeTitle').textContent=RANGE.title;
  $('floorNum').textContent=`${h.floor+1}かい`;$('zoneName').textContent=zone.name;
  const n=RANGE.kanji.length,seen=RANGE.kanji.filter(e=>met(e.k)).length,solid=RANGE.kanji.filter(e=>met(e.k)&&lvOf(e.k)>=C.MAX_LV).length;
  $('meterSeen').style.width=100*seen/n+'%';$('meterSolid').style.width=100*solid/n+'%';
  $('collectNote').textContent=`なかまの 漢字 ${seen}/${n}（★3つ ${solid}）`+(R().crest?`　${R().crest>1?'🏆':'🎖️'} ボスげきは`:'');
  // きょうの たからばこ：体の数ではなく「あと 何かい」で見せる。長い日も 6目もりまで
  const total=Math.max(1,d.floors+g.floors),segs=Math.min(6,total),on=d.chest?segs:Math.min(segs-(g.floors?1:0),Math.floor(d.floors/total*segs));
  $('chestSegs').innerHTML=Array.from({length:segs},(_,i)=>`<i class="${i<on?'on':''}"></i>`).join('');
  $('chestLabel').textContent=d.chest?'きょうの たからばこ ゲット！ まだ のぼっても いいよ':g.floors?`たからばこまで あと ${g.floors}かい`:'たからばこまで あと すこし';
  $('chestBox').textContent=d.chest?'👑':'🎁';$('chestBox').className='box'+(d.chest?'':' open');
  const TAG={due:['ふっかつ',''],new:['あたらしい','new'],check:['たしかめ','new'],extra:['おまけ','']};
  $('nexts').innerHTML=list.map(x=>{const e=entryOf(x.k),m=met(x.k);return `<div class="next"><div class="k kyo">${m?x.k:'？'}</div><small>${e.name}</small><span class="tag ${TAG[x.kind][1]}">${TAG[x.kind][0]}</span></div>`}).join('');
  // テストは いつ来るか わからないので、日数は出さない。ぜんぶの字に出会ったら、ボス（テストと同じ問題）を すすめる
  const ready=seen===n&&examOk()<RANGE.questions.length;
  $('openExam').className=ready?'rec':'';
  $('examNote').textContent=(ready?'ぜんぶの字に 出会った！ ボス（テストと同じ問題）に いどもう。　':'')+`ボスの問題 ○ ${examOk()}/${RANGE.questions.length}`;
}
$('go').onclick=()=>{const list=nextFloor();if(list.length)startQuest(list)};

/* ---------- れんしゅう（1字＝まもの1体。ステップを1つ終えるたびに こうげき） ---------- */
let Q=null,S=null,X=null; // Q: 1かい ぶんの流れ、S: いまのステップの状態、X: ボス
function startQuest(list,trialLv){Q={list,qi:0,trial:trialLv!=null,trialLv,gold:0,xp:0};X=null;show('quest');startKanji()}
function startKanji(){const it=Q.list[Q.qi],k=it.k;Q.k=k;Q.kind=it.kind;Q.e=entryOf(k);Q.M=MODELS[k];Q.lv=Q.trial?Q.trialLv:lvOf(k);Q.first=Q.trial?Q.lv===0:!met(k);
  Q.steps=C.stepsFor(Q.lv,Q.e);Q.si=0;Q.result='good';Q.fix=false;Q.slips=0;
  $('ename').textContent=Q.e.name;scene('spawn',{mon:Q.e.mon,hue:Q.e.hue});startStep()}
function renderBar(){$('stepLabel').textContent=`${Q.qi+1}/${Q.list.length}体目　${STEP_NAME[Q.steps[Q.si]]||'たおした！'}`;
  $('pips').innerHTML=Q.steps.map((_,i)=>`<i class="${i<Q.si?'off':''}"></i>`).join('')}
function setQuestion(showKanji){const q=Q.e.q.replace(/\[(.+?)\]/,showKanji&&!Q.e.note?`<b>${Q.k}</b>`:'<b>$1</b>');$('question').innerHTML=q+(Q.e.note?`<small style="font-size:15px;color:var(--sub)">　（きいろの ${Q.e.note}${showKanji?`＝「${Q.k}」`:''}）</small>`:'')}
function buttons(list){$('actions').innerHTML='';for(const b of list){const el=document.createElement('button');el.textContent=b.text;el.className=b.cls||'';el.onclick=b.fn;if(b.id)el.dataset.id=b.id;$('actions').appendChild(el)}}
function startStep(){S={type:Q.steps[Q.si]};$('tray').innerHTML='';buttons([]);renderBar();STEP[S.type]()}
// ダメージの数字（武器とレベルで 大きくなる。えんしゅつだけ）
function damage(big){const base=C.attackOf(save.hero.xp,save.hero.weapon),v=Math.round(base*5*(big?3:1)*(0.85+Math.random()*0.3));
  const d=document.createElement('div');d.className='dmg'+(big?' big':'');d.textContent=v;$('battleScene').appendChild(d);setTimeout(()=>d.remove(),700);sfx.hit(big)}
function slip(){Q&&Q.slips++;sfx.no();scene('miss');anim($('stage'),'shake')}
function stepDone(text){
  Q.si++;renderBar();S.lock=true;const last=Q.si>=Q.steps.length;
  scene('attack',{big:last,done:()=>damage(last)});if(!window.TowerScene)damage(last);
  if(!last){banner(text||'ヒット！',800);return setTimeout(startStep,850)}
  // えらぶ問題で まちがえたときは、書けても「おしい」あつかい（出来に合わせて もう一度 出す）
  const result=Q.result==='good'&&Q.slips>0&&Q.lv>=1?'close':Q.result,r=R(),prev=r.recs[Q.k];
  const before=Q.lv,rec=C.advance(Q.trial?{lv:Q.lv}:prev,result,today(),Q.e);
  let g={gold:0,xp:0},lv=0;
  if(!Q.trial){r.recs[Q.k]=rec;if(!r.startDay)r.startDay=today();
    g=C.rewardFor({kind:Q.kind,result,slips:Q.slips,star3:rec.lv===C.MAX_LV&&before<C.MAX_LV,repeat:!!prev&&prev.last===today()});lv=gain(g);Q.gold+=g.gold;Q.xp+=g.xp;store()}
  setTimeout(()=>{sfx.win();scene('die')},420);
  setTimeout(()=>{
    $('winTitle').textContent=`${Q.e.name}を たおした！`;
    $('winStars').innerHTML=`<span class="kyo">${Q.k}</span> <span style="color:var(--gold)">${stars(rec.lv)}</span>`;
    $('winText').textContent=result==='forgot'?'だいじょうぶ。すぐ もう一度、お手本つきで おぼえよう。':result==='close'?'おしい！ あした もう一度 たたかおう。':Q.first?`「${Q.k}」が なかまに なった！`+(Q.e.parts.length>1?' 部品も 手に入れた。':''):rec.lv>before?`「${Q.k}」が レベルアップ！`:before>=C.MAX_LV?`「${Q.k}」は もう かんぺき！`:'書けた！ ★3つめは、べつの日に もう一度 書けたら もらえるよ。';
    $('winChips').innerHTML=Q.first&&Q.e.parts.length>1?Q.e.parts.map((p,i)=>`<span class="chip kyo" style="background:${CHIP[i%4]}">${p.name}</span>`).join(''):'';
    showGain(g,lv);$('winOv').classList.add('on');
  },1250);
}
function goHome(){Q=null;X=null;S=null;setStage(1);renderHome();show('home')}
$('winOk').onclick=()=>{$('winOv').classList.remove('on');
  if(X||!Q||Q.done||Q.trial)return goHome();
  if(Q.qi<Q.list.length-1){Q.qi++;return startKanji()}
  // 1かい のぼった
  const h=save.hero,d=day(),zoneBefore=C.zoneIndex(h.floor);h.floor++;d.floors++;Q.done=true;
  let g=Object.assign({},C.BONUS.floor),chest=false;
  if(!d.chest&&guide().count===0){d.chest=true;chest=true;g.gold+=C.BONUS.daily.gold;g.xp+=C.BONUS.daily.xp}
  const lv=gain(g);store();
  sfx.climb();scene('climb');$('fade').classList.add('on');setTimeout(()=>{$('fade').classList.remove('on');scene('setZone',C.zoneOf(h.floor))},380);
  const zoneNow=C.zoneIndex(h.floor)!==zoneBefore,rest=guide().floors;
  $('winTitle').textContent=zoneNow?`✨ あたらしい エリア「${C.zoneOf(h.floor).name}」！`:`🎉 ${h.floor+1}かいへ のぼった！`;
  $('winStars').textContent=chest?'🎁':'🗼';
  $('winText').textContent=chest?'きょうの たからばこを 手に入れた！ まだ のぼっても、ここで おわっても いいよ。':d.chest?'いい ちょうし！ すきなだけ のぼって いいよ。':`たからばこまで あと ${rest}かい。つづけても、ひと休みしても いいよ。`;
  $('winChips').innerHTML='';showGain(g,lv);$('winOv').classList.add('on')};
$('retreat').onclick=goHome;

const stage=$('stage');
let CELLS=1; // マスの数（ボスでは 答えの文字数ぶん 横にならべる）
function setStage(n){CELLS=n;stage.setAttribute('viewBox',`0 0 ${109*n} 109`);fit()}
function fit(){const b=$('board');if(!b.clientWidth)return;const w=Math.floor(Math.max(160,Math.min(b.clientWidth-8,(b.clientHeight-8)*CELLS)));stage.style.width=w+'px';stage.style.height=Math.floor(w/CELLS)+'px'}
addEventListener('resize',()=>{fit();setTimeout(fit,300)});
function pt(ev){const r=stage.getBoundingClientRect();return[(ev.clientX-r.left)/r.width*109*CELLS,(ev.clientY-r.top)/r.height*109]}
const dot=(p,n)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.8" fill="#22b455"/>`+(n?`<text x="${p[0]}" y="${p[1]+1.7}" font-size="4.8" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>`:'');
// くみたてに まぜる にせもの：部品ごとの「にている部品」から 1つずつ（合計3つまで）
function decoysOf(e){const out=[],seen=new Set();for(let r=0;r<3&&out.length<3;r++)for(const p of e.parts){const d=(p.alts||[])[r],id=d&&d.src+d.from+'-'+d.to;if(d&&!seen.has(id)&&out.length<3){seen.add(id);out.push(d)}}return out}

const STEP={
  /* であう：部品に分けて、書き順を見せる */
  meet(){
    setQuestion(true);msg(Q.e.memo);
    const draw=()=>{stage.innerHTML=GUIDE+STROKES[Q.k].map((d,i)=>`<path d="${d}" fill="none" stroke="${COLORS[C.partOf(Q.e,i)%4]}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" from="1" to="0" dur="0.4s" begin="indefinite" fill="freeze"/></path>`).join('');
      stage.querySelectorAll('animate').forEach((a,i)=>setTimeout(()=>{try{a.beginElement()}catch(e){}},i*450))};
    draw();
    $('tray').innerHTML=Q.e.parts.map((p,i)=>`<span class="chip kyo" style="background:${CHIP[i%4]};font-size:18px">${p.name}</span>`).join('<b style="align-self:center">＋</b>');
    buttons([{text:'▶ もう一回 見る',cls:'ghost',fn:draw},{text:'おぼえた！ つぎへ',cls:'primary',fn:()=>{if(!S.lock)stepDone('であった！')}}]);
  },
  /* どの字？：読みから字をえらぶ。まぎらわしい字が まざる */
  pick(){
    setQuestion(false);msg('きいろい ところは、どの漢字？ にている字に 注意！');stage.innerHTML=GUIDE+'<text x="54.5" y="72" font-size="50" text-anchor="middle" fill="#c9c5d8">？</text>';
    const opts=shuffle([Q.k].concat([...Q.e.alts]));
    $('tray').innerHTML=opts.map(k=>`<button class="opt kyo" data-k="${k}">${k}</button>`).join('');
    for(const b of $('tray').children)b.onclick=()=>{if(S.lock)return;
      if(b.dataset.k===Q.k){sfx.ok();stage.innerHTML=GUIDE+kanjiSvg(Q.k);setQuestion(true);stepDone('せいかい！')}
      else{slip();b.classList.add('no');b.disabled=true;msg('にているけど、ちがう字だよ。形を よく 見て、もう一度。','bad')}};
  },
  /* 部品えらび：ぬけている部品を、にている部品の中から えらぶ */
  part(){
    setQuestion(false);
    const n=Q.e.parts.length,j=((R().recs[Q.k]&&R().recs[Q.k].seen)|0)%n,p=Q.e.parts[j],b=C.boxOf(Q.M,p.from,p.to,4);
    const draw=done=>{stage.innerHTML=GUIDE+Q.e.parts.map((q,i)=>i===j&&!done?`<rect class="slot hot" x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" rx="4"/>`:STROKES[Q.k].slice(q.from-1,q.to).map(d=>pathOf(d,i===j?COLORS[i%4]:'#2b2760',5)).join('')).join('')};
    draw(false);msg('きいろい わくに 入る 部品は どれ？ にている 部品に 注意！');
    const tiles=shuffle([{ok:true,src:Q.k,from:p.from,to:p.to}].concat(p.alts.map(d=>({ok:false,src:d.src,from:d.from,to:d.to}))));
    $('tray').innerHTML=tiles.map((t,i)=>`<button class="tile" data-i="${i}">${pieceSvg(t.src,t.from,t.to)}</button>`).join('');
    for(const el of $('tray').children)el.onclick=()=>{if(S.lock||el.classList.contains('no'))return;
      if(tiles[+el.dataset.i].ok){sfx.ok();draw(true);msg(`「${p.name}」が 入った！`,'good');return stepDone('部品 ぴったり！')}
      slip();el.classList.add('no');msg('にているけど、ちがう 部品だよ。形を よく 見くらべよう。','bad')};
  },
  /* くみたて：部品をえらんで、正しい場所に置く（にせもの・左右ぎゃく を ふせぐ） */
  build(){
    setQuestion(false);
    S.placed=Q.e.parts.map(()=>false);S.sel=null;S.guide=Q.lv===0;
    S.tiles=shuffle(Q.e.parts.map((p,i)=>({part:i,src:Q.k,from:p.from,to:p.to})).concat(decoysOf(Q.e).map(d=>({part:-1,src:d.src,from:d.from,to:d.to}))));
    $('tray').innerHTML=S.tiles.map((t,i)=>`<button class="tile" data-i="${i}">${pieceSvg(t.src,t.from,t.to)}</button>`).join('');
    for(const b of $('tray').children)b.onclick=()=>{if(S.lock||b.classList.contains('no'))return;S.sel=+b.dataset.i;for(const x of $('tray').children)x.classList.toggle('sel',x===b);msg('どこに 置く？ わくを タップ。');draw()};
    const draw=()=>{stage.innerHTML=GUIDE+Q.e.parts.map((p,i)=>{const b=C.boxOf(Q.M,p.from,p.to,4);
      return S.placed[i]?STROKES[Q.k].slice(p.from-1,p.to).map(d=>pathOf(d,COLORS[i%4],5)).join(''):`<rect class="slot ${S.sel!=null?'hot':''}" x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" rx="4"/>`}).join('')+(S.guide?Q.e.parts.map((p,i)=>S.placed[i]?'':STROKES[Q.k].slice(p.from-1,p.to).map(d=>pathOf(d,'#bdb6a2',5,' opacity=".7"')).join('')).join(''):'')};
    S.draw=draw;draw();
    msg(S.guide?'部品を えらんで、うすい お手本の 場所に 置こう。にせものに 注意！':'部品を えらんで、正しい 場所に 置こう。左と 右、上と 下を よく 思い出して。');
    S.tap=p=>{
      if(S.sel==null)return msg('先に、下の 部品を えらぼう。');
      // タップした場所が入っている わく（重なるときは、その部品の線に 近いほう）
      let slot=-1,bd=1e9;Q.e.parts.forEach((q,i)=>{if(S.placed[i])return;const b=C.boxOf(Q.M,q.from,q.to,4);if(p[0]<b[0]||p[0]>b[2]||p[1]<b[1]||p[1]>b[3])return;let d=1e9;for(let n=q.from-1;n<q.to;n++)d=Math.min(d,C.distToStroke(p,Q.M[n]));if(d<bd){bd=d;slot=i}});
      if(slot<0)return;
      const t=S.tiles[S.sel],btn=$('tray').children[S.sel];
      if(t.part===slot){sfx.ok();S.placed[slot]=true;btn.classList.add('used');btn.classList.remove('sel');S.sel=null;draw();
        if(S.placed.every(Boolean)){msg(`「${Q.k}」が できた！`,'good');return stepDone('くみたて せいこう！')}
        return msg(`「${Q.e.parts[slot].name}」は そこ！ のこりも 置こう。`,'good')}
      slip();btn.classList.remove('sel');S.sel=null;
      if(t.part<0){btn.classList.add('no');msg('にているけど、ちがう 部品だよ。形を よく 見くらべよう。','bad')}
      else msg(`部品は 合ってる！ でも 場所が ちがうよ。「${Q.e.parts[t.part].name}」は どっちがわ？`,'bad');
      draw();
    };
  },
  /* 書きじゅん：つぎに書く画を タップ（字の きれいさと 関係なく 確かめる） */
  order(){
    setQuestion(true);S.pos=0;S.miss=0;
    const draw=flash=>{stage.innerHTML=GUIDE+STROKES[Q.k].map((d,i)=>pathOf(d,i<S.pos?COLORS[C.partOf(Q.e,i)%4]:i===flash?'#ff4d6d':i===S.pos&&S.miss>=2?'#ff9f1c':'#c9c5d8',5.5)).join('')+Q.M.slice(0,S.pos).map((m,i)=>dot(m[0],i+1)).join('')};
    draw();msg('1画目から じゅんばんに、画を タップしよう。');
    S.tap=p=>{
      const j=C.pickStroke(Q.M,S.pos,p);if(j<0)return;
      if(j===S.pos){sfx.ok(S.pos);S.pos++;S.miss=0;draw();
        if(S.pos>=Q.M.length)return stepDone('書きじゅん かんぺき！');
        return msg(`${S.pos}画目 OK！ つぎは ${S.pos+1}画目。`,'good')}
      sfx.no();S.miss++;draw(j);const me=S;setTimeout(()=>{if(S===me&&!S.lock)draw()},350);
      msg(`それは ${j+1}画目。いまは ${S.pos+1}画目だよ。`+(S.miss>=2?' オレンジの 画を タップ。':''),'bad');
    };
  },
  /* なぞる：ゆるい判定。当たった画は きれいな線に 置きかわる */
  trace(){
    setQuestion(true);S.pos=0;S.miss=0;S.live=null;S.model=Q.lv===0||Q.fix;
    const draw=()=>{const m=Q.M[S.pos];stage.innerHTML=GUIDE+(S.model?STROKES[Q.k].slice(S.pos).map(d=>pathOf(d,'#d6d0bf',5.5)).join(''):'')
      +STROKES[Q.k].slice(0,S.pos).map((d,i)=>pathOf(d,COLORS[C.partOf(Q.e,i)%4],5.5)).join('')
      +(m&&S.miss>=1?pathOf(STROKES[Q.k][S.pos],'#ff9f1c',5.5,' opacity=".6"'):'')+(m?dot(m[0],S.model||S.miss>=1?S.pos+1:0):'')
      +(S.live?pathOf(polyD(S.live),'#4a3fd1',5):'')};
    S.draw=draw;draw();
    msg(S.model?'うすい お手本を、緑の 丸から じゅんばんに なぞろう。':'緑の 丸が 書き始め。形を 思い出して 書こう。まよったら オレンジの 線が 出るよ。');
    S.stroke=user=>{
      const r=C.judgeTrace(user,Q.M,S.pos);
      const next=auto=>{if(!auto)sfx.ok(S.pos);S.pos++;S.miss=0;draw();if(S.pos>=Q.M.length)return stepDone('なぞれた！');if(!auto)msg(['いいね！','そのちょうし！','ナイス！'][S.pos%3],'good')};
      if(r.ok)return next(false);
      sfx.no();S.miss++;
      const why={order:`それは ${r.at+1}画目。いまは ${S.pos+1}画目だよ。`,reverse:'むきが ぎゃくだよ。緑の 丸から 書こう。',start:'書き始めの 場所が ちがうよ。緑の 丸から。',short:'さいごまで しっかり 書こう。'}[r.reason]||'オレンジの 線の とおりに 書こう。';
      if(S.miss>=C.TRACE_AUTO){msg(`${S.pos+1}画目は こう書くよ。つぎへ 進もう。`);return next(true)}
      msg(`${S.pos+1}画目：${why}`,'bad');draw();
    };
  },
  /* 思い出して書く：読みだけ見て自由に書き、お手本と重ねて自分で見くらべる */
  recall(){
    setQuestion(false);S.ink=[];S.live=null;S.shown=false;S.hint=0;S.free=true;
    const draw=()=>{stage.innerHTML=GUIDE+(S.shown?kanjiSvg(Q.k,()=>'#ff4d6d',5).replace(/<path /g,'<path opacity=".45" '):'')+S.ink.map(s=>pathOf(polyD(s),'#2b2760',4.5)).join('')+(S.live?pathOf(polyD(S.live),'#4a3fd1',4.5):'')};
    S.draw=draw;draw();
    msg('お手本なし！ きいろい ところの 漢字を、思い出して 書こう。');
    const judge=r=>{if(S.lock)return;const res=r==='good'&&S.hint?'close':r;Q.result=res;
      if(!Q.trial){R().ink[Q.k]={s:S.ink.map(s=>ST.resample(s,Math.min(24,Math.max(2,s.length))).map(p=>[Math.round(p[0]),Math.round(p[1])])),r:res,d:today()};store()}
      if(res==='good')return stepDone('会心の いちげき！');
      // ちがったときは、正しい形を なぞってから 終わる
      Q.steps.push('trace');Q.fix=true;S.lock=true;banner('正しい形を なぞって おぼえよう',1000);Q.si++;setTimeout(startStep,1000)};
    const reveal=()=>{S.shown=true;S.live=null;draw();setQuestion(true);
      msg('赤い お手本と くらべよう。部品の 形と 場所は 同じ？');
      buttons([{text:'⭕ 同じに 書けた',cls:'primary',id:'good',fn:()=>judge('good')},{text:'🔺 すこし ちがった',id:'close',fn:()=>judge('close')},{text:'❌ 思い出せなかった',id:'forgot',fn:()=>judge('forgot')}]);
      if(!S.ink.length)$('actions').firstChild.disabled=true};
    buttons([{text:'↩ 一画 もどす',cls:'ghost',fn:()=>{S.ink.pop();draw()}},{text:'ぜんぶ 消す',cls:'ghost',fn:()=>{S.ink=[];draw()}},
      {text:'💡 部品ヒント',cls:'ghost',fn:()=>{S.hint=1;msg('部品は 「'+Q.e.parts.map(p=>p.name).join('」＋「')+'」。'+Q.e.memo)}},
      {text:'書けた！ くらべる',cls:'primary',fn:reveal}]);
  },
};

/* ---------- ボス：テストと同じ問題文で、答え（漢字と おくりがな）を書く ---------- */
function startExam(){X={list:C.examList(R().tq,RANGE.questions),i:0,ok:0,redo:new Set(),gold:0,xp:0};Q=null;show('quest');$('ename').textContent='塔のぬし ドラゴン';scene('spawn',{boss:true,hue:(save.hero.floor*23)%360});examShow()}
function examShow(){
  const q=X.list[X.i],chars=[...q.a],r=R();setStage(chars.length);
  S={type:'exam',free:true,ink:[],live:null,shown:false};
  $('tray').innerHTML='';$('stepLabel').textContent=`${X.i+1}/${X.list.length}問目　ボス`;$('pips').innerHTML=X.list.map((_,i)=>`<i class="${i<X.i?'off':''}"></i>`).join('');
  const ask=show=>{$('question').innerHTML=q.q.replace(/\[(.+?)\]/,show?`<b>${q.a}</b>`:'<b>$1</b>')};ask(false);
  const cell=(i,body)=>`<g transform="translate(${109*i})">${body}</g>`;
  S.draw=()=>{stage.innerHTML=chars.map((c,i)=>cell(i,GUIDE+(i?'<path d="M0,0V109" stroke="#4c4699" stroke-width="1.2"/>':'')+(S.shown&&STROKES[c]?STROKES[c].map(d=>pathOf(d,'#ff4d6d',5,' opacity=".45"')).join(''):''))).join('')
    +S.ink.map(k=>pathOf(polyD(k),'#2b2760',4.5)).join('')+(S.live?pathOf(polyD(S.live),'#4a3fd1',4.5):'')};
  S.draw();
  msg(`テストと 同じ問題。きいろい ところを 書こう（${chars.length}文字。1マスに 1文字）。`);
  const judge=res=>{if(S.lock)return;S.lock=true;const retry=X.redo.has(q.id);r.tq[q.id]={r:res,t:Date.now()};
    // ボスでの出来を、字ごとの記録にも うつす：× の字は もう一度 おぼえ直し、○ で まだ出会っていない字は 出会ったことに
    for(const c of chars){const e=entryOf(c);if(!e)continue;if(res==='bad')r.recs[c]=C.advance(r.recs[c],'forgot',today(),e);else if(!met(c))r.recs[c]=C.advance(undefined,'good',today(),e)}
    if(!r.startDay)r.startDay=today();
    if(res==='good'){if(!retry)X.ok++;const g=retry?C.BONUS.examRetry:C.BONUS.examHit;gain(g);X.gold+=g.gold;X.xp+=g.xp;scene('attack',{big:true,done:()=>damage(true)});if(!window.TowerScene)damage(true)}
    else{sfx.no();scene('miss');if(!retry){X.redo.add(q.id);X.list.push(q)}}
    store();X.i++;setTimeout(()=>X.i<X.list.length?examShow():examEnd(),res==='good'?900:350)};
  buttons([{text:'↩ 一画 もどす',cls:'ghost',fn:()=>{S.ink.pop();S.draw()}},{text:'ぜんぶ 消す',cls:'ghost',fn:()=>{S.ink=[];S.draw()}},
    {text:'こたえを 見る',cls:'primary',fn:()=>{S.shown=true;S.live=null;S.draw();ask(true);msg('赤い お手本と くらべよう。形も おくりがなも 同じ？');
      buttons([{text:'⭕ 書けた',cls:'primary',id:'good',fn:()=>judge('good')},{text:'❌ まちがえた',id:'bad',fn:()=>judge('bad')}]);if(!S.ink.length)$('actions').firstChild.disabled=true}}]);
}
function examEnd(){
  const n=X.list.length-X.redo.size,r=R(),d=day(),win=X.ok/n>=C.BOSS_PASS,all=examOk()===RANGE.questions.length;
  let g={gold:X.gold,xp:X.xp},lv=0;
  if(win){if(!d.boss){d.boss=true;lv=gain(C.BONUS.bossWin);g.gold+=C.BONUS.bossWin.gold;g.xp+=C.BONUS.bossWin.xp}r.crest=Math.max(r.crest|0,all?2:1);sfx.win();scene('die')}
  store();
  $('winTitle').textContent=win?'🐉 塔のぬしを たおした！':'🐉 塔のぬしは にげていった…';$('winStars').textContent=`${X.ok} / ${n}`;
  $('winText').textContent=(win?(all?'ぜんぶの 問題が ○！ 🏆 かんぜん げきは！':'🎖️ げきはの しるしを 手に入れた！'):`${Math.ceil(n*C.BOSS_PASS)}問を 一回で 書ければ 勝てる。`)+(X.redo.size?`　まちがえた ${X.redo.size}問の字は、塔で もう一度 おぼえ直せるよ。`:'')+`　これまでの ○：${examOk()}/${RANGE.questions.length}`;
  $('winChips').innerHTML='';setTimeout(()=>{showGain(g,lv);$('winOv').classList.add('on')},win?900:200)}
$('openExam').onclick=startExam;

/* ---------- タッチ ---------- */
let pid=null;
stage.addEventListener('pointerdown',ev=>{if((!Q&&!X)||!S||S.lock||pid!==null)return;ev.preventDefault();const p=pt(ev);
  if(S.tap)return S.tap(p);
  if(!S.draw||S.shown)return;pid=ev.pointerId;try{stage.setPointerCapture(pid)}catch(e){}S.live=[p];S.draw()});
stage.addEventListener('pointermove',ev=>{if(ev.pointerId!==pid||!S||!S.live)return;ev.preventDefault();S.live.push(pt(ev));S.draw()});
function up(ev){if(ev.pointerId!==pid)return;pid=null;if(!S||!S.live)return;const user=S.live;S.live=null;
  if(S.free){if(user.length>1)S.ink.push(user);else S.ink.push([user[0],[user[0][0]+.6,user[0][1]+.6]]);return S.draw()}
  if(user.length<2||ST.polyLength(user)<2)return S.draw();
  S.stroke(user)}
stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
document.addEventListener('touchmove',ev=>{if($('quest').classList.contains('active')&&ev.cancelable)ev.preventDefault()},{passive:false});
document.addEventListener('gesturestart',ev=>ev.preventDefault());

/* ---------- ぶきや ---------- */
function renderShop(){const h=save.hero;$('shopGold').textContent=h.gold;
  $('shopList').innerHTML=C.WEAPONS.map(w=>{const own=h.owned.includes(w.id),on=h.weapon===w.id,can=h.gold>=w.price;
    return `<div class="witem ${own||can?'':'locked'}"><div class="sw" style="background:${hex(w.color)};color:${hex(w.glow)}"></div><div><b>${w.name}</b><small>こうげき +${w.atk}${own?'':`　🪙 ${w.price} G`}</small></div>
      <button data-w="${w.id}" class="${on?'ghost':own||can?'primary':''}" ${on||(!own&&!can)?'disabled':''}>${on?'そうび中':own?'そうびする':can?'買う':`あと ${w.price-h.gold} G`}</button></div>`}).join('');
  for(const b of $('shopList').querySelectorAll('button'))b.onclick=()=>{const w=C.weaponOf(b.dataset.w),h=save.hero;
    if(!h.owned.includes(w.id)){if(h.gold<w.price)return;h.gold-=w.price;h.owned.push(w.id);banner(`「${w.name}」を 手に入れた！`,1400);sfx.lvup()}else sfx.coin();
    h.weapon=w.id;store();scene('setWeapon',w);scene('levelUp',w.glow);renderShop();renderHome()}}
$('openShop').onclick=()=>{renderShop();$('shopOv').classList.add('on')};
$('shopClose').onclick=()=>$('shopOv').classList.remove('on');

/* ---------- ずかん ---------- */
$('openBook').onclick=()=>{
  $('bookGrid').innerHTML=RANGE.kanji.map(e=>{const lv=lvOf(e.k);return met(e.k)?`<div class="kcard"><svg viewBox="0 0 109 109">${kanjiSvg(e.k,null,5)}</svg><div class="stars">${stars(lv)}</div><small>${e.name}</small></div>`
    :`<div class="kcard locked"><svg viewBox="0 0 109 109"><text x="54.5" y="72" font-size="50" text-anchor="middle" fill="#6a63c4">？</text></svg><small>まだ 出会っていない</small></div>`}).join('');
  const parts=[...new Set(RANGE.kanji.filter(e=>met(e.k)&&e.parts.length>1).flatMap(e=>e.parts.map(p=>p.name)).filter(n=>!n.includes('の 部品')))].map((n,i)=>`<span class="chip kyo" style="background:${CHIP[i%4]}">${n}</span>`);
  $('bookParts').innerHTML=parts.join('')||'<span style="color:var(--sub)">まだ ないよ</span>';
  $('bookOv').classList.add('on')};
$('bookClose').onclick=()=>$('bookOv').classList.remove('on');

/* ---------- テストの はんい ---------- */
$('rangeBtn').onclick=()=>{
  $('rangeList').innerHTML=LIST.slice().reverse().map(r=>{const s=save.ranges[r.id],on=r.id===save.range;
    return `<div class="witem"><div style="font-size:26px">${s&&s.crest>1?'🏆':s&&s.crest?'🎖️':'📜'}</div><div><b>${r.title}</b><small>${s?`なかま ${Object.keys(s.recs||{}).length}字`:'まだ はじめていない'}</small></div><button data-r="${r.id}" class="${on?'ghost':'primary'}" ${on?'disabled':''}>${on?'いま ここ':'ここで あそぶ'}</button></div>`}).join('');
  for(const b of $('rangeList').querySelectorAll('button'))b.onclick=()=>loadRange(b.dataset.r,()=>{$('rangeOv').classList.remove('on');renderHome()});
  $('rangeOv').classList.add('on')};
$('rangeClose').onclick=()=>$('rangeOv').classList.remove('on');

/* ---------- 保護者用（記録の確認と、おためし） ---------- */
function renderParent(){
  const NAME={good:'⭕ 同じに書けた',close:'🔺 すこしちがった',forgot:'❌ 思い出せなかった'},r=R();
  $('parentGrid').innerHTML=RANGE.kanji.map(e=>{const k=r.ink[e.k],rec=r.recs[e.k];
    return `<div class="kcard"><svg viewBox="0 0 109 109">${kanjiSvg(e.k,()=>'#ffb3c0',4)}${k?k.s.map(s=>pathOf(polyD(s),'#1b1838',3.5)).join(''):''}</svg><small>${rec?`★${rec.lv}　つぎは ${String(rec.next).slice(4,6)}/${String(rec.next).slice(6)}${rec.miss?`　× ${rec.miss}`:''}`:'まだ'}<br>${k?NAME[k.r]:'（書く練習は まだ）'}</small></div>`}).join('');
  const t=String(today()),g=guide();
  $('parentDay').textContent=`塔の中の きょう：${+t.slice(4,6)}月${+t.slice(6)}日`+(save.dayOffset?`（おためしで ${save.dayOffset}日 進めています）`:'')+`　きょうの めやす：あと ${g.count}体（ふっかつ ${g.due}・はじめて ${g.intro}）　まだ出会っていない字 ${g.unmet}　ボスの問題 ○ ${examOk()}/${RANGE.questions.length}`;
  $('trialKanji').innerHTML=RANGE.kanji.map(e=>`<option value="${e.k}">${e.k}</option>`).join('');
}
$('openParent').onclick=()=>{renderParent();$('parentOv').classList.add('on')};
$('parentClose').onclick=()=>{$('parentOv').classList.remove('on');renderHome()};
$('trialGo').onclick=()=>{$('parentOv').classList.remove('on');startQuest([{k:$('trialKanji').value,kind:'extra'}],+$('trialLv').value)};
$('trialNext').onclick=()=>{save.dayOffset=(save.dayOffset|0)+1;store();renderParent()};
$('trialAuto').onclick=()=>{const t=today(),r=R();if(!r.startDay)r.startDay=t;let n=0;
  for(let guard=0;guard<60&&guide().count>0;guard++)for(const x of nextFloor()){const prev=r.recs[x.k];r.recs[x.k]=C.advance(prev,'good',t,entryOf(x.k));gain(C.rewardFor({kind:x.kind,result:'good',slips:0,star3:r.recs[x.k].lv===C.MAX_LV&&C.lvOf(prev,entryOf(x.k))<C.MAX_LV,repeat:!!prev&&prev.last===t}));n++}
  const f=Math.ceil(n/C.FLOOR_SIZE);save.hero.floor+=f;gain({gold:f*C.BONUS.floor.gold+(n?C.BONUS.daily.gold:0),xp:n?C.BONUS.daily.xp:0});save.dayOffset=(save.dayOffset|0)+1;store();renderParent()};
$('trialGold').onclick=()=>{save.hero.gold+=1000;store();renderParent();banner('🪙 +1000 G')};
$('resetRange').onclick=()=>{if(confirm(`「${RANGE.title}」の 記録を 消しますか？（レベル・ゴールド・武器は のこります）`)){save.ranges[save.range]=blankRange();store();renderParent()}};
$('resetAll').onclick=()=>{if(confirm('ぜんぶの 記録（レベル・ゴールド・武器も）を 消して、さいしょから はじめますか？')){const id=save.range;save=blank();save.range=id;save.ranges[id]=blankRange();store();renderParent();attachScene()}};

/* ---------- はじめる ---------- */
if(!LIST.length){document.body.innerHTML='<p style="padding:24px">テストの はんいが ありません。tower/tools/README.md を見て、はんいを 作ってください。</p>';return}
const startId=LIST.some(r=>r.id===save.range)?save.range:LIST[LIST.length-1].id;
loadRange(startId,()=>{renderHome();attachScene()});
// テスト用：いまの状態を のぞく
window.__tower={get Q(){return Q},get S(){return S},get X(){return X},get save(){return save},get range(){return RANGE},get strokes(){return STROKES},get cells(){return CELLS},C,ST};
})();
