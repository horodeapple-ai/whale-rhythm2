import {withMusicClock} from './music-clock.mjs';
import * as A from './blocks/a-opening-pelican.mjs';
import * as B from './blocks/b-game-overload.mjs';
import * as C from './blocks/c-clone-rescue.mjs';
import * as D from './blocks/d-delivery-finale.mjs';
import {FPS,FRAME_COUNT,DURATION,buildTimeline,findShot,clampTime,timelineToSource,sourceToTimeline as mapSource,cameraAt,makeEvents,makeTransitions,transitionAt,motionContext,drawMotionOverlay} from './motion-system.mjs';
import {drawSubtitle} from './subtitles.mjs';
export const WIDTH=1920,HEIGHT=1080;
export {FPS,FRAME_COUNT,DURATION};
const MODULES={A,B,C,D};
export const SOURCE_SHOTS=Object.freeze(Object.entries(MODULES).flatMap(([block,m])=>m.SHOTS.map(s=>Object.freeze({...s,id:`${block}-${s.id}`,sourceId:s.id,block}))));
export const SHOTS=buildTimeline(SOURCE_SHOTS);
export const EVENTS=makeEvents(SHOTS);
export const TRANSITIONS=makeTransitions(SHOTS,EVENTS);
export const CUT_FRAMES=Object.freeze([0,...SHOTS.map(s=>s.endFrame)]);
export const sourceToTimeline=t=>mapSource(SHOTS,t);
export const timelineToSourceTime=t=>timelineToSource(SHOTS,t);
export function sampleState(t){
  t=clampTime(t);const shot=findShot(SHOTS,t),sourceTime=timelineToSource(SHOTS,t),m=MODULES[shot.block];
  const state=withMusicClock(sourceTime,t,()=>m.stateAt?.(sourceTime)??m.sampleState?.(sourceTime)??null);
  const camera=cameraAt(t,shot,EVENTS),transition=transitionAt(t,TRANSITIONS);
  return {t,frame:Math.min(FRAME_COUNT-1,Math.floor(t*FPS+1e-7)),block:shot.block,
    blockStart:SHOTS.find(s=>s.block===shot.block).start,shot,u:(t-shot.start)/(shot.end-shot.start),
    sourceTime,sourceShot:state?.shot??null,state,camera,transition};
}
export function renderFrame(g,t){
  const s=sampleState(t);
  g.save();
  try{
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,WIDTH,HEIGHT);
    const world=motionContext(g,s.camera);world.setTransform(1,0,0,1,0,0);
    withMusicClock(s.sourceTime,s.t,()=>MODULES[s.shot.block].renderFrame(world,s.sourceTime));
    g.setTransform(1,0,0,1,0,0);drawMotionOverlay(g,s.camera,s.transition);
    drawSubtitle(g,s.t);
  }finally{g.restore();}
  return s;
}
