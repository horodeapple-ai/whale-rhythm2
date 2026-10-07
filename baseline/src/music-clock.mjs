/* Synchronous scoped music clock. Physical action curves keep source time;
 * periodic loops see the exact playback clock even after editorial retiming. */
let currentDelta=0;
export function musicTime(sourceTime){return sourceTime+currentDelta;}
export function withMusicClock(sourceTime,timelineTime,fn){
 if(!Number.isFinite(sourceTime)||!Number.isFinite(timelineTime)||typeof fn!=='function')throw TypeError('A finite source/playback clock and synchronous callback are required.');
 const previous=currentDelta;currentDelta=timelineTime-sourceTime;
 try{return fn();}finally{currentDelta=previous;}
}
