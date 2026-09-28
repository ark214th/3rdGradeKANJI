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
 vm.createContext(sandbox);vm.runInContext(script,sandbox);
 return {run:code=>vm.runInContext(code,sandbox),nodes,storage,timers};
}
const legacy={areaLayout:2,selectedTest:6,defeated:[1,53,114],records:{114:{retry:3,last:'retry'}},customIds:[115,160],clears:[0,6,13],stageClears:{0:8,6:4,13:5},displayMode:'clue'};
const b=boot(legacy,{treasures:['test1','test2'],fragments:{test1:[0,1,2,3,4,5],test2:[6,7,8,9,10,11,12]},areaLayouts:{test1:2,test2:2}},{xp:5000,gold:4321,owned:['wood','treasure_staff'],weapon:'treasure_staff'});
assert.equal(b.run('SENTENCES.length'),60);
assert.equal(b.run('Math.max(...SENTENCES.map(q=>[...q.a].length))'),11);
assert.equal(b.run('SENTENCES.find(q=>q.test===4&&q.s===14).a'),'勝負に勝つ。');
assert.equal(b.run('new Set(SENTENCES.flatMap(q=>q.ids)).size'),170);
assert.equal(b.run('SENTENCES.reduce((n,q)=>n+q.ids.length,0)'),170);
assert(b.run('TESTS.every(t=>SENTENCES.filter(q=>q.test===t).length===10)'));
assert(b.run('AREAS.every((a,i)=>sentencesForArea(i).every(q=>q.test===a.block&&q.ids.every(id=>id>a.start&&id<=a.end)))'));
assert.equal(b.run('AREAS.flatMap((a,i)=>sentencesForArea(i)).length'),60);
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
const before=b.run('save.gold');b.run('judge("good")');assert.equal(b.run('save.gold'),before,'cannot judge before revealing');
b.run('resize();strokes=[[{x:150,y:20},{x:160,y:35}]]');
const ink=b.run('JSON.stringify(strokes)');const bounds=b.run('JSON.stringify([inkWidth,inkHeight])');
b.run('reveal();resize()');assert.equal(b.run('JSON.stringify(strokes)'),ink);assert.equal(b.run('JSON.stringify([inkWidth,inkHeight])'),bounds);
b.nodes.get('canvas').getBoundingClientRect=()=>({width:600,height:400,left:0,top:0});
b.run('resize()');assert.equal(b.run('JSON.stringify(strokes)'),ink);assert.equal(b.run('inkTransform().scale'),(400-8)/600);
b.run('useHint();begin({pointerId:1,button:0,isPrimary:true,clientX:320,clientY:30,preventDefault(){}});move({pointerId:1,clientX:322,clientY:34,preventDefault(){}});end({pointerId:1,cancelable:false})');
assert(b.run('hintVisible'),'writing must not hide tracing hint');
b.run('judge("good")');
assert.equal(b.run('save.gold')-before,4*(6+25+2));
assert(b.run('current.ids.every(id=>save.defeated.includes(id))'));
assert.equal(b.run('save.sentenceRecords[114].good'),1);
assert.equal(b.run('save.records[114].retry'),3,'old character history preserved');
const paid=b.run('save.gold');b.run('judge("good")');assert.equal(b.run('save.gold'),paid,'double judging cannot pay twice');
b.run('finish()');const completed=b.run('save.gold');b.run('finish()');assert.equal(b.run('save.gold'),completed,'chest cannot pay twice');
// Every launch path keeps the test boundary and uses ten sentences at most.
for(const test of [1,2,3,4,5,6]){
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
b.run('startArea(13);reveal();judge("retry")');assert.equal(b.run('save.sentenceRecords[current.id].last'),'retry');assert.equal(b.run('session.done.size'),0);
b.run('startArea(13);session.done=new Set(session.original);finish()');assert.equal(b.run('save.stageClears[13]'),6);
const old=boot({clears:[2],stageClears:{2:7}});assert.equal(old.run('save.stageClears[2]'),7);assert.equal(old.run('save.stageClears[3]'),7);
const reload=boot(JSON.parse(b.storage.get('kanjiQuestRpg_chapter4_v1')),JSON.parse(b.storage.get('kanjiQuestSemester2_v1')),JSON.parse(b.storage.get('kanjiQuestRpg_v1')));
assert.equal(reload.run('save.sentenceRecords[114].last'),'retry');
console.log('PASS: 60 sentences/170 legacy IDs, grouping, all test scopes, old saves, rewards/retries/chest, DOM IDs, and ink preservation.');

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
 begin(event('pointerdown',130,20));move(event('pointermove',132,22));end(event('pointerup',133,23));
})()`);
assert(b.run('Math.abs(strokes[0].at(-1).x-133)<1e-8&&Math.abs(strokes[0].at(-1).y-23)<1e-8'));
const smoothed=b.run('JSON.stringify(strokes)');b.run('redraw();resize()');assert.equal(b.run('JSON.stringify(strokes)'),smoothed);
b.run('undo()');assert.equal(b.run('strokes.length'),0);
console.log('PASS: bounded smoothing, exact pen-up endpoint, redraw stability and undo.');


// The real recognizer runs independently of the DOM, with no correct answer supplied.
const workerContext={console:{log(){}},postMessage(){}};workerContext.self=workerContext;
vm.createContext(workerContext);
workerContext.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../chapter4',file),'utf8'),workerContext));
vm.runInContext(fs.readFileSync(path.join(__dirname,'../chapter4/recognition-worker.js'),'utf8'),workerContext);
const recognize=strokes=>workerContext.recognizeCell(strokes);
const patterns=workerContext.KanjiCanvas.refPatterns;
const answerChars=b.run('[...new Set(SENTENCES.flatMap(q=>[...q.a]))]');
for(const char of answerChars)if(!/[。、ゃゅょっ]/u.test(char))assert(patterns.some(p=>p[0]===char),`missing recognition pattern: ${char}`);
assert.equal(recognize([]).status,'empty');
assert.equal(recognize([[[50,50],[50,50]]]).status,'uncertain');
assert.equal(recognize([[[NaN,0],[20,20]]]).status,'uncertain');
for(const char of ['本','感','想','く','の','が','一']){
 const pattern=patterns.find(p=>p[0]===char)[2];
 // Translation, size variation and deterministic small jitter. This is NOT a child's handwriting sample.
 const rough=pattern.map(s=>s.map(([x,y],i)=>[x*.83+12+(i%2?1:-1),y*.91+6+(i%3-1)]));
 assert.equal(recognize(rough).candidates[0].text,char,`synthetic recognition: ${char}`);
}
assert.equal(b.run('recognitionMark("本",{status:"read",candidates:[{text:"本",distance:30},{text:"木",distance:45}]})'),'○');
assert.equal(b.run('recognitionMark("感",{status:"read",candidates:[{text:"本",distance:30},{text:"木",distance:45}]})'),'×');
assert.equal(b.run('recognitionMark("感",{status:"read",candidates:[{text:"本",distance:30},{text:"感",distance:45}]})'),'？');
assert.equal(b.run('recognitionMark("本",{status:"read",candidates:[{text:"木",distance:90}]})'),'？');
assert.equal(b.run('recognitionMark("。",null)'),'・');
assert.equal(b.run('recognitionMark("っ",{status:"read",candidates:[{text:"つ",distance:10}]})'),'？');
// Fake transport verifies races, errors and self-marking while the real worker is busy.
b.run(`globalThis.Worker=class {constructor(){globalThis.lastWorker=this;this.terminated=false}postMessage(data){this.request=data}terminate(){this.terminated=true}};
startArea(13);resize();strokes=[[{x:130,y:20},{x:180,y:70}],[{x:15,y:20},{x:75,y:70}]];reveal();`);
assert.equal(b.run('lastWorker.request.cells[0].length'),1);
assert.equal(b.run('lastWorker.request.cells[6].length'),1);
assert.equal(b.run('Object.keys(lastWorker.request).join(",")'),'id,cells','answer must not be sent to recognizer');
const savedBefore=b.run('JSON.stringify(save)');
b.run('lastWorker.onmessage({data:{id:lastWorker.request.id,index:0,result:{status:"read",candidates:[{text:"本",distance:20}]},done:false}})');
assert.equal(b.run('recognitionResults[0].mark'),'○');
assert.equal(b.run('JSON.stringify(save)'),savedBefore,'recognition must never award or grade');
b.run('globalThis.oldWorker=lastWorker;undo()');
assert(b.run('oldWorker.terminated'));
b.run('oldWorker.onmessage({data:{id:oldWorker.request.id,index:0,result:{status:"read",candidates:[{text:"本",distance:20}]},done:true}})');
assert.equal(b.run('recognitionResults.length'),0,'ignore a stale result after undo');
b.run('startRecognition();lastWorker.onerror()');
assert.equal(b.run('recognitionResults.length'),0);
assert(!b.nodes.get('good').disabled,'worker failure must not block self-marking');
b.run('startRecognition();judge("retry")');
assert(b.run('lastWorker.terminated'));
assert.equal(b.run('save.sentenceRecords[current.id].last'),'retry','user judgment remains authoritative');
console.log('PASS: real local recognition, model coverage, advisory marks, stale-worker rejection, failure fallback and independent self-marking.');
