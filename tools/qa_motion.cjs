/* Native Canvas verification. Does not navigate to localhost or use a browser.
 * --all-frames additionally renders each of the 4,201 frames at QA resolution.
 */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {createCanvas,Path2D,DOMMatrix,ImageData,GlobalFonts}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa');fs.mkdirSync(out,{recursive:true});
Object.assign(global,{window:global,Path2D,DOMMatrix,ImageData,document:{createElement:()=>createCanvas(1920,1080)}});
GlobalFonts.registerFromPath(root+'/assets/ZCOOLKuaiLe-Regular.ttf','KuaiLe');
GlobalFonts.registerFromPath(root+'/assets/Fredoka-Variable.ttf','Fredoka');
require(root+'/vendor/rich-song.js');require(root+'/vendor/rich-lib.js');require(root+'/vendor/rich-cast.js');
function finite(o,label='state',seen=new Set()){
 if(typeof o==='number')assert(Number.isFinite(o),label+' is not finite');
 else if(o&&typeof o==='object'&&!seen.has(o)){seen.add(o);for(const [k,v]of Object.entries(o))finite(v,label+'.'+k,seen)}
}
function scaledCanvas(scale){const c=createCanvas(Math.round(1920*scale),Math.round(1080*scale)),g=c.getContext('2d'),set=g.setTransform.bind(g);g.setTransform=(a,b,c,d,e,f)=>set(a*scale,b*scale,c*scale,d*scale,e*scale,f*scale);return {c,g};}
function pixel(c,x,y){return [...c.getContext('2d').getImageData(x,y,1,1).data]}
(async()=>{
 const S=await import(root+'/src/scene.mjs'),M=await import(root+'/src/motion-system.mjs');
 assert.equal(S.SHOTS.length,76);assert.equal(S.CUT_FRAMES.length-2,75);assert.equal(S.FRAME_COUNT,4201);assert.equal(S.DURATION,140.032);
 assert.equal(S.CUT_FRAMES[0],0);assert.equal(S.CUT_FRAMES.at(-1),4201);
 const lengths=S.SHOTS.map(s=>s.endFrame-s.startFrame);assert(Math.max(...lengths)<=84);assert(Math.min(...lengths)>=12);
 const cuts=S.SHOTS.slice(1).map(s=>({id:s.id,frame:s.startFrame,time:s.start,grid:s.grid.kind,gridTime:s.grid.time,errorFrames:s.grid.errorFrames}));
 assert(cuts.every(s=>s.errorFrames<=.5000001));
 let last=-1,minStep=Infinity,maxStep=0,maxRoundTrip=0;
 const sampled=[],cameraRanges=[];
 for(let f=0;f<S.FRAME_COUNT;f++){
  const t=f/30,s=S.sampleState(t);finite(s,'frame '+f);assert(s.sourceTime>last,'Forward source clock at '+f);
  if(f){minStep=Math.min(minStep,s.sourceTime-last);maxStep=Math.max(maxStep,s.sourceTime-last)}last=s.sourceTime;
  assert.equal(s.sourceShot.id,s.shot.sourceId,'Underlying shot at '+f);assert.equal(s.state.shot.id,s.shot.sourceId);
  const back=S.sourceToTimeline(s.sourceTime);maxRoundTrip=Math.max(maxRoundTrip,Math.abs(t-back));assert(Math.abs(t-back)<1e-7);
  assert(s.sourceTime>=s.shot.sourceStart&&s.sourceTime<s.shot.sourceEnd);
  // Every source interval is evaluated together; no displaced hand, foot,
  // body, prop, or object-clock channel can be introduced by this wrapper.
  assert.equal(s.state.t,s.sourceTime);
 }
 for(const s of S.SHOTS){
  const a=S.sampleState(s.start).camera,b=S.sampleState((s.start+s.end)/2).camera,c=S.sampleState(s.end-1/30).camera;
  const d=Math.hypot(a.x-c.x,a.y-c.y)+Math.abs(a.s-c.s)*1000;assert(d>.5,'Static camera: '+s.id);
  cameraRanges.push({id:s.id,mode:a.mode,start:a,end:c,motionMagnitude:d});
  if(s.index)assert.equal(S.sampleState(s.start-1e-6).shot.index,s.index-1);
  assert.equal(S.sampleState(s.start).shot.id,s.id);
  assert.equal(S.sampleState(s.end-1e-6).shot.id,s.id);
  sampled.push(s.start+(s.end-s.start)*.58);
 }
 const contacts=S.EVENTS.filter(e=>e.kind==='contact');
 for(const e of contacts){
  const s=S.sampleState(e.time);assert(Math.abs(s.sourceTime-e.sourceTime)<1e-7,e.id+' contact source time');assert.equal(s.shot.id,e.shotId);
  assert(Math.abs(S.sourceToTimeline(e.sourceTime)-e.time)<1e-7);
  assert(!s.transition,e.id+' hidden by cover');
  assert(s.camera.impact>=e.power*.97,e.id+' camera does not track contact');
  sampled.push(Math.max(0,e.time-2/30),e.time,Math.min(S.DURATION-1e-6,e.time+2/30));
 }
 assert.equal(S.sampleState(140).transition,null);assert.equal(S.sampleState(140).camera.edgeGlow,0);
 assert.equal(S.sampleState(1.2).state.pose.cat,0);assert.equal(S.sampleState(S.sourceToTimeline(27)).state.catEars,1);
 for(const t of [-1,0,140.032,200])finite(S.sampleState(t));
 assert.throws(()=>S.sampleState(NaN),/finite/);assert.throws(()=>S.sampleState(Infinity),/finite/);
 // Real native context receiver, identity/object/resetTransform, save/restore,
 // and an external 2× render-scale adapter are exercised here.
 for(const scale of [1,2]){
  const {c,g}=scaledCanvas(scale),cam={matrix:[1.1,0,0,1.1,40,25]},p=M.motionContext(g,cam);
  for(const reset of [()=>p.setTransform(1,0,0,1,0,0),()=>p.resetTransform(),()=>p.setTransform({a:1,b:0,c:0,d:1,e:0,f:0})]){
   g.clearRect(0,0,1920,1080);reset();p.fillStyle='#fe0012';p.fillRect(10,10,20,20);
   assert(pixel(c,Math.round(62*scale),Math.round(47*scale))[0]>240,'Native camera composition at '+scale+'×');
  }
  const initial=g.getTransform();p.save();p.translate(100,100);p.restore();const final=g.getTransform();assert.equal(initial.e,final.e);assert.equal(initial.f,final.f);
 }
 const {c,g}=scaledCanvas(.5);let rendered=0;
 const renderTimes=process.argv.includes('--all-frames')?Array.from({length:S.FRAME_COUNT},(_,f)=>f/30):[...new Set([...sampled,...S.TRANSITIONS.flatMap(x=>[-2,-1,0,1,2].map(d=>(x.frame+d)/30)),0,1.2,140])].sort((a,b)=>a-b);
 const start=Date.now();
 for(const t of renderTimes){const state=S.renderFrame(g,t);finite(state);rendered++;for(const [x,y]of[[1,1],[c.width-2,1],[1,c.height-2],[c.width-2,c.height-2]])assert(pixel(c,x,y)[3]>250,'Transparent border at '+t);if(rendered%500===0)console.log('Rendered QA frames:',rendered);}
 // Deterministic seek/replay must not depend on the frame before it.
 S.renderFrame(g,66);const expected=c.toBuffer('image/png');S.renderFrame(g,100);S.renderFrame(g,66);assert(expected.equals(c.toBuffer('image/png')),'Non-deterministic native render');
 const stills=[['opening',1.2],['head-contact',contacts.find(e=>e.id==='B-head-block').time],['stamp-contact',contacts.find(e=>e.id==='B-stamp-window').time],['clone-landing',contacts.find(e=>e.id==='C-ribbon-landing').time],['final-title',140]];
 const full=scaledCanvas(1);
 for(const [label,t]of stills){S.renderFrame(full.g,t);fs.writeFileSync(path.join(out,'motion-'+label+'.png'),full.c.toBuffer('image/png'));}
 const sheet=createCanvas(480*4,270*3),sg=sheet.getContext('2d');sg.fillStyle='#082653';sg.fillRect(0,0,sheet.width,sheet.height);
 const points=[1.2,12,22.7,30.5,41.869,contacts.find(e=>e.id==='B-stamp-window').time,78,85.76,102,115.16,130,140];
 points.forEach((t,i)=>{S.renderFrame(g,t);sg.drawImage(c,(i%4)*480,Math.floor(i/4)*270,480,270);sg.fillStyle='#fff0cd';sg.font='16px sans-serif';sg.fillText(t.toFixed(3)+'s',(i%4)*480+10,Math.floor(i/4)*270+23)});
 fs.writeFileSync(path.join(out,'motion-contact-sheet.png'),sheet.toBuffer('image/png'));
 const report={pass:true,renderMethod:'@napi-rs/canvas; no browser navigation',durationSeconds:S.DURATION,videoFrameCount:S.FRAME_COUNT,fps:S.FPS,containerFrameDurationSeconds:S.FRAME_COUNT/S.FPS,lastRenderedTimestampSeconds:(S.FRAME_COUNT-1)/S.FPS,shotCount:S.SHOTS.length,internalCutCount:cuts.length,minimumShotFrames:Math.min(...lengths),maximumShotFrames:Math.max(...lengths),maximumCutErrorFrames:Math.max(...cuts.map(s=>s.errorFrames)),gridDistribution:{beat:cuts.filter(c=>c.grid==='beat').length,eighth:cuts.filter(c=>c.grid==='eighth').length},stateFramesChecked:S.FRAME_COUNT,sourceClockStrictlyIncreasing:true,minSourceStepSeconds:minStep,maxSourceStepSeconds:maxStep,maxInverseMappingErrorSeconds:maxRoundTrip,contactPins:contacts,musicAccents:S.EVENTS.filter(e=>e.kind==='music'),transitions:S.TRANSITIONS,sourceClockNeverFrozen:true,nativeTransformTests:[1,2],nativeFramesRendered:rendered,allFramesRendered:rendered===S.FRAME_COUNT,renderElapsedSeconds:(Date.now()-start)/1000,deterministicSeekReplay:true,transparentBorderChecksPassed:true,finalTitleNoFlash:true,cutFrames:S.CUT_FRAMES,cutAudit:cuts,cameraRanges,limitations:['Source contacts are preserved on the editorial clock. Selected gait and facial loops use the scoped music clock; this is not a new character rig.','The original SONG grid is used; audio beat extraction was not rerun.','Browser playback is not tested; native Canvas rendering is tested.','4201 frames at 30 fps occupy 140.033333 s, 0.001333 s longer than the original 140.032 s audio clock.']};
 fs.writeFileSync(path.join(out,'motion-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,contactPins:report.contactPins.length,cutAudit:undefined,cameraRanges:undefined},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
