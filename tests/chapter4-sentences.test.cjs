// Run: node tests/chapter4-sentences.test.cjs
// DOM is stubbed: this verifies data, save compatibility, battle flow and ink coordinates, not browser layout.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../chapter4/index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const assets=['kanji-strokes.js','stroke-trace.js'].map(f=>{assert(html.includes(`<script src="${f}"></script>`),`missing ${f}`);return fs.readFileSync(path.join(__dirname,'../chapter4',f),'utf8')});
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
 vm.createContext(sandbox);for(const asset of assets)vm.runInContext(asset,sandbox);vm.runInContext(script,sandbox);
 return {run:code=>vm.runInContext(code,sandbox),nodes,storage,timers};
}
// Plausible writing: as many strokes as the model, inside each writing cell.
const FILL='strokes=[...current.a].flatMap((ch,i)=>{const c=cellPosition(i,writingLayout(current.a,session.practiceMode).rows,session.practiceMode);return Array.from({length:glyph(ch)?.paths.length||1},()=>[{x:c.x+20,y:c.y+20},{x:c.x+80,y:c.y+80}])})';
const legacy={areaLayout:2,selectedTest:6,practiceMode:'sentence',defeated:[1,53,114],records:{114:{retry:3,last:'retry'}},customIds:[115,160],clears:[0,6,13],stageClears:{0:8,6:4,13:5},displayMode:'clue'};
const b=boot(legacy,{treasures:['test1','test2'],fragments:{test1:[0,1,2,3,4,5],test2:[6,7,8,9,10,11,12]},areaLayouts:{test1:2,test2:2}},{xp:5000,gold:4321,owned:['wood','treasure_staff'],weapon:'treasure_staff'});
assert.equal(b.run('SENTENCES.length'),100);
assert.equal(b.run('Math.max(...SENTENCES.map(q=>[...q.a].length))'),10);
assert(b.run('SENTENCES.every(q=>!q.a.endsWith("。")&&!q.answerHtml.endsWith("。"))'),'no trailing period to write');
assert.equal(b.run('SENTENCES.find(q=>q.test===4&&q.s===14).a'),'勝負に勝つ');
assert.equal(b.run('new Set(SENTENCES.flatMap(q=>q.ids)).size'),264);
assert.equal(b.run('SENTENCES.reduce((n,q)=>n+q.ids.length,0)'),264);
assert(b.run('TESTS.every(t=>SENTENCES.filter(q=>q.test===t).length===10)'));
assert(b.run('AREAS.every((a,i)=>sentencesForArea(i).every(q=>q.test===a.block&&q.ids.every(id=>id>a.start&&id<=a.end)))'));
assert.equal(b.run('AREAS.flatMap((a,i)=>sentencesForArea(i)).length'),100);
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
assert.equal(b.run('current.a'),'本の感想を書く');
assert(!b.nodes.get('question').innerHTML.includes('本'),'saved clue mode must not leak target answers');
const before=b.run('save.gold');b.run('judge("good")');assert.equal(b.run('save.gold'),before,'cannot judge before revealing');
b.run('resize();strokes=[[{x:150,y:20},{x:160,y:35}]]');
const ink=b.run('JSON.stringify(strokes)');const bounds=b.run('JSON.stringify([inkWidth,inkHeight])');
b.run('reveal();reveal();resize()');assert.equal(b.run('JSON.stringify(strokes)'),ink);assert.equal(b.run('JSON.stringify([inkWidth,inkHeight])'),bounds);
b.nodes.get('canvas').getBoundingClientRect=()=>({width:600,height:400,left:0,top:0});
b.run('resize()');assert.equal(b.run('JSON.stringify(strokes)'),ink);assert.equal(b.run('inkTransform().scale'),(400-8)/416);
// Hint: the answer shows for a few seconds in the answer cells; writing is kept and paused meanwhile.
b.run('useHint()');assert(!b.run('Boolean(hintPeek)'),'no hint after the answer is shown');
b.run('$("answerPanel").classList.remove("show");useHint()');assert(b.run('Boolean(hintPeek)'));assert.equal(b.run('trace'),null);assert.equal(b.run('JSON.stringify(strokes)'),ink);
b.run('begin({pointerId:1,button:0,isPrimary:true,clientX:320,clientY:30,preventDefault(){}})');assert.equal(b.run('strokes.length+(stroke?1:0)'),1,'no writing while peeking');
b.timers.splice(0).forEach(f=>f());assert(!b.run('Boolean(hintPeek)'));assert.equal(b.run('JSON.stringify(strokes)'),ink);assert(b.run('hintUsed'));b.run('$("answerPanel").classList.add("show")');
// One short stroke is not enough writing for "できた".
const blocked=b.run('save.gold');b.run('judge("good")');assert.equal(b.run('save.gold'),blocked);assert(b.nodes.get('message').classList.contains('bad'));
b.run('hintUsed=false;'+FILL+';revealQuality=inkQuality(strokes)');assert(b.run('revealQuality.ok'));
b.run('judge("good")');
assert.equal(b.run('save.gold')-before,4*(6+25+2));
assert(b.run('current.ids.every(id=>save.defeated.includes(id))'));
assert.equal(b.run('save.sentenceRecords[114].good'),1);
assert.equal(b.run('save.records[114].retry'),3,'old character history preserved');
const paid=b.run('save.gold');b.run('judge("good")');assert.equal(b.run('save.gold'),paid,'double judging cannot pay twice');
b.run('finish()');const completed=b.run('save.gold');b.run('finish()');assert.equal(b.run('save.gold'),completed,'chest cannot pay twice');
// Every launch path keeps the test boundary and uses ten sentences at most.
for(const test of [1,2,3,4,5,6,7,8,9,10]){
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
b.run('startArea(13);reveal();reveal();judge("retry")');assert.equal(b.run('save.sentenceRecords[current.id].last'),'retry');assert.equal(b.run('session.done.size'),0);
b.run('startArea(13);session.done=new Set(session.original);finish()');assert.equal(b.run('save.stageClears[13]'),6);
const old=boot({clears:[2],stageClears:{2:7}});assert.equal(old.run('save.stageClears[2]'),7);assert.equal(old.run('save.stageClears[3]'),7);
const reload=boot(JSON.parse(b.storage.get('kanjiQuestRpg_chapter4_v1')),JSON.parse(b.storage.get('kanjiQuestSemester2_v1')),JSON.parse(b.storage.get('kanjiQuestRpg_v1')));
assert.equal(reload.run('save.sentenceRecords[114].last'),'retry');
console.log('PASS: 100 sentences/264 IDs, grouping, all test scopes, old saves, rewards/retries/chest, DOM IDs, and ink preservation.');

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
b.run('startArea(13);resize()');
b.run(`(()=>{
 const t=inkTransform();const event=(type,x,y)=>({type,pointerId:9,button:0,isPrimary:true,clientX:x*t.scale+t.x,clientY:y*t.scale+t.y,preventDefault(){}});
 begin(event('pointerdown',276,40));move(event('pointermove',278,42));end(event('pointerup',279,43));
})()`);
assert(b.run('Math.abs(strokes[0].at(-1).x-279)<1e-8&&Math.abs(strokes[0].at(-1).y-43)<1e-8'));
const smoothed=b.run('JSON.stringify(strokes)');b.run('redraw();resize()');assert.equal(b.run('JSON.stringify(strokes)'),smoothed);
b.run('undo()');assert.equal(b.run('strokes.length'),0);
console.log('PASS: bounded smoothing, exact pen-up endpoint, redraw stability and undo.');

// A save made before mode selection starts in gentle character practice; sentence mode remains available.
const c=boot({areaLayout:2,selectedTest:4,customIds:[88],records:{88:{retry:2,last:'retry'}},stageClears:{9:4}});
assert.equal(c.run('save.practiceMode'),'character');
assert.equal(c.run('save.selectedTest'),4);
assert.equal(c.nodes.get('practiceChar').attrs['aria-pressed'],'true');
assert.equal(c.nodes.get('practiceSentence').attrs['aria-pressed'],'false');
assert.equal(c.run('writingLayout("勝つ").width'),212);
assert.equal(c.run('writingLayout("勝つ").rows'),2);
assert.equal(c.run('practiceQuestions().length'),c.run('selectedQuestions().length'));
assert.equal(c.run('customForTest()[0]'),88);
c.run('startArea(9)');
assert.equal(c.run('session.practiceMode'),'character');
assert.equal(c.run('session.original.length'),c.run('Q.slice(AREAS[9].start,AREAS[9].end).length'));
assert.equal(c.run('current.id'),c.run('Q[AREAS[9].start].id'));
assert.equal(c.run('inkWidth'),212);
assert.equal(c.run('inkHeight'),16+[...c.run('current.a')].length*100);
assert.equal(c.run('JSON.stringify(save.sentenceRecords)'),'{}');
const charId=c.run('current.id');const charGold=c.run('save.gold');
c.run(FILL+';reveal();reveal();judge("good")');
assert.equal(c.run(`save.records[${charId}].good`),1);
assert.equal(c.run('JSON.stringify(save.sentenceRecords)'),'{}');
assert.equal(c.run('save.gold')-charGold,8);
assert.equal(c.run('save.stageClears[9]'),4,'stage clear only on completion');
c.run('session=null;current=null;selectPracticeMode("sentence")');
assert.equal(c.run('save.practiceMode'),'sentence');
assert.equal(c.nodes.get('practiceSentence').attrs['aria-pressed'],'true');
assert.equal(c.run('writingLayout("勝負に勝つ。").width'),356);
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
assert.deepEqual(JSON.parse(b.run('JSON.stringify(SENTENCES.filter(q=>q.test>=7&&q.test<=8).map(q=>q.a))')),["問いをもつ","詩を読み返す","主語とじゅつ語","明日の予定","九州にいる友だち","風船をとばす","屋根に鳥が止まる","おもい荷物","やくそくを守る","勉強にはげむ","本は役立つ","新米を食べる","話し合いの進行","返事がとどく","持ち主をさがす","主な人物","屋上に上る","大根をそだてる","守びにつく","る守番をする"]);
assert(b.run('Q.every((q,i)=>q.id===i+1)'));
assert.equal(b.run('CLUE_P.length'),264);
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

// Drill 36: preserve kana outside the worksheet's lines, including unlearned kanji.
assert.deepEqual(JSON.parse(b.run('JSON.stringify(SENTENCES.filter(q=>q.test>=9).map(q=>q.a))')),[
 '大豆を食べる','植物が育つ','消化のよい食べ物','豆まきをする','えいようを取り出す',
 'しゅうかくの時期','畑の肉とよばれる','物語が終わる','福をよびこむ','家へ急ぐ',
 '早起きをする','苦ろうがむくわれる','多少ちがいがある','待ち合わせの場所','先生に相談する',
 '風で火が消える','取ざいをうける','いきが苦しい','苦い薬をのむ','期待でむねがふくらむ'
]);
assert.equal(b.run('Q.filter(q=>q.test===9).length'),23);
assert.equal(b.run('Q.filter(q=>q.test===10).length'),22);
assert.equal(b.run('AREAS.length'),31);
for(const test of [9,10])for(const mode of ['character','sentence','trace']){
 const n=boot({areaLayout:2,selectedTest:test,practiceMode:mode});
 assert(n.nodes.get('selectedTestRange').textContent.includes('ドリル36'));
 assert(n.nodes.get('selectedTestRange').textContent.includes(test===9?'1〜10':'11〜20'));
 n.run('startRandomTest()');assert.equal(n.run('session.original.length'),10);
 assert(n.run(`session.original.every(id=>Q[id-1].test===${test})`));
 n.run('startRandomAll()');assert.equal(n.run('session.original.length'),mode==='sentence'?10:test===9?23:22);
 assert(n.run(`session.original.every(id=>Q[id-1].test===${test})`));
 for(const area of test===9?[25,26,27]:[28,29,30]){
  n.run(`startArea(${area})`);assert(n.run(`session.original.every(id=>Q[id-1].test===${test})`));
 }
 n.run('persist()');const reload=boot(JSON.parse(n.storage.get('kanjiQuestRpg_chapter4_v1')));
 assert.equal(reload.run('save.selectedTest'),test);assert.equal(reload.run('save.practiceMode'),mode);
}
const fifth=boot({areaLayout:2,selectedTest:9,clears:Array.from({length:25},(_,i)=>i),stageClears:{24:9}},
 {treasures:['test1','test2','test3','test4'],areaLayouts:{test1:2,test2:2,test3:2,test4:2}});
assert.equal(fifth.run('term.treasures.length'),4);
assert.equal(fifth.run('save.stageClears[24]'),9);
assert.equal(fifth.run('volumeAreas(selectedVolume()).length'),6);
for(let area=25;area<30;area++)fifth.run(`startArea(${area});session.done=new Set(session.original);finish()`);
assert(!fifth.run('term.treasures.includes("test5")'),'all six new routes required');
fifth.run('startArea(30);session.done=new Set(session.original);finish()');
assert.equal(fifth.run('JSON.stringify(term.treasures)'),JSON.stringify(['test1','test2','test3','test4','test5']));
console.log('PASS: drill 36 transcription, all three modes, test boundaries, selection persistence and fifth treasure.');

// Tracing: KanjiVG glyphs, stroke judging, trace practice mode, hint and review flows.
assert.equal(b.run('Object.keys(KANJI_STROKES).length'),254);
assert(b.run('Q.every(q=>[...q.a].every(ch=>KANJI_STROKES[ch]))'),'every answer character has stroke data');
assert(b.run('SENTENCES.every(q=>[...q.a].every(ch=>KANJI_STROKES[ch]))'),'every sentence character has stroke data');
assert(b.run('StrokeTrace.judgeStroke(StrokeTrace.flatten(KANJI_STROKES["一"][0]),KANJI_STROKES["一"][0]).ok'));
assert(!b.run('StrokeTrace.judgeStroke(StrokeTrace.flatten(KANJI_STROKES["一"][0]).reverse(),KANJI_STROKES["一"][0]).ok'),'reverse stroke is rejected');
assert.equal((b.run('glyphHtml("<span class=\\"answer-target\\">本</span>。")').match(/<svg/g)||[]).length,2);
const t=boot({areaLayout:2,selectedTest:3,practiceMode:'trace'});
assert.equal(t.nodes.get('practiceTrace').attrs['aria-pressed'],'true');
assert(t.nodes.get('eliteStart').disabled,'elite trial is closed in trace practice');
t.run('startArea(6)');
assert.equal(t.run('trace.kind'),'mode');assert(t.nodes.get('answerPanel').classList.contains('show'));
const traceAll=`(()=>{for(let guard=0;trace&&trace.pos<trace.steps.length&&guard<200;guard++){const tr=inkTransform(),s=trace.steps[trace.pos],pts=s.pts.map(([x,y])=>({clientX:(s.x+x*KV)*tr.scale+tr.x,clientY:(s.y+y*KV)*tr.scale+tr.y}));
 begin({pointerId:5,button:0,isPrimary:true,...pts[0],preventDefault(){}});for(const p of pts.slice(1))move({pointerId:5,...p,preventDefault(){}});end({type:'pointerup',pointerId:5,...pts.at(-1),preventDefault(){}})}})()`;
const tGold=t.run('save.gold'),tId=t.run('current.id');
// Only kanji are traced, one large cell at a time (no okurigana).
assert.equal(t.run('JSON.stringify(trace.cells.map(i=>[...current.a][i]))'),JSON.stringify([...t.run('current.a')].filter(ch=>/\p{Script=Han}/u.test(ch))));
assert.equal(t.run('JSON.stringify([inkWidth,inkHeight])'),'[100,100]');
t.run(traceAll);
assert.equal(t.run(`save.traceRecords[${tId}].done`),1);
assert.equal(t.run('save.gold')-tGold,Math.ceil((6+0+2)/2));
assert(!t.run(`save.defeated.includes(${tId})`),'tracing does not register the monster book');
assert.equal(t.run('JSON.stringify(save.records)'),'{}');
t.run('session.done=new Set(session.original);finish()');
assert.equal(t.run('save.stageClears[6]||0'),0,'trace practice does not award route clears');
assert(!t.run('term.fragments.test2.includes(6)'));
assert.equal(boot(JSON.parse(t.storage.get('kanjiQuestRpg_chapter4_v1'))).run(`save.traceRecords[${tId}].done`),1);
// Hint: tracing a character problem, then the guide disappears so the child writes from memory.
t.run('session=null;current=null;selectPracticeMode("character");startArea(6)');
// "おしい" and "もう一回" show the answer as a tracing exercise before the next problem.
for(const kind of ['close','retry']){
 const id=t.run('current.id');t.run(`reveal();reveal();judge("${kind}")`);t.timers.splice(0).forEach(f=>f());
 assert.equal(t.run('trace&&trace.kind'),'review');assert.equal(t.run('current.id'),id);
 t.run(traceAll);t.timers.splice(0).forEach(f=>f());
 assert.equal(t.run('trace'),null);assert.notEqual(t.run('current.id'),id,'next problem after tracing');
}
// Three misses on a stroke draws it together and moves on.
t.run('reveal();reveal();judge("retry")');t.timers.splice(0).forEach(f=>f());const pos0=t.run('trace.pos');
for(let i=0;i<3;i++)t.run('begin({pointerId:7,button:0,isPrimary:true,clientX:1,clientY:1,preventDefault(){}});move({pointerId:7,clientX:2,clientY:300,preventDefault(){}});end({type:"pointerup",pointerId:7,clientX:2,clientY:300,preventDefault(){}})');
assert.equal(t.run('trace.pos'),pos0+1);
console.log('PASS: KanjiVG coverage, stroke judging, trace practice rewards/records, hint tracing and review tracing after close/retry.');

// The answer is drawn in the same-size cell right beside each written cell; the writing cells never move.
assert.equal(b.run('JSON.stringify(cellPosition(0,6,"sentence"))'),JSON.stringify({x:256,y:16,mx:186,my:35,ms:62,col:0}));
assert.equal(b.run('JSON.stringify(cellPosition(6,6,"sentence"))'),JSON.stringify({x:70,y:16,mx:0,my:35,ms:62,col:1}));
assert.equal(b.run('JSON.stringify(cellPosition(1,2,"character"))'),JSON.stringify({x:112,y:116,mx:0,my:116,ms:100,col:0}));
assert.equal(b.run('writingLayout("問いをもつ。","sentence").rows'),3,'short sentences get fewer, larger rows');
assert(b.run('onWritingCell({x:160,y:60},"character")')&&!b.run('onWritingCell({x:50,y:60},"character")'),'answer cells are not for writing');
console.log('PASS: answers beside each handwritten cell.');

// Parent-only ink log: the writing at "答えを見る" is kept with the self-judgement, outside the transferable kanjiQuest* keys.
const p=boot({areaLayout:2,selectedTest:3});
p.run('startArea(6);resize();strokes=[[{x:150.4,y:40.2},{x:160,y:80}],[{x:170,y:30}]];reveal();reveal();strokes.push([{x:120,y:50},{x:121,y:90}]);judge("good")');
assert.equal(p.storage.get('kq4ParentInkLog_v1'),undefined,'too little writing: "できた" is refused');
p.run('judge("close")');
const log=JSON.parse(p.storage.get('kq4ParentInkLog_v1'));
assert.equal(log.length,1);assert.equal(log[0].kind,'close');assert.equal(log[0].warned,true);assert.equal(log[0].a,p.run('current.a'));
assert.deepEqual(log[0].ink,[[150,40,160,80],[170,30]],'ink is the writing at reveal time');
assert.equal(log[0].after,1,'strokes added after seeing the answer are counted');
assert(!'kq4ParentInkLog_v1'.startsWith('kanjiQuest'),'not part of save transfer');
p.timers.splice(0).forEach(f=>f());p.run(traceAll);p.timers.splice(0).forEach(f=>f());
// Hint, then "できた": the monster survives and comes back later.
const hid=p.run('current.id');p.run('useHint()');p.timers.splice(0).forEach(f=>f());p.run(FILL+';reveal();reveal();judge("good")');
assert.equal(JSON.parse(p.storage.get('kq4ParentInkLog_v1'))[1].hint,true);
assert(!p.run(`session.done.has(${hid})`),'hinted answer is asked again');assert(p.run(`session.queue.includes(${hid})`));assert.equal(p.run(`session.hps[${hid}]`),1);
p.run('session=null;current=null;selectPracticeMode("trace");startArea(6)');p.run(traceAll);
assert.equal(JSON.parse(p.storage.get('kq4ParentInkLog_v1')).length,2,'trace practice is not logged');
p.run('prompt=()=>"0";openParent()');assert(!p.nodes.get('parent').classList.contains('active'),'gate blocks a wrong answer');
p.run('Math.random=()=>0;prompt=()=>"１４４";openParent()');assert(p.nodes.get('parent').classList.contains('active'));
assert.equal((p.nodes.get('parentList').innerHTML.match(/<svg/g)||[]).length,1,'only "できた" by default');
p.run('parentFilter="all";renderParent()');assert.equal((p.nodes.get('parentList').innerHTML.match(/<svg/g)||[]).length,2);
p.run('writeInkLog(Array.from({length:130},(_,i)=>({t:i,id:53,mode:"character",test:3,s:1,a:"鉄",kind:"good",ms:0,ink:[],after:0})))');
assert.equal(JSON.parse(p.storage.get('kq4ParentInkLog_v1')).length,120);
console.log('PASS: parent ink log (reveal-time ink, later strokes, hint flag, gate, filters, cap).');

// Too little writing: the first "答えを見る" only warns; a second press shows the answer but "できた" stays closed.
const r=boot({areaLayout:2,selectedTest:3});
r.run('startArea(6);resize();reveal()');
assert(!r.nodes.get('answerPanel').classList.contains('show'),'blank writing: warn before showing the answer');
assert(r.nodes.get('message').classList.contains('bad'));
r.run(FILL+';reveal()');assert(r.nodes.get('answerPanel').classList.contains('show'),'written after the warning: answer shows');
assert(r.run('revealQuality.ok'));assert(!r.nodes.get('good').classList.contains('blocked'));
r.run('judge("good")');assert(r.run('locked'),'proper writing is accepted');
const r2=boot({areaLayout:2,selectedTest:3});
r2.run('startArea(6);resize();reveal();reveal()');assert(r2.nodes.get('answerPanel').classList.contains('show'));
assert(r2.nodes.get('good').classList.contains('blocked'));r2.run(FILL+';judge("good")');assert(!r2.run('locked'),'writing after seeing the answer does not count');
console.log('PASS: warning before revealing with too little writing.');

// Automatic grading with Claude (SDK replaced by a fake; no network).
(async()=>{
 const a=boot({areaLayout:2,selectedTest:8});
 const setup=`localStorage.setItem("kq4ClaudeApiKey","sk-ant-test");renderInkImage=()=>"AAAA";calls=[];reply=null;
  loadAnthropic=async()=>{class Fake{constructor(o){this.o=o;this.beta={messages:{create:async p=>{calls.push({o:this.o,p});if(reply instanceof Error)throw reply;return {stop_reason:"end_turn",content:[{type:"text",text:JSON.stringify(reply)}]}}}}}}Fake.APIError=class extends Error{};Fake.AuthenticationError=class extends Fake.APIError{};Fake.PermissionDeniedError=class extends Fake.APIError{};Fake.RateLimitError=class extends Fake.APIError{};Fake.APIConnectionError=class extends Fake.APIError{};return Fake};`;
 a.run('var calls,reply;'+setup);
 const flush=()=>new Promise(r=>setTimeout(r,0));
 assert(!'kq4ClaudeApiKey'.startsWith('kanjiQuest'),'API key is not exported in save codes');
 a.run('startArea(22)');assert.equal(a.nodes.get('showAnswer').textContent,'📝 採点する');a.timers.splice(0);
 // Correct writing → "good" applied automatically, no self-judge buttons.
 a.run(`reply={chars:[{index:1,ok:true,note:""}],verdict:"good",advice:"すばらしい！"};`+FILL+';reveal()');
 assert(a.run('Boolean(grading)'));a.run('begin({pointerId:3,button:0,isPrimary:true,clientX:200,clientY:200,preventDefault(){}})');assert.equal(a.run('stroke'),null,'no writing while grading');
 await flush();await flush();
 const call=a.run('calls[0]');assert.equal(call.p.model,'claude-opus-5-5');assert.equal(call.p.output_config.effort,'high');assert.equal(call.p.output_config.format.type,'json_schema');
 assert.equal(call.p.messages[0].content[0].source.data,'AAAA');assert(call.p.messages[0].content[1].text.includes(a.run('current.a')));assert.equal(call.o.dangerouslyAllowBrowser,true);assert.equal(call.o.apiKey,'sk-ant-test');
 // The result stays until "わかった！"; nothing advances on a timer meanwhile.
 assert(!a.nodes.get('gradeCard').hidden);assert.equal(a.nodes.get('gradeMark').textContent,'⭕ 合格！');assert.equal(a.nodes.get('gradeAdvice').textContent,'すばらしい！');
 assert(!a.run('locked'));assert.equal(a.timers.length,0,'no timer while the result is shown');assert(!a.nodes.get('questPanel').classList.contains('answering'));
 a.run('$("gradeOk").onclick()');assert(a.nodes.get('gradeCard').hidden);
 assert(a.run('locked'),'judged after reading');assert(a.nodes.get('message').textContent.startsWith('すばらしい！'));
 assert.equal(JSON.parse(a.storage.get('kq4ParentInkLog_v1')).at(-1).ai.v,'good');
 a.timers.splice(0).forEach(f=>f());
 // A missing dot → "close": monster survives, review tracing keeps the advice visible.
 const cid=a.run('current.id');a.run(`reply={chars:[{index:1,ok:false,note:"屋根の下の点がない"}],verdict:"close",advice:"屋根の下に点をわすれずに！"};`+FILL+';reveal()');await flush();await flush();
 assert((a.nodes.get('gradeFixes').innerHTML.match(/<svg/g)||[]).length===2,'wrong character: answer and own writing side by side');assert(a.nodes.get('gradeFixes').innerHTML.includes('1文字目'));
 a.run('$("gradeOk").onclick()');
 assert.equal(a.run(`save.records[${cid}].last`),'close');a.timers.splice(0).forEach(f=>f());
 assert.equal(a.run('trace&&trace.kind'),'review');assert(a.nodes.get('message').textContent.startsWith('屋根の下に点をわすれずに！'));
 assert.equal(JSON.parse(a.storage.get('kq4ParentInkLog_v1')).at(-1).ai.chars[0].note,'屋根の下の点がない');
 a.run(traceAll);a.timers.splice(0).forEach(f=>f());
 // "good" with a wrong character is downgraded.
 a.run(`reply={chars:[{index:1,ok:false,note:"別の字"}],verdict:"good",advice:"x"};`+FILL+';reveal()');await flush();await flush();a.run('$("gradeOk").onclick()');
 assert.equal(JSON.parse(a.storage.get('kq4ParentInkLog_v1')).at(-1).kind,'close');a.timers.splice(0).forEach(f=>f());a.run(traceAll);a.timers.splice(0).forEach(f=>f());
 // API failure → falls back to self-judging for this problem.
 a.run('reply=new (anthropicSdk.AuthenticationError)("bad key");'+FILL+';reveal()');await flush();await flush();
 assert(a.nodes.get('questPanel').classList.contains('answering'),'self-judge buttons appear');assert(a.nodes.get('message').textContent.includes('APIキーを確認'));assert(!a.run('locked'));
 a.run('judge("retry")');a.timers.splice(0).forEach(f=>f());a.run(traceAll);a.timers.splice(0).forEach(f=>f());
 // Blank → second press counts as "もう一回" without calling the API.
 const n=a.run('calls.length');a.run('reveal();reveal();$("gradeOk").onclick()');assert.equal(a.run('calls.length'),n);assert(a.run('locked'));a.timers.splice(0).forEach(f=>f());a.run(traceAll);a.timers.splice(0).forEach(f=>f());
 // Switch to self-judging and settings UI.
 // Only kanji are sent (with the model beside the child's writing); result numbers map back to answer positions.
 a.run('reply={chars:[{index:1,ok:false,missing:"点",extra:"",wrong_part:"",note:"点がない"},{index:2,ok:false,missing:"",extra:"",wrong_part:"",note:"x"}],verdict:"close",advice:"点を書こう"};gradeWithClaude("AAAA",{a:"明日の予定"}).then(r=>{kanaResult=r});var kanaResult');await flush();await flush();
 const sent=a.run('calls.at(-1).p.messages[0].content[1].text');assert(sent.includes('漢字4字'));assert(sent.includes('3字目：「予」'));assert(!sent.includes('の'),'hiragana is not sent');
 assert.equal(a.run('JSON.stringify(kanaResult.chars.map(c=>c.index))'),'[1,2]');
 a.run('reply={chars:[{index:3,ok:false,missing:"",extra:"よこぼう",wrong_part:"",note:"線が多い"}],verdict:"close",advice:"x"};gradeWithClaude("AAAA",{a:"明日の予定"}).then(r=>{kanaResult=r})');await flush();await flush();
 assert.equal(a.run('JSON.stringify(kanaResult.chars.map(c=>c.index))'),'[4]','3rd kanji is the 4th character');
 a.run('reply={chars:[{index:9,ok:false,missing:"",extra:"",wrong_part:"",note:"?"}],verdict:"retry",advice:"x"};gradeWithClaude("AAAA",{a:"食べる"}).then(r=>{kanaResult=r})');await flush();await flush();
 assert.equal(a.run('kanaResult.verdict'),'good','out-of-range marks are ignored');
 assert(a.run('GRADE_SCHEMA.properties.chars.items.required.join()')==='index,missing,extra,wrong_part,ok,note');
 // Model switch: Haiku sends no server-side fallback.
 a.run('const v=readGradeSettings();v.model="haiku";writeGradeSettings(v);'+FILL+';reveal()');await flush();await flush();
 assert.equal(a.run('calls.at(-1).p.model'),'claude-haiku-5-5');assert.equal(a.run('calls.at(-1).p.fallbacks'),undefined);
 a.run('$("gradeOk").onclick()');a.timers.splice(0).forEach(f=>f());a.run(traceAll);a.timers.splice(0).forEach(f=>f());
 a.run('const w=readGradeSettings();w.model="sonnet";writeGradeSettings(w);renderGradeSettings()');assert(a.nodes.get('gradeStatus').textContent.includes('Sonnet 5.5'));
 a.run('setGradeMode(false);session=null;current=null;startArea(22)');assert.equal(a.nodes.get('showAnswer').textContent,'答えを見る');
 a.run(FILL+';reveal()');assert(a.nodes.get('questPanel').classList.contains('answering'));
 a.run('renderGradeSettings()');assert(a.nodes.get('gradeStatus').textContent.includes('自己採点'));
 a.run('setGradeMode(true);renderGradeSettings()');assert(a.nodes.get('gradeStatus').textContent.includes('…test'));
 a.run('confirm=()=>true;deleteApiKey();session=null;current=null;startArea(22)');assert.equal(a.nodes.get('showAnswer').textContent,'答えを見る','no key → self-judging');
 console.log('PASS: automatic grading (request shape, verdicts, advice, failures, blank, switch).');
})().catch(e=>{console.error(e);process.exit(1)});

