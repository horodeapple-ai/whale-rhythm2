const fs=require('fs'), path=require('path'), crypto=require('crypto');
const {root,createCanvas}=require('./runtime.cjs');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const finite=(x,p='state',seen=new Set())=>{if(typeof x==='number'&&!Number.isFinite(x))throw Error('Nonfinite '+p);if(x&&typeof x==='object'&&!seen.has(x)){seen.add(x);for(const[k,v]of Object.entries(x))finite(v,p+'.'+k,seen)}};
(async()=>{
 const S=await import(root+'/src/scene.mjs');
 const immutable=['src/paper-whale.mjs','vendor/rich-cast.js','vendor/rich-lib.js','vendor/rich-song.js','vendor/core/paper.js','vendor/core/util.js','vendor/rigs/shared.js','assets/song.m4a'];
 const hashes=Object.fromEntries(immutable.map(p=>[p,{sha256:sha(root+'/'+p),matchesBaseline:sha(root+'/'+p)===sha(path.resolve(root,'../miniature_preview/input/unpacked',p))}]));
 const sources=Object.fromEntries(['src/scene.mjs','src/motion-system.mjs','src/subagent-detail.mjs','src/action-motion.mjs','src/music-clock.mjs',...fs.readdirSync(root+'/src/blocks').filter(x=>x.endsWith('.mjs')).map(x=>'src/blocks/'+x)].map(p=>[p,sha(root+'/'+p)]));
 const contactStats={}, narrative=[];let badState=0,previousSource=-1,maxMappingJump=0;
 for(let frame=0;frame<S.FRAME_COUNT;frame++){
  const t=frame/S.FPS,s=S.sampleState(t);finite(s);if(s.sourceTime<=previousSource)throw Error('Nonforward source time '+frame);maxMappingJump=Math.max(maxMappingJump,s.sourceTime-previousSource);previousSource=s.sourceTime;
  if(!s.shot||!s.state||s.sourceTime<s.shot.sourceStart-1e-6||s.sourceTime>=s.shot.sourceEnd+1e-6)badState++;
  for(const c of s.state.contacts||[]){if(!c.active)continue;const a=contactStats[c.name]??={max:0,frames:0,at:0,sourceAt:0};a.frames++;if(c.distance>a.max){a.max=c.distance;a.at=t;a.sourceAt=s.sourceTime}}
 }
 for(const shot of S.SHOTS){const t=(shot.start+shot.end)/2,s=S.sampleState(t);if(s.state.subagents)narrative.push({shot:shot.id,time:t,sourceTime:s.sourceTime,...s.state.subagents})}
 const report={duration:S.DURATION,frames:S.FRAME_COUNT,shotCount:S.SHOTS.length,badState,immutable:hashes,sourceHashes:sources,contactStats,narrative};
 if(process.argv.includes('--text')){
  const c=createCanvas(1920,1080),g=c.getContext('2d'),clipped=[],allTexts=[];
  let sample=null;const noops=new Set(['fill','stroke','fillRect','strokeRect','clearRect','drawImage']);
  const proxy=new Proxy(g,{get(target,key){if(noops.has(key))return()=>{};if(key==='fillText'||key==='strokeText')return(str,x,y)=>{
   const m=target.getTransform(),b=target.measureText(str),points=[[x-b.actualBoundingBoxLeft,y-b.actualBoundingBoxAscent],[x+b.actualBoundingBoxRight,y-b.actualBoundingBoxAscent],[x+b.actualBoundingBoxRight,y+b.actualBoundingBoxDescent],[x-b.actualBoundingBoxLeft,y+b.actualBoundingBoxDescent]].map(([x,y])=>[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]);
   const bb=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
   const r={...sample,text:String(str),bbox:bb.map(x=>Math.round(x*10)/10),alpha:target.globalAlpha};if(target.globalAlpha>.1){allTexts.push(r);if(bb[0]<0||bb[1]<0||bb[2]>1920||bb[3]>1080){r.fullyOutside=bb[2]<0||bb[3]<0||bb[0]>1920||bb[1]>1080;clipped.push(r)}}
  };const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v},set(target,key,v){return Reflect.set(target,key,v,target)}});
  const samples=S.SHOTS.flatMap(s=>[s.start+1/30,(s.start+s.end)/2,s.end-1/30]);
  for(const t of samples){const s=S.sampleState(t);sample={t,sourceTime:s.sourceTime,shot:s.shot.id};S.renderFrame(proxy,t)}
  report.textSamples=samples.length;report.clippedText=clipped;
  fs.writeFileSync(root+'/qa/review-all-text.json',JSON.stringify(allTexts,null,2));
 }
 fs.writeFileSync(root+'/qa/review-integration.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({duration:report.duration,frames:report.frames,shots:report.shotCount,badState,immutableOK:Object.values(hashes).every(x=>x.matchesBaseline),contactStats,textSamples:report.textSamples,clippedTextCount:report.clippedText?.length,partialImportantText:report.clippedText?.filter(x=>!x.fullyOutside&&/本体|子代理|工单|交付|吃饭|三单|结果|验收|好了|不是/.test(x.text))},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
