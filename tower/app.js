// 漢字の塔 — 画面の動き。判定・出題の順番・ごほうびの計算は tower-core.js、3Dの絵は scene.mjs、音は sound.js。
"use strict";
(function(){
const C=TowerCore,ST=StrokeTrace,SND=window.TowerSound||{unlock(){},play(){},sfx(){},muted:true,toggle(){return true}};
const $=id=>document.getElementById(id);
const COLORS=['#f08a00','#1e88e5','#2fbf71','#8e44ad'],CHIP=['#ffd08a','#a8d4ff','#b9f0c8','#e0c8ff'];
const STEP_NAME={meet:'であう',pick:'どの字？',build:'くみたて',order:'書きじゅん',trace:'なぞる',recall:'思い出して 書く',part:'部品えらび'};
const BOSS_NAME={slime:'スライム大王',shroom:'キノコ大王',ghost:'ゴースト大王',golem:'ゴーレム大王',eye:'メダマ大王',bat:'コウモリ大王'};
const HEARTS=5,COMBO_MAX=5;
// 3Dの絵（読み込めないときは 何もしない）
const scene=(fn,...a)=>{try{if(window.TowerScene)return window.TowerScene[fn](...a)}catch(e){console.error(e)}};
const has3D=()=>!!(window.TowerScene&&window.TowerScene.ok);
const later=(ms,f)=>setTimeout(f,ms);

/* ---------- 保存（塔だけのキー。第1〜4章の記録にはさわらない） ---------- */
const SAVE_KEY='kanjiTower_v1';
const blank=()=>({v:2,hero:{xp:0,gold:0,owned:['w0'],weapon:'w0'},range:'',ranges:{},dayOffset:0,intro:false});
const blankRange=()=>({recs:{},startDay:0,tq:{},ink:{},crest:0,floor:0,cleared:false,seen:false,day:{d:0,floors:0,chest:false,clean:0,total:0}});
function loadSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(!s||typeof s!=='object')return blank();const b=blank();
  s.hero=Object.assign(b.hero,s.hero||{});if(!Array.isArray(s.hero.owned)||!s.hero.owned.includes('w0'))s.hero.owned=['w0'];if(!s.ranges||typeof s.ranges!=='object')s.ranges={};
  return Object.assign(b,s)}catch(e){return blank()}}
let save=loadSave();
function store(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch(e){}}
const today=()=>C.dayKey(new Date(),save.dayOffset|0);

/* ---------- テスト範囲（＝エリア。data/<id>.js を 必要なときに読みこむ） ---------- */
let RANGE=null,STROKES={},MODELS={},BYK={},AREA=null,AREA_I=0,L=30;
const LIST=window.TOWER_RANGE_LIST||[];
function loadRange(id,done){
  const use=()=>{RANGE=window.TOWER_RANGES[id];STROKES=RANGE.strokes;MODELS={};BYK={};for(const e of RANGE.kanji){MODELS[e.k]=C.prep(STROKES[e.k]);BYK[e.k]=e}
    AREA_I=Math.max(0,LIST.findIndex(r=>r.id===id));AREA=C.areaOf(AREA_I);L=C.areaFloors(RANGE.kanji.length);
    save.range=id;save.ranges[id]=Object.assign(blankRange(),save.ranges[id]||{});
    // 前の版（塔の高さを 全体で 1つ 持っていた）から：のぼった かい数を この エリアに うつす
    const r=save.ranges[id];if(save.hero.floor){r.floor=Math.max(r.floor|0,Math.min(save.hero.floor,L-1));delete save.hero.floor}
    r.floor=Math.min(r.floor|0,L);store();done()};
  if(window.TOWER_RANGES&&window.TOWER_RANGES[id])return use();
  const s=document.createElement('script');s.src=`data/${id}.js`;s.onload=use;s.onerror=()=>alert('テストの はんいを 読みこめませんでした：'+id);document.head.appendChild(s);
}
const R=()=>save.ranges[save.range];
const entryOf=k=>BYK[k];
const lvOf=k=>C.lvOf(R().recs[k],entryOf(k));
const met=k=>!!R().recs[k];
// きょうの 予定：その日の はじめに 1回だけ 作って 保存する（上限・下限で ならした 字の ならび）
function plan(){const d=day();if(!Array.isArray(d.plan)){d.plan=C.makePlan(R().recs,RANGE.kanji,today(),R().startDay||today());store()}return d.plan}
const guide=()=>C.guide(R().recs,RANGE.kanji,today(),R().startDay||today(),plan());
const nextFloor=()=>C.nextFloor(R().recs,RANGE.kanji,today(),C.FLOOR_SIZE,R().startDay||today(),plan());
// 宝箱まで あと何回 たたかうか：めやすの かい数に、とちゅうの 中ボスの かいも 足す（画面の数と じっさいが 1対1に なるように）
const chestLeft=()=>C.fightsToChest(R().floor|0,L,Math.max(1,guide().floors));
const examOk=()=>RANGE.questions.filter(q=>R().tq[q.id]&&R().tq[q.id].r==='good').length;
function day(){const r=R();if(!r.day||r.day.d!==today())r.day={d:today(),floors:0,chest:false,clean:0,total:0};return r.day}
const kindNext=()=>C.floorKind(R().floor|0,L);

/* ---------- 共通 ---------- */
function attachScene(){
  const id=$('quest').classList.contains('active')?'battleScene':$('shop').classList.contains('active')?'shopScene':'homeScene';
  const m={battleScene:'battle',shopScene:'shop',homeScene:'home'}[id];
  if(!window.TowerScene)return;
  scene('attach',$(id),m);scene('setArea',AREA,L,R().floor|0);scene('setLook',C.heroLook(save.hero.xp));if(m!=='shop')scene('setWeapon',C.weaponOf(save.hero.weapon));
}
function show(id){for(const s of document.querySelectorAll('.screen'))s.classList.toggle('active',s.id===id);if(id==='quest')placeSide();attachScene();if(id==='quest')requestAnimationFrame(fit)}
addEventListener('towerscene',()=>{if(RANGE)attachScene()});
function banner(text,ms){const b=$('banner');b.textContent=text;b.classList.add('on');clearTimeout(banner.t);banner.t=later(ms||1100,()=>b.classList.remove('on'))}
function toast(text){const d=document.createElement('div');d.className='toast';d.innerHTML=text;$('toasts').appendChild(d);later(2300,()=>d.remove())}
function msg(text,type){const m=$('msg');m.textContent=text;m.className='msg'+(type?' '+type:'')}
function anim(el,cls){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const stars=lv=>'★'.repeat(lv)+'☆'.repeat(C.MAX_LV-lv);
const hex=n=>'#'+n.toString(16).padStart(6,'0');
const GUIDE='<path d="M54.5,3V106M3,54.5H106" stroke="#e3dcc6" stroke-width=".5" stroke-dasharray="2 2" fill="none"/>';
const pathOf=(d,color,w,extra)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w||5}" stroke-linecap="round" stroke-linejoin="round"${extra||''}/>`;
const polyD=pts=>'M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L');
function kanjiSvg(k,color,w){const e=entryOf(k);return STROKES[k].map((d,i)=>pathOf(d,color?color(i):COLORS[C.partOf(e,i)%4],w)).join('')}
function pieceSvg(src,from,to,color){const M=C.prep(STROKES[src]),b=C.boxOf(M,from,to,6),s=Math.max(b[2]-b[0],b[3]-b[1]),cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  return `<svg viewBox="${(cx-s/2).toFixed(1)} ${(cy-s/2).toFixed(1)} ${s.toFixed(1)} ${s.toFixed(1)}">${STROKES[src].slice(from-1,to).map(d=>pathOf(d,color||'#22314f',s/16)).join('')}</svg>`}
// ごほうびを足す。レベルが上がったら ごほうびの知らせ（新しい武器・見た目）も出す
function gain(g,quiet){
  const h=save.hero,before=C.levelOf(h.xp);h.gold+=g.gold|0;h.xp+=g.xp|0;const after=C.levelOf(h.xp);
  if(after>before&&!quiet){
    later(300,()=>{banner(`⭐ レベルアップ！ Lv ${after}`,1600);SND.sfx('lvup');scene('levelUp');scene('setLook',C.heroLook(h.xp))});
    const nw=C.WEAPONS.filter(w=>w.lv>before&&w.lv<=after);if(nw.length)later(1200,()=>toast(`🛒 ぶきやに「${nw.map(w=>w.name).join('」「')}」が ならんだ！`));
    if(C.heroLook(h.xp)!==C.heroLook(h.xp-(g.xp|0)))later(1800,()=>toast('✨ よろいが パワーアップした！'));
  }
  return after>before?after:0;
}
function gainText(g){return (g.gold?`<span>🪙 +${g.gold}</span>`:'')+(g.xp?`<span>⭐ +${g.xp}</span>`:'')}
function card(o){ // 結果の カード
  $('winTitle').textContent=o.title||'';$('winStars').innerHTML=o.big||'';$('winText').textContent=o.text||'';$('winGain').innerHTML=o.gain?gainText(o.gain):'';$('winLv').textContent=o.lv?`⭐ レベルアップ！ Lv ${o.lv}`:'';$('winChips').innerHTML=o.chips||'';
  $('winOk').textContent=o.ok||'つぎへ';$('winOk').onclick=()=>{$('winOv').classList.remove('on');SND.sfx('tap');if(o.next)o.next()};
  $('winOv').classList.add('on');
}

/* ---------- ホーム（塔の地図） ---------- */
function renderHome(){
  const h=save.hero,w=C.weaponOf(h.weapon),r=R(),g=guide(),d=day(),kind=kindNext(),fl=r.floor|0;
  $('hudLv').textContent=`Lv ${C.levelOf(h.xp)}`;$('hudXp').style.width=Math.round(C.levelProgress(h.xp)*100)+'%';$('hudGold').textContent=h.gold;
  $('hudWeapon').innerHTML=`<span class="sw" style="background:${hex(w.color)};color:${hex(w.glow)}"></span>${w.name}`;
  $('soundBtn').textContent=SND.muted?'🔇':'🔊';
  $('areaName').textContent=AREA.name;
  $('floorText').innerHTML=r.cleared?'👑 クリア！':`${Math.min(fl+1,L)}<small> / ${L} かい</small>`;
  const toMid=C.MID_EVERY-(fl%C.MID_EVERY),toTop=L-fl;
  $('nextBoss').textContent=r.cleared?'てっぺんで しゅぎょう できる':kind==='dragon'?'🐉 つぎは てっぺんの ドラゴン！':kind==='mid'?`👑 つぎは ${BOSS_NAME[AREA.mid]}！`:toMid<toTop?`👑 中ボスまで あと ${toMid}かい`:`🐉 ドラゴンまで あと ${toTop}かい`;
  const go=$('go');go.className=kind==='mid'||kind==='dragon'?'boss':'primary';
  // てっぺんの ドラゴンの 前では、ドラゴンに いどむか、しゅぎょう（ふつうの たたかい）を えらべる
  $('train').hidden=kind!=='dragon';
  go.textContent=kind==='dragon'?'🐉 ドラゴンに いどむ':kind==='mid'?`👑 ${BOSS_NAME[AREA.mid]}に いどむ`:kind==='top'?'⚔️ しゅぎょうする':'▲ のぼる';
  // きょうの たからばこ：体の数ではなく「あと 何かい」で見せる。長い日も 6目もりまで
  const left=chestLeft(),total=Math.max(1,d.floors+left),segs=Math.min(6,total),on=d.chest?segs:Math.min(segs-1,Math.round(d.floors/total*segs));
  $('chestRow').innerHTML=(d.chest?'👑 きょうの たからばこ ゲット！':`🎁 あと ${left}かい`)+' '+Array.from({length:segs},(_,i)=>`<i class="${i<on?'on':''}"></i>`).join('')+`<span class="box ${d.chest?'':'wig'}">${d.chest?'✨':'🎁'}</span>`;
  const n=RANGE.kanji.length,seen=RANGE.kanji.filter(e=>met(e.k)).length,ready=seen===n&&examOk()<RANGE.questions.length;
  $('openExam').className=ready?'rec':'';
}
$('go').onclick=()=>{SND.unlock();SND.sfx('tap');const k=kindNext();if(k==='dragon')return pickExam();if(k==='mid')return startMid();const list=nextFloor();if(list.length)startQuest(list)};
$('train').onclick=()=>{SND.unlock();SND.sfx('tap');const list=nextFloor();if(list.length)startQuest(list)};
$('soundBtn').onclick=()=>{SND.unlock();SND.toggle();if(!SND.muted)SND.play('home');renderHome()};

/* ---------- たたかい：ふだんの かい（3体）・中ボス・おためし ---------- */
let Q=null,S=null,X=null; // Q: たたかいの流れ、S: いまのステップの状態、X: ドラゴン
function newFight(o){return Object.assign({qi:0,hearts:HEARTS,combo:0,gold:0,xp:0,slipsTotal:0,mode:'floor'},o)}
function startQuest(list,trialLv){Q=newFight({list,mode:trialLv!=null?'trial':'floor',trialLv});X=null;show('quest');SND.play('battle');startKanji()}
function startMid(){
  const ks=C.reviewPick(R().recs,RANGE.kanji,6),pool=ks.length>=3?ks:RANGE.kanji.slice(0,6).map(e=>e.k);
  const list=pool.map((k,i)=>({k,kind:'boss',steps:[entryOf(k).parts.length>1&&i%2?'part':'pick']}));
  Q=newFight({list,mode:'mid'});X=null;show('quest');SND.play(null);
  $('ename').textContent=BOSS_NAME[AREA.mid];$('ebox').classList.add('boss');setHp(1);renderHearts();
  scene('spawn',{mon:AREA.mid,hue:AREA.hue,boss:'mid'});
  bossEntrance(`👑 ${BOSS_NAME[AREA.mid]} あらわる！`,()=>{SND.play('boss');startKanji()});
}
function bossEntrance(text,done){
  S={type:'intro',lock:true};$('question').innerHTML='';msg('');$('tray').innerHTML='';buttons([]);setStage(1);stage.innerHTML=GUIDE;
  $('warnText').textContent=text;$('warn').classList.add('on');SND.sfx('warn');
  later(900,()=>{SND.sfx('roar');scene('bossIntro',()=>{})});
  later(has3D()?3300:1500,()=>{$('warn').classList.remove('on');done()});
}
function startKanji(){
  const it=Q.list[Q.qi],k=it.k;Q.k=k;Q.kind=it.kind;Q.e=entryOf(k);Q.M=MODELS[k];
  Q.lv=Q.mode==='trial'?Q.trialLv:Q.mode==='mid'?3:lvOf(k);Q.first=Q.mode==='floor'&&!met(k);
  Q.steps=it.steps?it.steps.slice():C.stepsFor(Q.lv,Q.e);Q.hpTotal=Q.steps.length;Q.si=0;Q.result='good';Q.fix=false;Q.slips=0;
  if(Q.mode!=='mid'){$('ename').textContent=Q.e.name;$('ebox').classList.remove('boss');setHp(1);scene('spawn',{mon:Q.e.mon,hue:Q.e.hue})}
  renderHearts();startStep();
}
function renderBar(){
  $('stepLabel').textContent=Q.mode==='mid'?`${Q.qi+1} / ${Q.list.length}`:`${Q.qi+1}/${Q.list.length}体目　${STEP_NAME[Q.steps[Q.si]]||''}`;
  if(Q.mode==='mid')setHp(1-Q.qi/Q.list.length);else setHp(Q.si>=Q.hpTotal?0.06:1-Q.si/Q.hpTotal);
}
function setHp(f){$('ehp').style.width=Math.max(0,Math.min(1,f))*100+'%'}
function renderHearts(){const f=Q||X;if(!f)return;$('hearts').textContent='❤️'.repeat(f.hearts)+'🤍'.repeat(HEARTS-f.hearts);
  const c=f.combo|0;$('combo').innerHTML=`ひっさつ <span class="g">${Array.from({length:COMBO_MAX},(_,i)=>`<i class="${i<c?'on':''}"></i>`).join('')}</span>`;$('combo').classList.toggle('full',c>=COMBO_MAX)}
function setQuestion(showKanji){const q=Q.e.q.replace(/\[(.+?)\]/,showKanji&&!Q.e.note?`<b>${Q.k}</b>`:'<b>$1</b>');$('question').innerHTML=q+(Q.e.note?`<small style="font-size:15px;color:var(--sub)">　（きいろの ${Q.e.note}${showKanji?`＝「${Q.k}」`:''}）</small>`:'')}
function buttons(list){$('actions').innerHTML='';for(const b of list){const el=document.createElement('button');el.textContent=b.text;el.className=b.cls||'';el.onclick=()=>{SND.sfx('tap');b.fn()};if(b.id)el.dataset.id=b.id;$('actions').appendChild(el)}}
function startStep(){S={type:Q.steps[Q.si],slipped:false};$('tray').innerHTML='';buttons([]);renderBar();STEP[S.type]();fit()}
// ダメージの数字（武器とレベルで 大きくなる。えんしゅつだけ）
function damage(big,crit){const base=C.attackOf(save.hero.xp,save.hero.weapon),v=Math.round(base*5*(big?3:1)*(crit?1.6:1)*(0.85+Math.random()*0.3));
  const d=document.createElement('div');d.className='dmg'+(big?' big':'')+(crit?' crit':'');d.textContent=(crit?'クリティカル！ ':'')+v;$('battleScene').parentNode.appendChild(d);later(800,()=>d.remove());SND.sfx(crit?'crit':'hit',big)}
// ハートが 0 に なったら、妖精が 回復してくれる（ゲームオーバーは ない）
function hurt(f){f.hearts=Math.max(0,f.hearts-1);renderHearts();if(f.hearts===0)later(700,()=>{f.hearts=HEARTS;renderHearts();toast('🧚 ようせいが ハートを 回復してくれた！');SND.sfx('heal');scene('levelUp',0x7be495)})}
// えらぶ問題の まちがい：まものが はんげき（たてで うける）
function slip(){const f=Q||X;if(Q){Q.slips++;Q.slipsTotal++;S.slipped=true;Q.combo=Math.max(0,Q.combo-1)}SND.sfx('no');anim($('stage'),'shake');
  scene('enemyAttack',()=>{SND.sfx('block')});if(!has3D())SND.sfx('block');hurt(f)}
// 書きじゅん・なぞりの まちがいは はんげき なし（手の うごきの 苦手さで 責めない）
function wobble(){SND.sfx('no');scene('miss')}
function stepDone(text){
  Q.si++;S.lock=true;const clean=!S.slipped;
  if(clean&&Q.mode!=='trial')Q.combo=Math.min(COMBO_MAX,Q.combo+1);
  const itemDone=Q.si>=Q.steps.length;renderBar();renderHearts();
  if(!itemDone){scene('attack',{done:()=>damage(false)});if(!has3D())damage(false);banner(text||'ヒット！',700);return later(800,startStep)}
  if(Q.mode==='mid')return midHit();
  finishMonster();
}
// まもの1体 たおす：ゲージ満タンなら 必殺技、ノーミスなら クリティカル
function finishMonster(){
  const special=Q.combo>=COMBO_MAX,crit=!special&&Q.slips===0;
  const result=Q.result==='good'&&Q.slips>0&&Q.lv>=1?'close':Q.result,r=R(),prev=r.recs[Q.k];
  let g={gold:0,xp:0},rec=null;
  if(Q.mode==='floor'){rec=C.advance(prev,result,today(),Q.e);r.recs[Q.k]=rec;if(!r.startDay)r.startDay=today();
    g=C.rewardFor({kind:Q.kind,result,slips:Q.slips,star3:rec.lv===C.MAX_LV&&C.lvOf(prev,Q.e)<C.MAX_LV,repeat:!!prev&&prev.last===today()});
    const d=day();d.total++;if(Q.slips===0&&result==='good')d.clean++;Q.gold+=g.gold;Q.xp+=g.xp;store()}
  const kill=()=>{setHp(0);SND.sfx('kill');scene('die',{strokes:STROKES[Q.k],done:afterKill});if(!has3D())later(400,afterKill)};
  const afterKill=()=>{
    if(Q.mode==='floor'){gain(g);
      const say=result==='forgot'?'だいじょうぶ、また すぐ 出てくるよ':result==='close'?'おしい！ あした もう一度':Q.first?`「${Q.k}」が なかまに なった！`:rec.lv===C.MAX_LV&&C.lvOf(prev,Q.e)<C.MAX_LV?`「${Q.k}」 ★3つ！ かんぺき！`:`「${Q.k}」 ${stars(rec.lv)}`;
      toast(`${say}　<span style="color:#c2650a">🪙+${g.gold} ⭐+${g.xp}</span>`)}
    later(900,()=>{if(Q.qi<Q.list.length-1){Q.qi++;startKanji()}else endFight()});
  };
  if(special){Q.combo=0;renderHearts();doSpecial(kill)}
  else{scene('attack',{big:true,crit,done:()=>{damage(true,crit);later(250,kill)}});if(!has3D()){damage(true,crit);later(250,kill)}}
}
function doSpecial(done){
  const w=C.weaponOf(save.hero.weapon);$('cutinText').textContent=w.skill+'！';$('cutin').classList.add('on');SND.sfx('charge');
  if(Q&&Q.k)scene('setKanjiFx',STROKES[Q.k]);
  later(900,()=>$('cutin').classList.remove('on'));
  if(!has3D())return later(900,()=>{damage(true,true);SND.sfx('boom');done()});
  scene('special',w,()=>{SND.sfx('boom');damage(true,true);later(350,done)});
}
// 中ボス：1問ごとに 大ダメージ。HPが 半分で おこる。さいごは 必殺技で とどめ
function midHit(){
  const left=Q.list.length-(Q.qi+1);
  // 中ボスで まちがえた字は、あした もう一度 出す（★は 上げない）
  if(Q.slips>0&&met(Q.k))R().recs[Q.k]=C.advance(R().recs[Q.k],'close',today(),Q.e);
  if(left>0){
    setHp(left/Q.list.length);scene('attack',{big:true,crit:Q.slips===0,done:()=>damage(true,Q.slips===0)});if(!has3D())damage(true,Q.slips===0);
    if(!Q.rage&&left<=Q.list.length/2){Q.rage=true;later(700,()=>{SND.sfx('roar');scene('bossRage');banner('😡 おこった！',1000)})}
    else if(Q.rage&&left%2===0)later(900,()=>{scene('enemyAttack',()=>SND.sfx('block'))});
    return later(Q.rage&&!Q.rageShown?1700:1300,()=>{Q.rageShown=Q.rage;Q.qi++;startKanji()});
  }
  doSpecial(()=>{setHp(0);SND.sfx('kill');scene('die',{done:endFight});if(!has3D())later(400,endFight)});
}
// たたかいの おわり
function endFight(){
  if(Q.mode==='trial'){card({title:'おためし おわり',big:'🧪',text:'記録は かわっていません。',next:goHome});return}
  // ドラゴンの 前と てっぺんでは かいは ふえない（ドラゴンは テストと同じ問題で たおす）
  const r=R(),from=r.floor|0,d=day(),wasTop=Q.mode!=='mid'&&(kindNext()==='top'||kindNext()==='dragon');
  if(!wasTop)r.floor=Math.min(L,from+1);d.floors++;
  const fb=Object.assign({},C.BONUS.floor);gain(fb,true);Q.gold+=fb.gold;store();
  const to=r.floor|0;
  const daily=after=>{if(!d.chest&&guide().count===0){d.chest=true;store();return runChest('daily',C.dailyGrade(d.clean,d.total),after)}after()};
  if(Q.mode==='mid'){const grade=C.midGrade(Q.slipsTotal);return runChest('mid',grade,()=>daily(()=>result(from,to)))}
  daily(()=>result(from,to));
  result(from,to);
}
function result(from,to){
  const wasMid=Q.mode==='mid',kind=C.floorKind(to,L);
  const next=kind==='dragon'?'つぎは てっぺんの ドラゴン！':kind==='mid'?`つぎは ${BOSS_NAME[AREA.mid]}！`:'';
  card({title:wasMid?`👑 ${BOSS_NAME[AREA.mid]}を たおした！`:from===to?'⚔️ しゅぎょう かんりょう！':`🎉 ${Math.min(to+1,L)}かいへ！`,big:wasMid?'👑':'🗼',text:next||(day().chest?'すきなだけ のぼって いいよ。':'つづけても、ひと休みしても いいよ。'),
    gain:{gold:Q.gold,xp:Q.xp},next:()=>goHome(from,to)});
}
// 宝箱：落ちてきて、タップで あける。中身は がんばりで きまる
function runChest(kind,grade,after){
  const g=C.CHESTS[kind][grade],name=C.CHEST_NAMES[grade];
  const give=()=>{const lv=gain(g);if(Q){Q.gold+=g.gold;Q.xp+=g.xp}if(X){X.gold+=g.gold;X.xp+=g.xp}store();SND.sfx('coin');
    card({title:`${['🪵','🥈','🥇'][grade]} ${name}！`,big:'💰',text:kind==='daily'?['きょうも がんばった！','いい ちょうし！ まちがいが 少なかった！','すごい！ ほとんど まちがえなかった！'][grade]:kind==='mid'?['たおした！','いい たたかいだった！','ノーミス！ かんぺき！'][grade]:['ドラゴンを たおした！','すごい！','ぜんぶ 一回で ○！ さいこう！'][grade],gain:g,lv,next:()=>{scene('closeChest');after()}})};
  if(!has3D())return give();
  scene('chest',grade);SND.sfx('boom');
  later(900,()=>{$('tapChest').classList.add('on');$('tapChest').onclick=()=>{$('tapChest').classList.remove('on');[0,300,600].forEach((t,i)=>later(t,()=>SND.sfx('shake',i+1)));later(950,()=>SND.sfx('open'));scene('openChest',()=>later(500,give))}});
}
function goHome(from,to){
  Q=null;X=null;S=null;setStage(1);renderHome();show('home');SND.play('home');
  if(from!=null&&to!=null&&to>from){SND.sfx('climb');scene('climb',from,to,()=>{renderHome();const k=kindNext();if(k==='mid'||k==='dragon')banner(k==='dragon'?'🐉 てっぺんに ついた！':'👑 中ボスの かいだ！',1500)})}
}
$('retreat').onclick=()=>{SND.sfx('tap');if((Q&&Q.mode!=='trial')||X){if(!confirm('たたかいを やめて 塔に もどる？（たおした まものの 記録は のこるよ）'))return}$('warn').classList.remove('on');goHome()};

const stage=$('stage');
let CELLS=1; // マスの数（ドラゴンでは 答えの文字数ぶん 横にならべる）
function setStage(n){CELLS=n;stage.setAttribute('viewBox',`0 0 ${109*n} 109`);fit()}
function fit(){const b=$('board');if(!b.clientWidth)return;const w=Math.floor(Math.max(150,Math.min(b.clientWidth-12,(b.clientHeight-12)*CELLS)));stage.style.width=w+'px';stage.style.height=Math.floor(w/CELLS)+'px'}
// 問題の らんは、よこ向きでは 3Dの下、たて向きでは 書く場所の上に おく
function placeSide(){const land=innerWidth>innerHeight,side=$('side'),want=land?document.querySelector('.bwin'):document.querySelector('.lower');if(side.parentNode!==want)want.insertBefore(side,land?null:$('board'))}
addEventListener('resize',()=>{if($('quest').classList.contains('active'))placeSide();fit();setTimeout(fit,300)});
// 問題文や ボタンが ふえて 書く場所の 枠が かわったら、マスの大きさを 測り直す
if(window.ResizeObserver)new ResizeObserver(()=>fit()).observe($('board'));
function pt(ev){const r=stage.getBoundingClientRect();return[(ev.clientX-r.left)/r.width*109*CELLS,(ev.clientY-r.top)/r.height*109]}
const dot=(p,n)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.8" fill="#22b455"/>`+(n?`<text x="${p[0]}" y="${p[1]+1.7}" font-size="4.8" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>`:'');
function decoysOf(e){const out=[],seen=new Set();for(let r=0;r<3&&out.length<3;r++)for(const p of e.parts){const d=(p.alts||[])[r],id=d&&d.src+d.from+'-'+d.to;if(d&&!seen.has(id)&&out.length<3){seen.add(id);out.push(d)}}return out}

const STEP={
  /* であう：部品に分けて、書き順を見せる */
  meet(){
    setQuestion(true);msg(Q.e.memo);
    const draw=()=>{stage.innerHTML=GUIDE+STROKES[Q.k].map((d,i)=>`<path d="${d}" fill="none" stroke="${COLORS[C.partOf(Q.e,i)%4]}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" from="1" to="0" dur="0.4s" begin="indefinite" fill="freeze"/></path>`).join('');
      stage.querySelectorAll('animate').forEach((a,i)=>later(i*450,()=>{try{a.beginElement()}catch(e){}}))};
    draw();
    $('tray').innerHTML=Q.e.parts.map((p,i)=>`<span class="chip kyo" style="background:${CHIP[i%4]};font-size:18px">${p.name}</span>`).join('<b style="align-self:center">＋</b>');
    buttons([{text:'▶ もう一回',cls:'ghost',fn:draw},{text:'おぼえた！',cls:'primary',fn:()=>{if(!S.lock)stepDone('であった！')}}]);
  },
  /* どの字？：読みから字をえらぶ。まぎらわしい字が まざる */
  pick(){
    setQuestion(false);msg('どの字？ にている字に 気をつけて！');stage.innerHTML=GUIDE+'<text x="54.5" y="72" font-size="50" text-anchor="middle" fill="#cfd8ea">？</text>';
    const opts=shuffle([Q.k].concat([...Q.e.alts]));
    $('tray').innerHTML=opts.map(k=>`<button class="opt kyo" data-k="${k}">${k}</button>`).join('');
    for(const b of $('tray').children)b.onclick=()=>{if(S.lock)return;
      if(b.dataset.k===Q.k){SND.sfx('ok');stage.innerHTML=GUIDE+kanjiSvg(Q.k);setQuestion(true);stepDone('せいかい！')}
      else{slip();b.classList.add('no');b.disabled=true;msg('にているけど ちがう字！ もう一度。','bad')}};
  },
  /* 部品えらび：ぬけている部品を、にている部品の中から えらぶ */
  part(){
    setQuestion(false);
    const n=Q.e.parts.length,j=(((R().recs[Q.k]&&R().recs[Q.k].seen)|0)+Q.qi)%n,p=Q.e.parts[j],b=C.boxOf(Q.M,p.from,p.to,4);
    const draw=done=>{stage.innerHTML=GUIDE+Q.e.parts.map((q,i)=>i===j&&!done?`<rect class="slot hot" x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" rx="4"/>`:STROKES[Q.k].slice(q.from-1,q.to).map(d=>pathOf(d,i===j?COLORS[i%4]:'#22314f',5)).join('')).join('')};
    draw(false);msg('きいろの わくに 入る 部品は どれ？');
    const tiles=shuffle([{ok:true,src:Q.k,from:p.from,to:p.to}].concat(p.alts.map(d=>({ok:false,src:d.src,from:d.from,to:d.to}))));
    $('tray').innerHTML=tiles.map((t,i)=>`<button class="tile" data-i="${i}">${pieceSvg(t.src,t.from,t.to)}</button>`).join('');
    for(const el of $('tray').children)el.onclick=()=>{if(S.lock||el.classList.contains('no'))return;
      if(tiles[+el.dataset.i].ok){SND.sfx('ok');draw(true);msg(`「${p.name}」！`,'good');return stepDone('部品 ぴったり！')}
      slip();el.classList.add('no');msg('にているけど ちがう 部品！','bad')};
  },
  /* くみたて：部品をえらんで、正しい場所に置く（にせもの・左右ぎゃく を ふせぐ） */
  build(){
    setQuestion(false);
    S.placed=Q.e.parts.map(()=>false);S.sel=null;S.guide=Q.lv===0;
    S.tiles=shuffle(Q.e.parts.map((p,i)=>({part:i,src:Q.k,from:p.from,to:p.to})).concat(decoysOf(Q.e).map(d=>({part:-1,src:d.src,from:d.from,to:d.to}))));
    $('tray').innerHTML=S.tiles.map((t,i)=>`<button class="tile" data-i="${i}">${pieceSvg(t.src,t.from,t.to)}</button>`).join('');
    for(const b of $('tray').children)b.onclick=()=>{if(S.lock||b.classList.contains('no'))return;SND.sfx('tap');S.sel=+b.dataset.i;for(const x of $('tray').children)x.classList.toggle('sel',x===b);msg('どこに 置く？ わくを タップ。');draw()};
    const draw=()=>{stage.innerHTML=GUIDE+Q.e.parts.map((p,i)=>{const b=C.boxOf(Q.M,p.from,p.to,4);
      return S.placed[i]?STROKES[Q.k].slice(p.from-1,p.to).map(d=>pathOf(d,COLORS[i%4],5)).join(''):`<rect class="slot ${S.sel!=null?'hot':''}" x="${b[0]}" y="${b[1]}" width="${b[2]-b[0]}" height="${b[3]-b[1]}" rx="4"/>`}).join('')+(S.guide?Q.e.parts.map((p,i)=>S.placed[i]?'':STROKES[Q.k].slice(p.from-1,p.to).map(d=>pathOf(d,'#c9c2ad',5,' opacity=".7"')).join('')).join(''):'')};
    S.draw=draw;draw();
    msg(S.guide?'部品を えらんで、うすい お手本の 場所へ！':'部品を えらんで、正しい 場所へ！');
    S.tap=p=>{
      if(S.sel==null)return msg('先に 部品を えらぼう。');
      let slot=-1,bd=1e9;Q.e.parts.forEach((q,i)=>{if(S.placed[i])return;const b=C.boxOf(Q.M,q.from,q.to,4);if(p[0]<b[0]||p[0]>b[2]||p[1]<b[1]||p[1]>b[3])return;let d=1e9;for(let n=q.from-1;n<q.to;n++)d=Math.min(d,C.distToStroke(p,Q.M[n]));if(d<bd){bd=d;slot=i}});
      if(slot<0)return;
      const t=S.tiles[S.sel],btn=$('tray').children[S.sel];
      if(t.part===slot){SND.sfx('ok');S.placed[slot]=true;btn.classList.add('used');btn.classList.remove('sel');S.sel=null;draw();
        if(S.placed.every(Boolean)){msg(`「${Q.k}」が できた！`,'good');return stepDone('くみたて せいこう！')}
        return msg(`「${Q.e.parts[slot].name}」 OK！`,'good')}
      slip();btn.classList.remove('sel');S.sel=null;
      if(t.part<0){btn.classList.add('no');msg('にているけど ちがう 部品！','bad')}
      else msg(`部品は 合ってる！ 場所が ちがうよ。`,'bad');
      draw();
    };
  },
  /* 書きじゅん：つぎに書く画を タップ */
  order(){
    setQuestion(true);S.pos=0;S.miss=0;
    const draw=flash=>{stage.innerHTML=GUIDE+STROKES[Q.k].map((d,i)=>pathOf(d,i<S.pos?COLORS[C.partOf(Q.e,i)%4]:i===flash?'#ff5a6e':i===S.pos&&S.miss>=2?'#ff9f1c':'#cfd8ea',5.5)).join('')+Q.M.slice(0,S.pos).map((m,i)=>dot(m[0],i+1)).join('')};
    draw();msg('1画目から じゅんに タップ！');
    S.tap=p=>{
      const j=C.pickStroke(Q.M,S.pos,p);if(j<0)return;
      if(j===S.pos){SND.sfx('ok',S.pos);S.pos++;S.miss=0;draw();
        if(S.pos>=Q.M.length)return stepDone('書きじゅん かんぺき！');
        return msg(`${S.pos}画目 OK！`,'good')}
      wobble();S.miss++;draw(j);const me=S;later(350,()=>{if(S===me&&!S.lock)draw()});
      msg(`それは ${j+1}画目。いまは ${S.pos+1}画目！`,'bad');
    };
  },
  /* なぞる：ゆるい判定。当たった画は きれいな線に 置きかわる */
  trace(){
    setQuestion(true);S.pos=0;S.miss=0;S.live=null;S.model=Q.lv===0||Q.fix;
    const draw=()=>{const m=Q.M[S.pos];stage.innerHTML=GUIDE+(S.model?STROKES[Q.k].slice(S.pos).map(d=>pathOf(d,'#e3dcc6',5.5)).join(''):'')
      +STROKES[Q.k].slice(0,S.pos).map((d,i)=>pathOf(d,COLORS[C.partOf(Q.e,i)%4],5.5)).join('')
      +(m&&S.miss>=1?pathOf(STROKES[Q.k][S.pos],'#ff9f1c',5.5,' opacity=".6"'):'')+(m?dot(m[0],S.model||S.miss>=1?S.pos+1:0):'')
      +(S.live?pathOf(polyD(S.live),'#3a7bff',5):'')};
    S.draw=draw;draw();
    msg(S.model?'緑の 丸から なぞろう！':'緑の 丸から、思い出して 書こう！');
    S.stroke=user=>{
      const r=C.judgeTrace(user,Q.M,S.pos);
      const next=auto=>{if(!auto)SND.sfx('ok',S.pos);S.pos++;S.miss=0;draw();if(S.pos>=Q.M.length)return stepDone('なぞれた！');if(!auto)msg(['いいね！','そのちょうし！','ナイス！'][S.pos%3],'good')};
      if(r.ok)return next(false);
      wobble();S.miss++;
      const why={order:`それは ${r.at+1}画目！`,reverse:'むきが ぎゃく！ 緑の 丸から。',start:'緑の 丸から 書こう。',short:'さいごまで しっかり！'}[r.reason]||'オレンジの 線の とおりに！';
      if(S.miss>=C.TRACE_AUTO){msg(`${S.pos+1}画目は こう書くよ。`);return next(true)}
      msg(why,'bad');draw();
    };
  },
  /* 思い出して書く：読みだけ見て自由に書き、お手本と重ねて自分で見くらべる */
  recall(){
    setQuestion(false);S.ink=[];S.live=null;S.shown=false;S.hint=0;S.free=true;
    const draw=()=>{stage.innerHTML=GUIDE+(S.shown?kanjiSvg(Q.k,()=>'#ff5a6e',5).replace(/<path /g,'<path opacity=".45" '):'')+S.ink.map(s=>pathOf(polyD(s),'#22314f',4.5)).join('')+(S.live?pathOf(polyD(S.live),'#3a7bff',4.5):'')};
    S.draw=draw;draw();
    msg('お手本なし！ 思い出して 書こう。');
    const judge=r=>{if(S.lock)return;const res=r==='good'&&S.hint?'close':r;Q.result=res;
      if(Q.mode==='floor'){R().ink[Q.k]={s:S.ink.map(s=>ST.resample(s,Math.min(24,Math.max(2,s.length))).map(p=>[Math.round(p[0]),Math.round(p[1])])),r:res,d:today()};store()}
      if(res==='good')return stepDone('会心の いちげき！');
      // ちがったときは まものが はんげき → 正しい形を なぞってから とどめ
      S.lock=true;slip();Q.slips--;Q.slipsTotal--;Q.steps.push('trace');Q.fix=true;banner('なぞって おぼえよう！',1000);Q.si++;later(1100,startStep)};
    const reveal=()=>{S.shown=true;S.live=null;draw();setQuestion(true);
      msg('赤い お手本と くらべよう！');
      buttons([{text:'⭕ 同じ！',cls:'primary',id:'good',fn:()=>judge('good')},{text:'🔺 すこし ちがう',id:'close',fn:()=>judge('close')},{text:'❌ 思い出せなかった',id:'forgot',fn:()=>judge('forgot')}]);
      if(!S.ink.length)$('actions').firstChild.disabled=true};
    buttons([{text:'↩',cls:'ghost',fn:()=>{S.ink.pop();draw()}},{text:'けす',cls:'ghost',fn:()=>{S.ink=[];draw()}},
      {text:'💡 ヒント',cls:'ghost',fn:()=>{S.hint=1;msg('部品は「'+Q.e.parts.map(p=>p.name).join('」＋「')+'」')}},
      {text:'書けた！',cls:'primary',fn:reveal}]);
  },
};

/* ---------- ドラゴン（テストと同じ問題）：答え（漢字と おくりがな）を書く ---------- */
// テストの回が いくつか ある はんいでは、どの回を 練習するか えらぶ（明日は 12回目だけ、など）
function pickExam(){
  const secs=RANGE.sections||[];if(secs.length<2)return startExam(null);
  const ok=qs=>qs.filter(q=>R().tq[q.id]&&R().tq[q.id].r==='good').length;
  const row=(label,sec)=>{const qs=sec==null?RANGE.questions:RANGE.questions.filter(q=>q.sec===sec);return `<div class="litem"><div style="font-size:26px">🐉</div><div><b>${label}</b><small>${qs.length}問　○ ${ok(qs)}/${qs.length}</small></div><button class="primary" data-sec="${sec==null?'':sec}">いどむ</button></div>`};
  $('examList').innerHTML=secs.map((t,i)=>row(t,i)).join('')+row('ぜんぶ',null);
  for(const b of $('examList').querySelectorAll('button'))b.onclick=()=>{$('examOv').classList.remove('on');startExam(b.dataset.sec===''?null:+b.dataset.sec)};
  $('examOv').classList.add('on');
}
$('examClose').onclick=()=>$('examOv').classList.remove('on');
function startExam(sec){
  SND.unlock();const pool=sec==null?RANGE.questions:RANGE.questions.filter(q=>q.sec===sec),list=C.examList(R().tq,pool);
  // エリア クリアは「ぜんぶ」の ドラゴンを てっぺんで たおしたときだけ
  X={list,pool,sec,i:0,ok:0,redo:new Set(),gold:0,xp:0,hearts:HEARTS,combo:0,need:Math.ceil(list.length*C.BOSS_PASS),atTop:sec==null&&(kindNext()==='dragon'||kindNext()==='top')};Q=null;
  show('quest');SND.play(null);$('ename').textContent='塔のぬし ドラゴン';$('ebox').classList.add('boss');setHp(1);renderHearts();$('stepLabel').textContent='';
  scene('spawn',{boss:'dragon',hue:AREA.hue+180});
  bossEntrance('🐉 ドラゴン あらわる！',()=>{SND.play('boss');examShow()});
}
function examShow(){
  const q=X.list[X.i],chars=[...q.a],r=R();setStage(chars.length);
  S={type:'exam',free:true,ink:[],live:null,shown:false};
  $('tray').innerHTML='';$('stepLabel').textContent=`${X.i+1} / ${X.list.length}`;
  const ask=show=>{$('question').innerHTML=q.q.replace(/\[(.+?)\]/,show?`<b>${q.a}</b>`:'<b>$1</b>')};ask(false);
  const cell=(i,body)=>`<g transform="translate(${109*i})">${body}</g>`;
  S.draw=()=>{stage.innerHTML=chars.map((c,i)=>cell(i,GUIDE+(i?'<path d="M0,0V109" stroke="#cfd8ea" stroke-width="1.2"/>':'')+(S.shown&&STROKES[c]?STROKES[c].map(d=>pathOf(d,'#ff5a6e',5,' opacity=".45"')).join(''):''))).join('')
    +S.ink.map(k=>pathOf(polyD(k),'#22314f',4.5)).join('')+(S.live?pathOf(polyD(S.live),'#3a7bff',4.5):'')};
  S.draw();
  msg(`テストと 同じ！ ${chars.length}文字、1マスに 1文字。`);
  const judge=res=>{if(S.lock)return;S.lock=true;const retry=X.redo.has(q.id);r.tq[q.id]={r:res,t:Date.now()};
    for(const c of chars){const e=entryOf(c);if(!e)continue;if(res==='bad')r.recs[c]=C.advance(r.recs[c],'forgot',today(),e);else if(!met(c))r.recs[c]=C.advance(undefined,'good',today(),e)}
    if(!r.startDay)r.startDay=today();
    if(res==='good'){
      if(!retry){X.ok++;X.combo=Math.min(COMBO_MAX,X.combo+1)}const g=retry?C.BONUS.examRetry:C.BONUS.examHit;gain(g,true);X.gold+=g.gold;X.xp+=g.xp;
      setHp(Math.max(X.ok>=X.need?0.04:0,1-X.ok/X.need));renderHearts();
      scene('attack',{big:true,crit:!retry,done:()=>damage(true,!retry)});if(!has3D())damage(true,!retry);
      if(!X.rage&&X.ok>=X.need/2){X.rage=true;later(800,()=>{SND.sfx('roar');scene('bossRage');banner('😡 ドラゴンが おこった！',1100)})}
    }else{SND.sfx('breath');scene('enemyAttack',()=>SND.sfx('block'));X.combo=Math.max(0,X.combo-1);hurt(X);if(!retry){X.redo.add(q.id);X.list.push(q)}}
    store();X.i++;later(res==='good'?1100:900,()=>X.i<X.list.length?examShow():examEnd())};
  buttons([{text:'↩',cls:'ghost',fn:()=>{S.ink.pop();S.draw()}},{text:'けす',cls:'ghost',fn:()=>{S.ink=[];S.draw()}},
    {text:'こたえを 見る',cls:'primary',fn:()=>{S.shown=true;S.live=null;S.draw();ask(true);msg('赤い お手本と くらべよう。おくりがなも 同じ？');
      buttons([{text:'⭕ 書けた！',cls:'primary',id:'good',fn:()=>judge('good')},{text:'❌ まちがえた',id:'bad',fn:()=>judge('bad')}]);if(!S.ink.length)$('actions').firstChild.disabled=true}}]);
  fit();
}
function examEnd(){
  const n=X.list.length-X.redo.size,r=R(),win=X.ok>=X.need,all=examOk()===RANGE.questions.length,secName=X.sec==null?'':(RANGE.sections[X.sec]+'の '),poolOk=X.pool.filter(q=>r.tq[q.id]&&r.tq[q.id].r==='good').length;
  S={type:'end',lock:true};
  if(!win){scene('miss');SND.sfx('enemy');
    return later(600,()=>card({title:'🐉 ドラゴンは にげていった…',big:`${X.ok} / ${n}`,text:`${X.need}問を 一回で 書けたら 勝てる！ ${secName}○ ${poolOk}/${X.pool.length}。まちがえた問題は 次に 先に 出るよ。`,gain:{gold:X.gold,xp:X.xp},next:goHome}))}
  r.crest=Math.max(r.crest|0,all?2:1);
  const from=r.floor|0,clear=X.atTop&&!r.cleared;
  if(clear){r.floor=L;r.cleared=true}store();
  scene('setKanjiFx',STROKES[RANGE.questions[0].a[0]]);
  doSpecial(()=>{setHp(0);SND.sfx('kill');scene('die',{done:()=>later(400,()=>runChest('dragon',C.dragonGrade(X.ok,n),()=>{
    SND.sfx('win');
    card({title:clear?`🏆 ${AREA.name} クリア！`:'🐉 ドラゴンを おいはらった！',big:clear?'👑':`${X.ok} / ${n}`,
      text:clear?'漢字を とりかえした！ 次の テストの はんいで、新しい エリアが ひらくよ。':`${secName}○ ${poolOk}/${X.pool.length}。`+(poolOk<X.pool.length?'もう一度 いどむと、まだの 問題が 先に 出るよ。':'ぜんぶ ○！')+(X.sec==null&&!r.cleared?' てっぺんで たおせば エリア クリア！':''),gain:{gold:X.gold,xp:X.xp},next:()=>goHome(from,r.floor|0)});
  }))});if(!has3D())later(400,()=>runChest('dragon',C.dragonGrade(X.ok,n),()=>card({title:clear?`🏆 ${AREA.name} クリア！`:'🐉 ドラゴンを おいはらった！',big:'👑',gain:{gold:X.gold,xp:X.xp},next:()=>goHome(from,r.floor|0)})))});
}
$('openExam').onclick=()=>{SND.sfx('tap');pickExam()};

/* ---------- タッチ ---------- */
let pid=null;
stage.addEventListener('pointerdown',ev=>{SND.unlock();if((!Q&&!X)||!S||S.lock||pid!==null)return;ev.preventDefault();const p=pt(ev);
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
document.addEventListener('pointerdown',()=>SND.unlock(),{capture:true});

/* ---------- ぶきや：3Dで 武器を 見て、ためしぎりが できる ---------- */
let shopSel='w0',shopBusy=false;
function renderShop(){
  const h=save.hero,w=C.weaponOf(shopSel),own=h.owned.includes(w.id),on=h.weapon===w.id,open=C.weaponOpen(w,h.xp),can=h.gold>=w.price;
  $('shopGold').textContent=h.gold;
  $('shopInfo').innerHTML=open?`<b>${w.name}</b><div>こうげき +${w.atk}　ひっさつ：<span class="skill">${w.skill}</span></div><div class="row"><button class="blue" id="shopTry">⚔️ ためしぎり</button><button id="shopBuy" class="${on?'ghost':'primary'}" ${on||(!own&&!can)?'disabled':''}>${on?'そうび中':own?'そうびする':can?`🪙 ${w.price} で 買う`:`あと 🪙 ${w.price-h.gold}`}</button></div>`
    :`<b>？？？</b><div>Lv ${w.lv} に なると ならぶよ</div>`;
  $('shopList').innerHTML=C.WEAPONS.map(x=>{const o=C.weaponOpen(x,h.xp),own=h.owned.includes(x.id);
    return `<button class="witem ${x.id===shopSel?'sel':''} ${o?'':'locked'}" data-w="${x.id}"><span class="wsw" style="background:${hex(x.color)};box-shadow:0 0 12px ${hex(x.glow)}"></span><span>${o?x.name:'？？？'}<small>${o?`こうげき +${x.atk}`:`Lv ${x.lv} で とうじょう`}</small></span><span class="tag">${h.weapon===x.id?'そうび中':own?'もってる':o?`🪙 ${x.price}`:'🔒'}</span></button>`}).join('');
  for(const b of $('shopList').querySelectorAll('.witem'))b.onclick=()=>{SND.sfx('tap');shopSel=b.dataset.w;const x=C.weaponOf(shopSel);if(C.weaponOpen(x,save.hero.xp))scene('setWeapon',x);renderShop()};
  // 必殺技の とちゅうは うけつけない（連打で わざが 重ならないように）
  const t=$('shopTry');if(t)t.onclick=()=>{if(shopBusy)return;shopBusy=true;t.disabled=true;later(1900,()=>{shopBusy=false;const b=$('shopTry');if(b)b.disabled=false});SND.unlock();$('cutinText').textContent=w.skill+'！';$('cutin').classList.add('on');later(900,()=>$('cutin').classList.remove('on'));SND.sfx('charge');scene('setKanjiFx',STROKES[RANGE.kanji[0].k]);scene('special',w,()=>SND.sfx('boom'))};
  const b=$('shopBuy');if(b)b.onclick=()=>{const h=save.hero;
    if(!h.owned.includes(w.id)){if(h.gold<w.price)return;h.gold-=w.price;h.owned.push(w.id);banner(`「${w.name}」を 手に入れた！`,1500);SND.sfx('lvup')}else SND.sfx('coin');
    h.weapon=w.id;store();scene('setWeapon',w);scene('levelUp',w.glow);renderShop()};
}
$('openShop').onclick=()=>{SND.unlock();SND.sfx('tap');shopSel=save.hero.weapon;show('shop');renderShop()};
$('shopClose').onclick=()=>{SND.sfx('tap');scene('setWeapon',C.weaponOf(save.hero.weapon));renderHome();show('home')};

/* ---------- ずかん ---------- */
$('openBook').onclick=()=>{SND.sfx('tap');
  $('bookGrid').innerHTML=RANGE.kanji.map(e=>{const lv=lvOf(e.k);return met(e.k)?`<div class="kcard"><svg viewBox="0 0 109 109">${kanjiSvg(e.k,null,5)}</svg><div class="stars">${stars(lv)}</div><small>${e.name}</small></div>`
    :`<div class="kcard locked"><svg viewBox="0 0 109 109"><text x="54.5" y="72" font-size="50" text-anchor="middle" fill="#9fb0d0">？</text></svg><small>まだ 出会っていない</small></div>`}).join('');
  const parts=[...new Set(RANGE.kanji.filter(e=>met(e.k)&&e.parts.length>1).flatMap(e=>e.parts.map(p=>p.name)).filter(n=>!n.includes('の 部品')))].map((n,i)=>`<span class="chip kyo" style="background:${CHIP[i%4]}">${n}</span>`);
  $('bookParts').innerHTML=parts.join('')||'<span style="color:var(--sub)">まだ ないよ</span>';
  $('bookOv').classList.add('on')};
$('bookClose').onclick=()=>$('bookOv').classList.remove('on');

/* ---------- エリア（テストの はんい） ---------- */
$('rangeBtn').onclick=()=>{SND.sfx('tap');
  $('rangeList').innerHTML=LIST.map((r,i)=>({r,i})).reverse().map(({r,i})=>{const s=save.ranges[r.id],on=r.id===save.range,a=C.areaOf(i);
    return `<div class="litem"><div style="font-size:26px">${s&&s.cleared?'👑':s&&s.crest?'🎖️':'🗼'}</div><div><b>${a.name}</b><small>${r.title}${s?`　${Math.min((s.floor|0)+1,99)}かい`:''}</small></div><button data-r="${r.id}" class="${on?'ghost':'primary'}" ${on?'disabled':''}>${on?'いま ここ':'ここへ 行く'}</button></div>`}).join('');
  for(const b of $('rangeList').querySelectorAll('button'))b.onclick=()=>loadRange(b.dataset.r,()=>{$('rangeOv').classList.remove('on');renderHome();attachScene();scene('sweep');maybeIntro()});
  $('rangeOv').classList.add('on')};
$('rangeClose').onclick=()=>$('rangeOv').classList.remove('on');

/* ---------- はじめての ときの お話 ---------- */
function maybeIntro(){
  const r=R();if(save.intro&&r.seen)return;
  $('introTitle').textContent=save.intro?`あたらしい エリア「${AREA.name}」！`:'たいへんだ！';
  $('introText').textContent=save.intro?`この 塔の てっぺんにも ドラゴンが いる。${L}かいまで のぼって、漢字を とりかえそう！`:`ドラゴンが 漢字を ぬすんで、塔の てっぺんに にげこんだ！ まものを たおして のぼり、漢字を とりかえそう！`;
  $('introOv').classList.add('on');
  $('introGo').onclick=()=>{SND.unlock();SND.sfx('lvup');SND.play('home');$('introOv').classList.remove('on');save.intro=true;r.seen=true;store();scene('sweep')};
}

/* ---------- 保護者用（記録の確認と、おためし） ---------- */
function renderParent(){
  const NAME={good:'⭕ 同じ',close:'🔺 すこしちがう',forgot:'❌ 思い出せない'},r=R();
  $('parentGrid').innerHTML=RANGE.kanji.map(e=>{const k=r.ink[e.k],rec=r.recs[e.k];
    return `<div class="kcard"><svg viewBox="0 0 109 109">${kanjiSvg(e.k,()=>'#ffc2cc',4)}${k?k.s.map(s=>pathOf(polyD(s),'#22314f',3.5)).join(''):''}</svg><small>${rec?`★${rec.lv}　つぎ ${String(rec.next).slice(4,6)}/${String(rec.next).slice(6)}${rec.miss?`　×${rec.miss}`:''}`:'まだ'}<br>${k?NAME[k.r]:'—'}</small></div>`}).join('');
  const t=String(today()),g=guide();
  $('parentDay').textContent=`塔の中の きょう：${+t.slice(4,6)}月${+t.slice(6)}日`+(save.dayOffset?`（おためしで ${save.dayOffset}日 進めています）`:'')+`　きょうの めやす：あと ${g.count}体（ふっかつ ${g.due}・はじめて ${g.intro}）　まだ出会っていない字 ${g.unmet}　ドラゴンの問題 ○ ${examOk()}/${RANGE.questions.length}　${AREA.name} ${Math.min((r.floor|0)+1,L)}/${L}かい`;
  $('trialKanji').innerHTML=RANGE.kanji.map(e=>`<option value="${e.k}">${e.k}</option>`).join('');
}
$('openParent').onclick=()=>{SND.sfx('tap');renderParent();$('parentOv').classList.add('on')};
$('parentClose').onclick=()=>{$('parentOv').classList.remove('on');renderHome();attachScene()};
$('trialGo').onclick=()=>{$('parentOv').classList.remove('on');startQuest([{k:$('trialKanji').value,kind:'extra'}],+$('trialLv').value)};
$('trialMid').onclick=()=>{const r=R();r.floor=Math.min(L-2,Math.floor((r.floor|0)/C.MID_EVERY)*C.MID_EVERY+C.MID_EVERY-1);if(r.floor>=L-1)r.floor=C.MID_EVERY-1;r.cleared=false;store();renderParent();banner('中ボスの 前へ')};
$('trialTop').onclick=()=>{const r=R();r.floor=L-1;r.cleared=false;store();renderParent();banner('ドラゴンの 前へ')};
$('trialNext').onclick=()=>{save.dayOffset=(save.dayOffset|0)+1;store();renderParent()};
$('trialAuto').onclick=()=>{const t=today(),r=R();if(!r.startDay)r.startDay=t;let n=0;
  for(let guard=0;guard<60&&guide().count>0;guard++)for(const x of nextFloor()){const prev=r.recs[x.k];r.recs[x.k]=C.advance(prev,'good',t,entryOf(x.k));gain(C.rewardFor({kind:x.kind,result:'good',slips:0,star3:r.recs[x.k].lv===C.MAX_LV&&C.lvOf(prev,entryOf(x.k))<C.MAX_LV,repeat:!!prev&&prev.last===t}),true);n++}
  const f=Math.ceil(n/C.FLOOR_SIZE);r.floor=Math.min(L-1,(r.floor|0)+f);gain({gold:f*C.BONUS.floor.gold+(n?C.CHESTS.daily[2].gold:0),xp:n?C.CHESTS.daily[2].xp:0},true);save.dayOffset=(save.dayOffset|0)+1;store();renderParent()};
$('trialGold').onclick=()=>{save.hero.gold+=1000;store();renderParent();banner('🪙 +1000')};
$('resetRange').onclick=()=>{if(confirm('この エリアの 記録を 消しますか？（レベル・ゴールド・武器は のこります）')){save.ranges[save.range]=blankRange();save.ranges[save.range].seen=true;store();renderParent()}};
$('resetAll').onclick=()=>{if(confirm('ぜんぶの 記録（レベル・ゴールド・武器も）を 消して、さいしょから はじめますか？')){const id=save.range;save=blank();save.range=id;save.ranges[id]=blankRange();store();$('parentOv').classList.remove('on');renderHome();attachScene();maybeIntro()}};

/* ---------- はじめる ---------- */
if(!LIST.length){document.body.innerHTML='<p style="padding:24px">テストの はんいが ありません。tower/tools/README.md を見て、はんいを 作ってください。</p>';return}
// いちばん新しい はんいを まだ はじめていなければ、そこから（新しい エリアの お話が 出る）。はじめた あとは、えらんだ はんいを つづける
const newest=LIST[LIST.length-1].id,startId=!save.ranges[newest]?newest:LIST.some(r=>r.id===save.range)?save.range:newest;
loadRange(startId,()=>{renderHome();attachScene();maybeIntro();SND.play('home')});
// テスト用：いまの状態を のぞく
window.__tower={get Q(){return Q},get S(){return S},get X(){return X},get save(){return save},get range(){return RANGE},get strokes(){return STROKES},get cells(){return CELLS},get L(){return L},C,ST};
})();
