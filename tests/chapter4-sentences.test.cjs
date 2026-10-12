// Run: node tests/chapter4-sentences.test.cjs
// DOM is stubbed: this verifies data, save compatibility, battle flow and ink coordinates, not browser layout.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../chapter4/index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'duplicate DOM IDs');
for(const match of script.matchAll(/\$\("([^"]+)"\)/g))assert(ids.includes(match[1]),`missing DOM ID ${match[1]}`);
function boot(chapter={},term={},shared={}){
 const storage=new Map(Object.entries({kanjiQuestRpg_chapter4_v1:JSON.stringify(chapter),kanjiQuestSemester2_v1:JSON.stringify(term),kanjiQuestRpg_v1:JSON.stringify(shared)}));
 const timers=[];
 const context2d=new Proxy({},{get:()=>()=>{}});
 function element(){
  const classes=new Set();let text='',markup='';
  const e={style:{setProperty(){}},hidden:false,disabled:false,clientHeight:840,clientWidth:110,parentElement:{clientWidth:110},attrs:{},children:[],
   classList:{add(...v){v.forEach(x=>classes.add(x))},remove(...v){v.forEach(x=>classes.delete(x))},contains(x){return classes.has(x)},toggle(x,on){const v=on??!classes.has(x);v?classes.add(x):classes.delete(x);return v}},
   setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},appendChild(x){this.children.push(x)},remove(){},
   getBoundingClientRect(){return {width:420,height:900,left:0,top:0}},getContext(){return context2d},setPointerCapture(){},releasePointerCapture(){},addEventListener(){},
   querySelector(){return element()},querySelectorAll(){return []}};
  Object.defineProperty(e,'innerHTML',{get:()=>markup,set:v=>{markup=v;text=v.replace(/<[^>]*>/g,'')}});
  Object.defineProperty(e,'textContent',{get:()=>text,set:v=>{text=String(v)}});return e;
 }
 const nodes=new Map(ids.map(id=>[id,element()]));nodes.get('world').classList.add('active');
 const doc={getElementById:id=>nodes.get(id),createElement:element,documentElement:element(),addEventListener(){},hidden:false};
 const sandbox={console,document:doc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},devicePixelRatio:2,
  setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){},requestAnimationFrame(){},addEventListener(){},scrollTo(){},confirm:()=>true};
 vm.createContext(sandbox);for(const file of ["kanji-strokes.js","tracing-core.js"])vm.runInContext(fs.readFileSync(path.join(__dirname,"../chapter4",file),"utf8"),sandbox);vm.runInContext(script,sandbox);
 return {run:code=>vm.runInContext(code,sandbox),nodes,storage,timers};
}
const legacy={areaLayout:2,selectedTest:6,practiceMode:'sentence',defeated:[1,53,114],records:{114:{retry:3,last:'retry'}},customIds:[115,160],clears:[0,6,13],stageClears:{0:8,6:4,13:5},displayMode:'clue'};
const b=boot(legacy,{treasures:['test1','test2'],fragments:{test1:[0,1,2,3,4,5],test2:[6,7,8,9,10,11,12]},areaLayouts:{test1:2,test2:2}},{xp:5000,gold:4321,owned:['wood','treasure_staff'],weapon:'treasure_staff'});
assert.equal(b.run('SENTENCES.length'),80);
assert.equal(b.run('Math.max(...SENTENCES.map(q=>[...q.a].length))'),11);
assert.equal(b.run('SENTENCES.find(q=>q.test===4&&q.s===14).a'),'勝負に勝つ。');
assert.equal(b.run('new Set(SENTENCES.flatMap(q=>q.ids)).size'),219);
assert.equal(b.run('SENTENCES.reduce((n,q)=>n+q.ids.length,0)'),219);
assert(b.run('TESTS.every(t=>SENTENCES.filter(q=>q.test===t).length===10)'));
assert(b.run('AREAS.every((a,i)=>sentencesForArea(i).every(q=>q.test===a.block&&q.ids.every(id=>id>a.start&&id<=a.end)))'));
assert.equal(b.run('AREAS.flatMap((a,i)=>sentencesForArea(i)).length'),80);
assert.equal(b.run('JSON.stringify(save.records)'),JSON.stringify(legacy.records));
assert.equal(b.run('save.stageClears[0]'),8);
assert.equal(b.run('save.selectedTest'),6);
assert.equal(b.run('term.treasures.length'),2);
b.run('persist()');
assert.deepEqual(JSON.parse(b.storage.get('kanjiQuestRpg_chapter4_v1')).customIds,[115,160]);
assert.equal(JSON.parse(b.storage.get('kanjiQuestRpg_v1')).gold,4321);
// A selection of one old character expands to exactly one sentence, without duplicate problems.
b.run('selectTest(5);startSession("特訓",[114,115,116],true,"custom",-1)');
assert.equal(b.run('session.original.length'),1);
assert.equal(b.run('current.a'),'本の感想を書く。');
assert(!b.nodes.get('question').innerHTML.includes('本'),'saved clue mode must not leak target answers');
const before=b.run('save.gold');b.run('commitJudge("good")');assert.equal(b.run('save.gold'),before,'cannot judge before revealing');
b.run('resize();strokes=[[{x:150,y:20},{x:160,y:35}]]');
const ink=b.run('JSON.stringify(strokes)');const bounds=b.run('JSON.stringify([inkWidth,inkHeight])');
b.run('reveal();resize()');assert.equal(b.run('JSON.stringify(strokes)'),ink);assert.equal(b.run('JSON.stringify([inkWidth,inkHeight])'),bounds);
b.nodes.get('canvas').getBoundingClientRect=()=>({width:600,height:400,left:0,top:0});
b.run('resize()');assert.equal(b.run('JSON.stringify(strokes)'),ink);assert.equal(b.run('inkTransform().scale'),(400-8)/600);
b.run('stopTracing()');
b.run('commitJudge("good")');
assert.equal(b.run('save.gold')-before,4*(6+25+2));
assert(b.run('current.ids.every(id=>save.defeated.includes(id))'));
assert.equal(b.run('save.sentenceRecords[114].good'),1);
assert.equal(b.run('save.records[114].retry'),3,'old character history preserved');
const paid=b.run('save.gold');b.run('commitJudge("good")');assert.equal(b.run('save.gold'),paid,'double judging cannot pay twice');
b.run('finish()');const completed=b.run('save.gold');b.run('finish()');assert.equal(b.run('save.gold'),completed,'chest cannot pay twice');
// Every launch path keeps the test boundary and uses ten sentences at most.
for(const test of [1,2,3,4,5,6,7,8]){
 b.run(`selectTest(${test});startRandomTest()`);assert.equal(b.run('session.original.length'),10);assert(b.run(`session.original.every(id=>SENTENCE_BY_CHAR.get(id).test===${test})`));
 b.run('startRandomAll()');assert.equal(b.run('session.original.length'),10);
}
// Selecting a sentence preserves other tests' legacy selections and expands only this sentence.
b.run('save.customIds=[53,115];selectTest(5);tempCustomIds=[114];saveCustom()');
assert.equal(b.run('JSON.stringify(save.customIds)'),JSON.stringify([53,114,115,116,117]));
assert.equal(b.run('session.original.length'),1);
// Pen coordinates round-trip through the same transform as grid/hint/ink at both orientations.
for(const [width,height] of [[420,900],[600,400]]){
 b.nodes.get('canvas').getBoundingClientRect=()=>({width,height,left:0,top:0});b.run('resize()');
 assert(b.run('(()=>{const t=inkTransform(),p=pt({clientX:150*t.scale+t.x,clientY:250*t.scale+t.y});return Math.abs(p.x-150)<1e-8&&Math.abs(p.y-250)<1e-8})()'));
}
// Per-sentence retry history, completed stage count and old five-area migration.
b.run('startArea(13);reveal();commitJudge("retry")');assert.equal(b.run('save.sentenceRecords[current.id].last'),'retry');assert.equal(b.run('session.done.size'),0);
b.run('startArea(13);session.done=new Set(session.original);finish()');assert.equal(b.run('save.stageClears[13]'),6);
const old=boot({clears:[2],stageClears:{2:7}});assert.equal(old.run('save.stageClears[2]'),7);assert.equal(old.run('save.stageClears[3]'),7);
const reload=boot(JSON.parse(b.storage.get('kanjiQuestRpg_chapter4_v1')),JSON.parse(b.storage.get('kanjiQuestSemester2_v1')),JSON.parse(b.storage.get('kanjiQuestRpg_v1')));
assert.equal(reload.run('save.sentenceRecords[114].last'),'retry');
console.log('PASS: 80 sentences/219 IDs (170 legacy IDs preserved), grouping, all test scopes, old saves, rewards/retries/chest, DOM IDs, and ink preservation.');

// Light smoothing must reduce tiny jitter without pulling corners/flicks far from the pen.
assert(b.run(`(()=>{
 let last={x:0,y:0};let filteredVariation=0,rawVariation=0,previousRaw=last;
 for(let i=1;i<=40;i++){
  const raw={x:i*.4,y:i%2?.3:-.3},p=smoothInkPoint(last,raw);
  filteredVariation+=Math.abs(p.y-last.y);rawVariation+=Math.abs(raw.y-previousRaw.y);
  if(Math.hypot(p.x-raw.x,p.y-raw.y)>.600001)return false;
  last=p;previousRaw=raw;
 }
 const corner=smoothInkPoint(last,{x:80,y:80});
 return filteredVariation<rawVariation&&Math.hypot(corner.x-80,corner.y-80)<=.600001;
})()`));
b.run('startArea(13);stopTracing();resize()');
b.run(`(()=>{
 const t=inkTransform();const event=(type,x,y)=>({type,pointerId:9,button:0,isPrimary:true,clientX:x*t.scale+t.x,clientY:y*t.scale+t.y,preventDefault(){}});
 begin(event('pointerdown',130,20));move(event('pointermove',132,22));end(event('pointerup',133,23));
})()`);
assert(b.run('Math.abs(strokes[0].at(-1).x-133)<1e-8&&Math.abs(strokes[0].at(-1).y-23)<1e-8'));
const smoothed=b.run('JSON.stringify(strokes)');b.run('redraw();resize()');assert.equal(b.run('JSON.stringify(strokes)'),smoothed);
b.run('undo()');assert.equal(b.run('strokes.length'),0);
console.log('PASS: bounded smoothing, exact pen-up endpoint, redraw stability and undo.');

// A save made before mode selection starts in gentle character practice; sentence mode remains available.
const c=boot({areaLayout:2,selectedTest:4,customIds:[88],records:{88:{retry:2,last:'retry'}},stageClears:{9:4}});
assert.equal(c.run('save.practiceMode'),'character');
assert.equal(c.run('save.selectedTest'),4);
assert.equal(c.nodes.get('practiceChar').attrs['aria-pressed'],'true');
assert.equal(c.nodes.get('practiceSentence').attrs['aria-pressed'],'false');
assert.equal(c.run('writingLayout("勝つ").width'),100);
assert.equal(c.run('writingLayout("勝つ").rows'),2);
assert.equal(c.run('practiceQuestions().length'),c.run('selectedQuestions().length'));
assert.equal(c.run('customForTest()[0]'),88);
c.run('startArea(9)');
assert.equal(c.run('session.practiceMode'),'character');
assert.equal(c.run('session.original.length'),c.run('Q.slice(AREAS[9].start,AREAS[9].end).length'));
assert.equal(c.run('current.id'),c.run('Q[AREAS[9].start].id'));
assert.equal(c.run('inkWidth'),100);
assert.equal(c.run('inkHeight'),[...c.run('current.a')].length*100);
assert.equal(c.run('JSON.stringify(save.sentenceRecords)'),'{}');
const charId=c.run('current.id');const charGold=c.run('save.gold');
c.run('reveal();stopTracing();commitJudge("good")');
assert.equal(c.run(`save.records[${charId}].good`),1);
assert.equal(c.run('JSON.stringify(save.sentenceRecords)'),'{}');
assert.equal(c.run('save.gold')-charGold,8);
assert.equal(c.run('save.stageClears[9]'),4,'stage clear only on completion');
c.run('session=null;current=null;selectPracticeMode("sentence")');
assert.equal(c.run('save.practiceMode'),'sentence');
assert.equal(c.nodes.get('practiceSentence').attrs['aria-pressed'],'true');
assert.equal(c.run('writingLayout("勝負に勝つ。").width'),212);
assert.equal(c.run('customForTest().length'),1);
c.run('startRandomTest()');assert.equal(c.run('session.original.length'),10);
assert(c.run('session.original.every(id=>SENTENCE_BY_CHAR.get(id).test===4)'));
const savedSession=c.run('session.practiceMode');
c.run('save.practiceMode="character";repeat()');assert.equal(c.run('session.practiceMode'),savedSession,'repeat holds the selected mode');
c.run('session=null;current=null;selectPracticeMode("character");startRandomTest()');
assert.equal(c.run('session.original.length'),10);
assert(c.run('session.original.every(id=>Q[id-1].test===4)'));
c.run('startRandomAll()');assert.equal(c.run('session.original.length'),c.run('selectedQuestions().length'));
c.run('selectTest(1);startArea(0);session.done=new Set(session.original);finish()');
assert.equal(c.run('save.stageClears[0]'),1);
const reloadedChar=boot(JSON.parse(c.storage.get('kanjiQuestRpg_chapter4_v1')));
assert.equal(reloadedChar.run('save.practiceMode'),'character');
assert.equal(reloadedChar.run(`save.records[${charId}].good`),1);
console.log('PASS: default character mode, both routes/random scopes, independent histories, persisted switch, repeat and shared progression.');

// Drill 28: worksheet targets, full sentences, contiguous IDs, new scopes and treasure.
assert.deepEqual(JSON.parse(b.run('JSON.stringify(SENTENCES.filter(q=>q.test>=7).map(q=>q.a))')),["問いをもつ。","詩を読み返す。","主語とじゅつ語。","明日の予定。","九州にいる友だち。","風船をとばす。","屋根に鳥が止まる。","おもい荷物。","やくそくを守る。","勉強にはげむ。","本は役立つ。","新米を食べる。","話し合いの進行。","返事がとどく。","持ち主をさがす。","主な人物。","屋上に上る。","大根をそだてる。","守びにつく。","る守番をする。"]);
assert(b.run('Q.every((q,i)=>q.id===i+1)'));
assert.equal(b.run('CLUE_P.length'),219);
assert.equal(b.run('Q.filter(q=>q.test===7).length'),24);
assert.equal(b.run('Q.filter(q=>q.test===8).length'),25);
for(const test of [7,8]){
 const n=boot({areaLayout:2,selectedTest:test});
 assert(n.nodes.get('selectedTestRange').textContent.includes('ドリル28'));
 n.run('startRandomTest()');assert(n.run(`session.original.every(id=>Q[id-1].test===${test})`));
 n.run('persist()');assert.equal(boot(JSON.parse(n.storage.get('kanjiQuestRpg_chapter4_v1'))).run('save.selectedTest'),test);
}
const complete=boot({areaLayout:2,selectedTest:7,clears:Array.from({length:19},(_,i)=>i)}, {treasures:['test1','test2','test3'],areaLayouts:{test1:2,test2:2,test3:2}});
assert.equal(complete.run('term.treasures.length'),3);
assert.equal(complete.run('volumeAreas(selectedVolume()).length'),6);
for(let area=19;area<25;area++)complete.run(`startArea(${area});session.done=new Set(session.original);finish()`);
assert(complete.run('term.treasures.includes("test4")'));
console.log('PASS: drill 28 transcription, IDs, both test selections and fourth treasure.');


// Learning flow: a guided model is never submitted as the child's recalled writing.
const lessonBoot=()=>boot({areaLayout:2,selectedTest:1});
const teach=lessonBoot();teach.run('startSession("lesson",[1,2,3,4],true,"custom",-1)');
assert.equal(teach.run('lesson.phase'),'intro');teach.run('lessonMain()');assert.equal(teach.run('lesson.phase'),'demo');
assert(!teach.nodes.get('lessonModel').innerHTML,'no answer in the second board while writing');
teach.run('lessonMain()');assert.equal(teach.run('lesson.phase'),'trace');
// Draw every model stroke through the real handlers in the SVG coordinate system.
function traceLetter(b){b.run(`(()=>{const paths=KANJI_STROKES[activeLetter().ch];const event=(p,pid=7)=>({pointerId:pid,isPrimary:true,button:0,clientX:2+p[0]*416/109,clientY:2+p[1]*416/109,preventDefault(){}});for(const d of paths){const pts=KanjiCore.flatten(d);lessonDown(event(pts[0]));pts.slice(1).forEach(p=>lessonMove(event(p)));lessonUp(event(pts.at(-1)))}})()`)}
traceLetter(teach);assert.equal(teach.run('lesson.phase'),'traceDone');assert.equal(teach.run('save.gold'),0);assert.equal(teach.run('save.learning["両"].traced'),1);
teach.run('lessonMain()');assert.equal(teach.run('lesson.phase'),'write');assert.equal(teach.run('activeLetter().ink.length'),0,'blank canvas after tracing');
teach.run('lessonMain();lessonVerdict("good")');assert.equal(teach.run('save.gold'),0,'blank writing cannot proceed');
function selfCheck(b){b.run('activeLetter().ink=[[[20,20],[70,30]]];lessonMain();lessonVerdict("good")')}
selfCheck(teach);assert.equal(teach.run('save.records[1].good'),1);assert.equal(teach.run('save.learning["両"].independent'),1);assert.equal(teach.run('save.learning["両"].later'),0);
const paidLesson=teach.run('save.gold');teach.run('lessonVerdict("good")');assert.equal(teach.run('save.gold'),paidLesson,'double click cannot pay again');
teach.run('next()');assert.equal(teach.run('current.id'),2,'another problem before recall');
// Simulate later normal questions having been completed, then check the scheduled recall reward boundary.
teach.run('session.done.add(2);session.done.add(3);session.done.add(4);session.turn=4;next()');assert(teach.run('session.reviewing'));assert.equal(teach.run('lesson.phase'),'write');
selfCheck(teach);assert.equal(teach.run('save.gold'),paidLesson);assert.equal(teach.run('save.learning["両"].later'),1);
assert.equal(teach.run('save.records[1].good'),1,'spaced recall does not pay or add a second battle verdict');
// A one-question lesson defers retrieval to a future session rather than calling immediate copying "later".
const one=lessonBoot();one.run('startSession("one",[1],true,"custom",-1);lessonMain();lessonMain()');traceLetter(one);one.run('lessonMain()');selfCheck(one);one.run('next()');assert(one.run('session.finished'));assert.equal(one.run('save.learning["両"].later'),0);assert(one.run('save.learning["両"].waiting'));
const durable=boot(JSON.parse(one.storage.get('kanjiQuestRpg_chapter4_v1')));durable.run('startSession("later",[1],true,"custom",-1);lessonMain()');assert.equal(durable.run('lesson.phase'),'write');selfCheck(durable);assert.equal(durable.run('save.learning["両"].later'),1);
// Unknown verdict ends an attempt without unearned defeat, treasure, route clear or gold; the handwriting survives reload.
const uncertain=lessonBoot();uncertain.run('startSession("uncertain",[1],true,"area",0);lessonMain();lesson.phase="write";activeLetter().ink=[[[11,15],[36,80]]];lessonMain();lessonVerdict("unsure")');
assert(uncertain.run('session.finished'));assert.equal(uncertain.run('session.done.size'),0);assert.equal(uncertain.run('save.gold'),0);assert.equal(uncertain.run('save.stageClears[0]||0'),0);assert.equal(uncertain.run('save.reviewNotes.length'),1);
const notesReload=boot(JSON.parse(uncertain.storage.get('kanjiQuestRpg_chapter4_v1')));assert.equal(notesReload.run('save.reviewNotes[0].ink[0][1][1]'),80);notesReload.run('showReviewNotes()');assert(notesReload.nodes.get('reviewModal').classList.contains('show'));
// Sentence repairs touch only the selected letter and keep the complete original handwriting.
const whole=boot({areaLayout:2,selectedTest:5,practiceMode:'sentence'});whole.run('startSession("sentence",[114],true,"custom",-1);resize();strokes=[[{x:125,y:20},{x:135,y:30}],[{x:125,y:120},{x:140,y:150}]];reveal()');
assert.equal(whole.run('lesson.phase'),'compare');const allInk=whole.run('JSON.stringify(strokes)'),firstInk=whole.run('JSON.stringify(lesson.items[0].ink)');
whole.run('lesson.at=1;lessonVerdict("fix")');assert.equal(whole.run('lesson.phase'),'demo');assert.equal(whole.run('lesson.items[1].repairs'),1);assert.equal(whole.run('JSON.stringify(lesson.items[0].ink)'),firstInk);assert.equal(whole.run('JSON.stringify(strokes)'),allInk);
whole.run('returnToSentence()');assert.equal(whole.run('lesson.at'),1);assert.equal(whole.run('lesson.phase'),'compare');assert.equal(whole.run('JSON.stringify(strokes)'),allInk);
whole.run('lessonVerdict("fix")');assert.equal(whole.run('lesson.items[1].verdict'),'unsure','repair loop is bounded');
// Pointer cancellation, secondary fingers and returned controls cannot silently accept a stroke.
const pen=lessonBoot();pen.run('startSession("pen",[1],true,"custom",-1);lessonMain();lesson.phase="write";lessonDown({pointerId:1,button:0,isPrimary:true,clientX:100,clientY:100,preventDefault(){}});lessonMove({pointerId:2,clientX:200,clientY:200,preventDefault(){}})');assert.equal(pen.run('lesson.points.length'),1);pen.run('lessonCancel({pointerId:1})');assert.equal(pen.run('activeLetter().ink.length'),0);
pen.run('screen("world")');assert.equal(pen.run('lesson'),null);assert(pen.nodes.get('lessonPanel').hidden);
assert(pen.run('SENTENCES.every(q=>[...q.a].every(ch=>"。、".includes(ch)||KANJI_STROKES[ch]?.length))'));
console.log('PASS: integrated lesson/blank recall/large comparison, delayed retrieval, reward guards, persistent review notes, bounded per-letter sentence repairs and pointer cancellation.');
const compareGuard=boot({areaLayout:2,selectedTest:5,practiceMode:'sentence'});compareGuard.run('startSession("compare",[114],true,"custom",-1);reveal();lessonVerdict("good")');assert.equal(compareGuard.run('lesson.items[0].verdict'),null,'blank full-sentence cell cannot be marked correct');
compareGuard.run('lesson.items[0].ink=[[[10,10],[70,60]]];lessonVerdict("good");lesson.at=0;lessonVerdict("good")');assert.equal(compareGuard.run('save.learning[lesson.items[0].ch].independent'),1,'revisiting an already checked letter does not inflate progress');
console.log('PASS: empty-cell and repeated per-letter verdict guards.');
// A hint remains assisted after returning to the full sentence; recall starts on blank paper.
const hinted=boot({areaLayout:2,selectedTest:5,practiceMode:'sentence'});
hinted.run('startSession("hint",[114],true,"custom",-1);useHint();lessonHint();returnToSentence();reveal()');
assert(hinted.run('activeLetter().assisted'),'sentence hint survives the return to writing');
hinted.run('lessonVerdict("fix");activeLetter().ink=[[[10,10],[20,20]]]');
hinted.nodes.get('lessonTry').onclick();
assert.equal(hinted.run('activeLetter().ink.length'),0,'skipping demonstration still starts blank');
const traceUncertain=boot({areaLayout:2,selectedTest:1,practiceMode:'trace'});
traceUncertain.run('startSession("trace",[1],true,"custom",-1);lessonMain();lessonMain();lessonVerdict("unsure")');
assert.equal(traceUncertain.run('save.traceRecords[1].retry'),1);
assert.equal(traceUncertain.run('save.records[1]'),undefined,'trace deferral keeps separate history');
assert(durable.nodes.get('lessonPreview').innerHTML.includes('<b>？</b>'),'learned answers are not disclosed in the route preview');
console.log('PASS: hint provenance, blank recall transition, trace history and concealed review preview.');
