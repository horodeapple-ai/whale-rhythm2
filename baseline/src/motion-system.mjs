/* Music-aware editorial clock and composition-safe camera layer.
 * The source blocks remain on their original clock: contacts, rigs, IK and
 * titles are evaluated together. No pose is frozen or independently retimed.
 */
import '../vendor/rich-song.js';

export const FPS=30, FRAME_COUNT=4201, DURATION=140.032;
export const BPM=globalThis.SONG?.bpm;
const BEATS=globalThis.SONG?.beats;
if(!Number.isFinite(BPM)||!Array.isArray(BEATS)||BEATS.length<2)
  throw Error('The original SONG beat data must be available.');
const W=1920,H=1080,TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,u)=>a+(b-a)*u;
const smooth=u=>{u=clamp(u);return u*u*(3-2*u)};
const ease=u=>{u=clamp(u);return u*u*u*(u*(u*6-15)+10)};
export const EIGHTH_GRID=Object.freeze(BEATS.flatMap((t,i)=>[
  Object.freeze({time:t,beat:i,kind:'beat',frame:Math.round(t*FPS)}),
  ...(i+1<BEATS.length?[Object.freeze({time:(t+BEATS[i+1])/2,beat:i+.5,kind:'eighth',frame:Math.round((t+BEATS[i+1])*FPS/2)})]:[])
]));
export function nearestGrid(time){return EIGHTH_GRID.reduce((a,b)=>Math.abs(b.time-time)<Math.abs(a.time-time)?b:a)}
export function clampTime(t){if(!Number.isFinite(t))throw TypeError('Film time must be finite.');return clamp(t,0,DURATION-1e-8)}

// Contacts from the source's actual action clock. Each is pinned to a rendered
// canonical frame; the complete intervals between them remain strictly forward.
const CONTACT_SPECS=[
 ['A-frame-settle',22.6666666667,.52],['A-rear-wheel-seat',23.6333333333,.42],
 ['A-front-wheel-seat',24.5666666667,.58],['A-pelican-seat',26.4333333333,.42],
 ['A-release',31,.20],['A-brake-start',32.5,.24],['A-brake-stop',33.1,.50],
 ['A-bike-restart',33.48,.20],['A-game-arrival',35.72,.26],
 ['B-head-block',44.2,.80],['B-coin-paw',46.02,.62],
 ['B-card-basin',59.355,.68],['B-stamp-window',65.1666666667,.93],
 ['B-code-collapse',68.9,.90],['B-code-middle-land',69.50,.60],['B-code-crown-land',69.88,.42],
 ['C-basin-floor',77.875,.60],['C-scarf-landing',84.3666666667,.43],
 ['C-satchel-landing',85.0333333333,.43],['C-ribbon-landing',85.7333333333,.45],
 ['C-wheel-tighten',87.75,.35],['C-bridge-connect',89.6666666667,.44],
 ['C-slide-stop',100.0333333333,.52],['C-test-complete',102.15,.38],
 ['D-lift-contact',110.1333333333,.45],['D-bridge-contact',112.6333333333,.45],
 ['D-basin-contact',115.1666666667,.56],['D-delivery-one',129.1666666667,.53],
 ['D-delivery-two',129.8333333333,.60],['D-share-rice',135.1666666667,.28]
].map(([id,sourceTime,power])=>({id,sourceTime,power,kind:'contact'}));

export function buildTimeline(sourceShots){
  if(sourceShots.length!==76)throw Error('The approved film must retain all 76 shots.');
  let sourceEnd=0;
  for(const s of sourceShots){if(Math.abs(s.start-sourceEnd)>1e-6||s.end<=s.start)throw Error('Broken source coverage: '+s.id);sourceEnd=s.end;}
  if(Math.abs(sourceEnd-DURATION)>1e-6)throw Error('Source duration changed.');
  const cutFrames=[0,...sourceShots.slice(1).map(s=>nearestGrid(s.start).frame),FRAME_COUNT];
  const contactSpecs=CONTACT_SPECS.map(e=>({...e,sourceTime:sourceShots.find(s=>Math.abs(s.start-e.sourceTime)<1e-7)?.start??e.sourceTime}));
  const shots=sourceShots.map((s,i)=>{
    const start=cutFrames[i]/FPS,end=i===sourceShots.length-1?DURATION:cutFrames[i+1]/FPS;
    const sourceDuration=s.end-s.start;
    const events=contactSpecs.filter(e=>e.sourceTime>=s.start&&e.sourceTime<s.end).map(e=>{
      const frame=e.sourceTime===s.start?cutFrames[i]:clamp(Math.round((start+(e.sourceTime-s.start)/sourceDuration*(end-start))*FPS),cutFrames[i]+1,cutFrames[i+1]-1);
      return Object.freeze({...e,frame,time:frame/FPS,shotId:s.id});
    });
    const knots=[{time:start,sourceTime:s.start},...events.filter(e=>e.time>start&&e.time<end),{time:end,sourceTime:s.end}];
    for(let k=1;k<knots.length;k++)if(knots[k].time<=knots[k-1].time||knots[k].sourceTime<=knots[k-1].sourceTime)throw Error('Contact mapping is not strictly monotonic: '+s.id);
    const grid=i?nearestGrid(start):null;
    return Object.freeze({...s,index:i,start,end,startFrame:cutFrames[i],endFrame:cutFrames[i+1],
      sourceId:s.sourceId??s.id,sourceStart:s.start,sourceEnd:s.end,
      sourceStartFrame:s.startFrame,sourceEndFrame:s.endFrame,
      grid:grid?Object.freeze({...grid,errorFrames:Math.abs(start-grid.time)*FPS}):null,
      knots:Object.freeze(knots.map(Object.freeze)),events:Object.freeze(events)});
  });
  for(const s of shots){
    if(s.endFrame-s.startFrame>84||s.endFrame-s.startFrame<12)throw Error('Shot outside 12–84 frame range: '+s.id);
    if(s.grid&&s.grid.errorFrames>.5000001)throw Error('Cut is more than half a frame off the eighth grid: '+s.id);
  }
  return Object.freeze(shots);
}
export function findShot(shots,t){t=clampTime(t);let lo=0,hi=shots.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(shots[m].start<=t)lo=m;else hi=m-1;}return shots[lo]}
function interpolateKnots(knots,t,input,output){
  if(t<=knots[0][input])return knots[0][output];
  for(let i=1;i<knots.length;i++)if(t<=knots[i][input]){
    const a=knots[i-1],b=knots[i];return mix(a[output],b[output],(t-a[input])/(b[input]-a[input]));
  }
  return knots.at(-1)[output];
}
export function timelineToSource(shots,t){t=clampTime(t);const s=findShot(shots,t);return Math.min(s.sourceEnd-1e-8,interpolateKnots(s.knots,t,'time','sourceTime'))}
export function sourceToTimeline(shots,sourceTime){
  if(!Number.isFinite(sourceTime))throw TypeError('Source time must be finite.');
  if(sourceTime>=DURATION)return DURATION;
  sourceTime=clamp(sourceTime,0,DURATION);
  const shot=shots.find(s=>sourceTime>=s.sourceStart&&sourceTime<s.sourceEnd);
  return interpolateKnots(shot.knots,sourceTime,'sourceTime','time');
}

// Strong accents named in the supplied motion plan. These are music accents,
// not substituted physical-contact times. The SONG clock is authoritative.
const HEAVY_BEAT_SPECS=[[65,.72],[83,.63],[89,1],[97,.75],[109,.70],[139,.63],[147,.91],[180,.48],[283,.56],[296,.42]];
export const MUSIC_ACCENTS=Object.freeze(HEAVY_BEAT_SPECS.map(([beat,power])=>Object.freeze({id:'music-'+beat,kind:'music',beat,time:BEATS[beat],frame:Math.round(BEATS[beat]*FPS),power})));
export function makeEvents(shots){return Object.freeze([...shots.flatMap(s=>s.events),...MUSIC_ACCENTS].sort((a,b)=>a.time-b.time))}

const CLOSE=new Set(['A-4','A-15','B-B05','B-B06','B-B09','B-B15','C-C01','C-C03','C-C09','C-C10','C-C12','C-C16','D-D15','D-D18']);
const ACTION=new Set(['A-5','A-7','A-8','A-11','A-16','A-18','B-B03','B-B04','B-B07','B-B10','B-B12','B-B19','C-C04','C-C07','C-C08','C-C14','C-C15','D-D02','D-D03','D-D04','D-D10','D-D14']);
function pulse(t,c,d=.34){const x=(t-c)/d;return x>=0&&x<1?(1-x)**3:0}
export function cameraAt(t,shot,events){
  const u=clamp((t-shot.start)/(shot.end-shot.start)),q=ease(u),close=CLOSE.has(shot.id),action=ACTION.has(shot.id),final=shot.id==='D-D18';
  const direction=shot.index%2?1:-1,phase=(t-BEATS[0])/(60/BPM);
  const breath=Math.sin(phase*TAU/8);
  const from=final?1.009:close?1.014:action?1.030:1.019;
  const to=final?1.018:close?1.032:action?1.058:1.041;
  let zoom=mix(from,to,q)+.0015*breath;
  let dx=direction*mix(action?-14:-6,action?15:7,q)+.6*Math.sin(phase*TAU/4);
  let dy=mix(3,-4,q)+.4*Math.cos(phase*TAU/8),impact=0,edgeGlow=0;
  for(const e of events){
    // The final line and final face stay entirely readable; no end flash.
    if(final&&e.kind==='contact')continue;
    const dt=t-e.time,p=pulse(t,e.time,final?.22:.34)*e.power;
    impact=Math.max(impact,p);
    if(dt>=0&&dt<.32){
      const strength=final?.18:close?.45:1;
      zoom+=p*.022*strength;
      dx+=Math.sin(dt*51+1.2)*p*7*strength;
      dy+=Math.cos(dt*43+.4)*p*4.5*strength;
      if(!final)edgeGlow=Math.max(edgeGlow,pulse(t,e.time,2/FPS)*e.power*.08);
    }
  }
  zoom=clamp(zoom,1.007,final?1.026:close?1.05:1.085);
  // Translation never exposes transparent frame borders. No rotation, squash,
  // or per-part camera effects can distort the approved character or contacts.
  const mx=(W*(zoom-1)/2-2)/zoom,my=(H*(zoom-1)/2-2)/zoom;
  dx=clamp(dx,-mx,mx);dy=clamp(dy,-my,my);
  return Object.freeze({x:W/2+dx,y:H/2+dy,s:zoom,rot:0,impact,edgeGlow,
    mode:final?'title-safe push':close?'detail push':action?'action track':'gentle push',
    matrix:Object.freeze([zoom,0,0,zoom,W/2-zoom*(W/2+dx),H/2-zoom*(H/2+dy)])});
}

// Native Canvas methods must be called with their real context as receiver.
// Composing setTransform and resetTransform keeps this camera in force even
// when a source block resets its own transforms. Numeric calls preserve the
// caller's existing 2×/4K render-scale adapter.
export function motionContext(g,camera){
  const m=camera.matrix,methods=new Map();
  const set=(...args)=>{
    let a=1,b=0,c=0,d=1,e=0,f=0;
    if(args.length===1){const v=args[0];a=v.a??v.m11??1;b=v.b??v.m12??0;c=v.c??v.m21??0;d=v.d??v.m22??1;e=v.e??v.m41??0;f=v.f??v.m42??0;}
    else if(args.length){[a,b,c,d,e,f]=args;}
    if(![a,b,c,d,e,f].every(Number.isFinite))throw TypeError('Invalid source Canvas transform.');
    g.setTransform(m[0]*a+m[2]*b,m[1]*a+m[3]*b,m[0]*c+m[2]*d,m[1]*c+m[3]*d,m[0]*e+m[2]*f+m[4],m[1]*e+m[3]*f+m[5]);
  };
  methods.set('setTransform',set);methods.set('resetTransform',()=>set(1,0,0,1,0,0));
  return new Proxy(g,{get(target,key){if(methods.has(key))return methods.get(key);const v=Reflect.get(target,key,target);if(typeof v!=='function')return v;const bound=v.bind(target);methods.set(key,bound);return bound;},set(target,key,value){return Reflect.set(target,key,value,target);}});
}

// Major narrative boundaries use the story's own materials. Cover lasts one
// frame at each exact cut, with 2 approach / 2 exit frames. Contacts are guarded.
export function makeTransitions(shots,events){
  const specs=[['A-10','folded-paper'],['B-B01','window-frame'],['C-C01','green-smoke'],['D-D01','conveyor-paper']];
  return Object.freeze(specs.map(([id,kind])=>{
    const shot=shots.find(s=>s.id===id);if(!shot)throw Error('Missing transition shot '+id);
    if(events.some(e=>e.kind==='contact'&&Math.abs(e.time-shot.start)<.19))throw Error('Cover would conceal a contact at '+id);
    return Object.freeze({id,kind,time:shot.start,frame:shot.startFrame,halfDuration:2.5/FPS});
  }));
}
export function transitionAt(t,transitions){
  for(const x of transitions){const d=t-x.time;if(Math.abs(d)<=x.halfDuration)return {...x,progress:clamp((d+x.halfDuration)/(x.halfDuration*2)),cover:smooth(1-Math.abs(d)/x.halfDuration)};}
  return null;
}
function poly(g,p,c){g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=c;g.fill();}
export function drawMotionOverlay(g,camera,transition){
  if(camera.edgeGlow>0){
    // A warm edge accent, never an opaque full-screen flash over a contact.
    const p=g.createRadialGradient(960,540,410,960,540,1120);p.addColorStop(0,'#ffe9b800');p.addColorStop(1,`rgba(255,229,160,${camera.edgeGlow})`);g.fillStyle=p;g.fillRect(0,0,W,H);
  }
  if(!transition)return;
  const {kind,cover,progress}=transition;
  if(kind==='green-smoke'){
    // The old-code smoke carries the cut, with the same muted green material.
    g.save();g.globalAlpha=cover;g.fillStyle='#8ba790';g.fillRect(0,0,W,H);
    for(let i=0;i<8;i++){g.fillStyle=i%2?'#a9bba0':'#769586';g.beginPath();g.ellipse(120+i*265+(progress-.5)*280,500+Math.sin(i*1.7)*290,380,300,0,0,TAU);g.fill();}g.restore();
    return;
  }
  const width=W*cover,leading=progress<.5,x=leading?0:W-width;
  g.save();g.beginPath();g.rect(x,0,width,H);g.clip();
  if(kind==='window-frame'){
    g.fillStyle='#0b4f84';g.fillRect(x,0,width,H);g.fillStyle='#248fbd';g.fillRect(x+16,0,Math.max(0,width-32),H);
    g.fillStyle='#f0b941';g.fillRect(x+Math.max(0,width-35),0,12,H);
    for(let y=80;y<H;y+=150){g.fillStyle='#ffe6a4';g.beginPath();g.arc(x+Math.max(0,width-29),y,4,0,TAU);g.fill();}
  }else{
    g.fillStyle=kind==='conveyor-paper'?'#eac36e':'#eedcb3';g.fillRect(x,0,width,H);
    poly(g,[[x,0],[x+width*.58,0],[x+width*.34,H],[x,H]],kind==='conveyor-paper'?'#c79339':'#c2d8cd');
    poly(g,[[x+width*.58,0],[x+width*.62,0],[x+width*.38,H],[x+width*.34,H]],'#fff0cc');
    g.strokeStyle='#b8965c';g.lineWidth=3;for(let y=110;y<H;y+=180){g.beginPath();g.moveTo(x,y);g.lineTo(x+width,y+38);g.stroke();}
  }
  g.restore();
}
