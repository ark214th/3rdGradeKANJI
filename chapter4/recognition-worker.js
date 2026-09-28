/* Isolated, local-only recognition. No answer or reward data enters this worker. */
"use strict";
self.window = self;
self.document = {addEventListener(){}};
importScripts("vendor/kanji-canvas.js", "vendor/ref-patterns.js", "vendor/kana-patterns.js");

function recognizeCell(strokes) {
  if (!strokes.length) return {status:"empty", candidates:[]};
  if (strokes.length > 40 || strokes.some(s => !s.length || s.some(p => !p.every(Number.isFinite)))) {
    return {status:"uncertain", candidates:[]};
  }
  const points = strokes.flat();
  const width = Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
  const height = Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]));
  if (Math.max(width,height)<12 || width>307 || height>307) return {status:"uncertain", candidates:[]};
  KanjiCanvas.recordedPattern_cell = strokes;
  const normalized = KanjiCanvas.momentNormalize("cell");
  if (normalized.some(s=>s.some(p=>!p.every(Number.isFinite)))) return {status:"uncertain", candidates:[]};
  const features = KanjiCanvas.extractFeatures(normalized,20);
  const coarse = KanjiCanvas.coarseClassification(features).filter(c=>Number.isFinite(c[1])).slice(0,100);
  const ranked = coarse.map(([i])=>{
    const pattern = KanjiCanvas.refPatterns[i][2];
    let map = KanjiCanvas.getMap(pattern,features,KanjiCanvas.initialDistance);
    map = KanjiCanvas.completeMap(pattern,features,KanjiCanvas.wholeWholeDistance,map);
    const distance = KanjiCanvas.computeWholeDistanceWeighted(pattern,features,map)/Math.min(features.length,pattern.length);
    return {text:KanjiCanvas.refPatterns[i][0],distance};
  }).filter(c=>Number.isFinite(c.distance)).sort((a,b)=>a.distance-b.distance).slice(0,3);
  return {status:ranked.length?"read":"uncertain",candidates:ranked};
}
self.onmessage = ({data})=>{
  for (let index=0;index<data.cells.length;index++) {
    let result;
    try {result=recognizeCell(data.cells[index]);}
    catch {result={status:"uncertain",candidates:[]};}
    self.postMessage({id:data.id,index,result,done:index===data.cells.length-1});
  }
};
