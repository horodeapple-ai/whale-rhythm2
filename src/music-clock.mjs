/* Synchronous scoped music clock. Physical action curves keep source time;
 * periodic loops see the exact playback clock even after editorial retiming. */
let currentDelta=0,currentT=NaN;
export function musicTime(sourceTime){return sourceTime+currentDelta;}
/** 播放时刻（成片时间轴）。给没有 T 参数的绘制原语用：
 *  book / windowFrame / card / stage / speech … 它们要读节奏，但拿不到 T。
 *  渲染作用域之外调用返回 NaN（调用方必须按"无节奏"降级，见各原语）。 */
export function playbackTime(){return currentT;}
export function withMusicClock(sourceTime,timelineTime,fn){
 if(!Number.isFinite(sourceTime)||!Number.isFinite(timelineTime)||typeof fn!=='function')throw TypeError('A finite source/playback clock and synchronous callback are required.');
 const previous=currentDelta,previousT=currentT;currentDelta=timelineTime-sourceTime;currentT=timelineTime;
 try{return fn();}finally{currentDelta=previous;currentT=previousT;}
}
