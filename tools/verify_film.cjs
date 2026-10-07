const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {root}=require('./runtime.cjs');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function finite(v,p='state',seen=new Set()){if(typeof v==='number'&&!Number.isFinite(v))throw Error('Nonfinite '+p);if(v&&typeof v==='object'&&!seen.has(v)){seen.add(v);for(const[k,x]of Object.entries(v))finite(x,p+'.'+k,seen)}}
(async()=>{
 const S=await import(root+'/src/scene.mjs'),baseline=path.resolve(root,'../miniature_preview/input/unpacked');
 const immutable=['src/paper-whale.mjs','vendor/rich-cast.js','vendor/rich-lib.js','vendor/rich-song.js','vendor/core/paper.js','vendor/core/util.js','vendor/rigs/shared.js','assets/song.m4a'];
 const hashes={};for(const p of immutable){const h=sha(root+'/'+p);if(h!==sha(baseline+'/'+p))throw Error('Immutable file changed '+p);hashes[p]=h}
 if(S.SHOTS.length!==76)throw Error('Expected 76 shots');
 if(S.DURATION!==140.032)throw Error('Duration');let end=0,maxShot=0;
 for(const s of S.SHOTS){if(Math.abs(s.start-end)>1e-7)throw Error('Timeline gap '+s.id);maxShot=Math.max(maxShot,s.end-s.start);if(s.end<=s.start||s.end-s.start>2.8+1e-6)throw Error('Shot length '+s.id);if(Math.abs(s.start*30-Math.round(s.start*30))>1e-6)throw Error('Offframe '+s.id);end=s.end;}
 if(Math.abs(end-S.DURATION)>1e-7)throw Error('End coverage');
 const states=[];for(let f=0;f<4201;f++){const s=S.sampleState(Math.min(f/30,S.DURATION-1e-7));finite(s);if(!s.shot)throw Error('Missing shot '+f);if(f%30===0)states.push({frame:f,t:f/30,shot:s.shot.id,sourceTime:s.sourceTime??s.sourceT??s.state?.t});}
 const report={duration:S.DURATION,frameRate:30,frames:4201,shots:S.SHOTS.length,internalCuts:75,maxShotSeconds:maxShot,fullFrameStateChecks:4201,finiteStates:true,immutableFileHashes:hashes,browserPlaybackVerified:false,audibleReviewVerified:false,sampledStateSeconds:states};
 fs.writeFileSync(root+'/qa/native-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,sampledStateSeconds:undefined},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
