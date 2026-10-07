import {renderFrame,DURATION,SHOTS} from './scene.mjs';
const $=id=>document.getElementById(id),canvas=$('stage'),g=canvas.getContext('2d'),audio=$('audio');
await Promise.all(['KuaiLe','Fredoka'].map(f=>document.fonts.load(`32px ${f}`,'大肥鱼猫耳鲸尾')));await document.fonts.ready;
let raf=null,playing=false,starting=false,generation=0,last=-1;
let metric={start:performance.now(),frames:0,total:0,max:0};
function render(t){t=Math.max(0,Math.min(DURATION-.0001,t));const began=performance.now();renderFrame(g,t);const cost=performance.now()-began;last=t;if(playing){metric.frames++;metric.total+=cost;metric.max=Math.max(metric.max,cost);const span=performance.now()-metric.start;if(span>=5000){console.info('PV_PLAYBACK_METRICS '+JSON.stringify({fps:metric.frames*1000/span,meanRenderMs:metric.total/metric.frames,maxRenderMs:metric.max,audioLag:audio.currentTime-t,at:t}));metric={start:performance.now(),frames:0,total:0,max:0};}}$('seek').value=t;$('time').textContent=`${t.toFixed(2)} / ${DURATION.toFixed(2)}`;}
function cancel(){if(raf!==null)cancelAnimationFrame(raf);raf=null}
/* 播放/暂停合成一个切换键：按钮文字随状态在「播放 / 暂停」之间切换。
 * 另外支持**空格**切换（焦点在按钮上时不重复处理，避免触发两次）。 */
function setToggle(){const b=$('toggle');if(!b)return;b.textContent=(playing||starting)?'暂停':'播放';b.disabled=false;}
function pause(message='已暂停'){generation++;starting=false;playing=false;cancel();audio.pause();setToggle();$('status').textContent=message;}
function toggle(){if(playing||starting)pause();else play();}
function tick(){raf=null;if(!playing)return;const t=audio.currentTime;if(t>=DURATION-.01){pause('全片播放结束');render(DURATION-.001);return}if(audio.readyState>=2&&Math.abs(t-last)>1/150)render(t);raf=requestAnimationFrame(tick)}
function metadata(){if(audio.readyState>=1)return Promise.resolve();return new Promise((ok,no)=>{audio.addEventListener('loadedmetadata',ok,{once:true});audio.addEventListener('error',()=>no(Error('音频无法解码')),{once:true})})}
async function play(restart=false){if((playing||starting)&&!restart)return;const token=++generation;starting=true;setToggle();$('status').textContent='准备中…';try{await metadata();if(token!==generation)return;if(restart||audio.currentTime>=DURATION-.02)audio.currentTime=0;await audio.play();if(token!==generation)return;starting=false;playing=true;metric={start:performance.now(),frames:0,total:0,max:0};setToggle();$('status').textContent='播放中';raf=requestAnimationFrame(tick)}catch(e){if(token===generation)pause('请再按一次播放：'+e.message)}}
$('toggle').onclick=()=>{toggle();$('toggle').blur();};      // 点完就取消焦点，免得空格又触发一次按钮
$('replay').onclick=()=>{pause();play(true);};
document.addEventListener('keydown',e=>{
 // 空格 = 播放/暂停。焦点在按钮上时交给按钮自己（浏览器会把它变成 click），否则会切两次。
 if(e.code!=='Space'&&e.key!==' ')return;
 if(e.repeat)return;
 const tag=(e.target&&e.target.tagName)||'';
 if(tag==='BUTTON')return;
 e.preventDefault();                                        // 别让页面滚动
 toggle();
});
$('seek').oninput=()=>{const t=Number($('seek').value);if(audio.readyState>=1)audio.currentTime=t;render(t)};
audio.onseeked=()=>render(audio.currentTime);audio.onended=()=>{pause('全片播放结束');render(DURATION-.001)};audio.onerror=()=>pause('音频无法解码，请使用支持AAC的浏览器');
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing||starting))pause('已暂停')});window.addEventListener('pagehide',()=>pause());
window.__sampleDebug=()=>({playing,starting,generation,time:audio.currentTime,rendered:last,readyState:audio.readyState,duration:DURATION,shot:SHOTS.find(s=>last>=s.start&&last<s.end)?.id});
window.__sampleSeek=t=>{pause();audio.currentTime=t;render(t);return window.__sampleDebug()};
window.__sampleToggle=()=>{toggle();return window.__sampleDebug()};
const subsBox=$('subs');
if(subsBox){globalThis.__subs=subsBox.checked;subsBox.onchange=()=>{globalThis.__subs=subsBox.checked;if(last>=0){const t=last;last=-1;render(t);}};}
render(0);$('toggle').disabled=false;$('replay').disabled=false;setToggle();$('status').textContent='已就绪（空格 = 播放/暂停）';
