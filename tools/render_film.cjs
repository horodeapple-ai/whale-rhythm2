const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {root,createCanvas}=require('./runtime.cjs');
const args=Object.fromEntries(process.argv.slice(2).map(a=>{let [k,...v]=a.split('=');return[k.replace(/^--/,''),v.join('=')||true]}));
(async()=>{
 const S=await import(root+'/src/scene.mjs'),c=createCanvas(1920,1080),g=c.getContext('2d');
 if(args.stills){let times=args.stills==='shots'?S.SHOTS.map(s=>(s.start+s.end)/2):args.stills.split(',').map(Number);fs.mkdirSync(root+'/qa/frames',{recursive:true});
  for(const t of times){const state=S.renderFrame(g,t),name='frame-'+t.toFixed(3).replace('.','_')+'.png';fs.writeFileSync(root+'/qa/frames/'+name,c.toBuffer('image/png'));console.log(JSON.stringify({t,shot:state.shot?.id,file:name}));}return;
 }
 const start=Number(args.start||0),end=Number(args.end||4201),dest=args.out||root+'/output/segment-'+String(start).padStart(4,'0')+'.mp4';
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 const ff=spawn('ffmpeg',['-v','error','-y','-f','rawvideo','-pix_fmt','rgba','-s','1920x1080','-r','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-threads','1','-video_track_timescale','30000',dest],{stdio:['pipe','inherit','inherit']});
 let err=null;ff.on('error',e=>err=e);const done=new Promise((ok,no)=>ff.on('exit',n=>n===0?ok():no(Error('ffmpeg exit '+n))));
 const began=Date.now();
 for(let f=start;f<end;f++){S.renderFrame(g,Math.min(f/30,S.DURATION-1e-7));const raw=c.data();if(!ff.stdin.write(raw))await new Promise(r=>ff.stdin.once('drain',r));if(err)throw err;if((f-start)%60===0)console.log(JSON.stringify({start,frame:f,end,fps:(f-start+1)/((Date.now()-began)/1000)}));}
 ff.stdin.end();await done;console.log(JSON.stringify({complete:true,start,end,frames:end-start,bytes:fs.statSync(dest).size,seconds:(Date.now()-began)/1000,file:dest}));
})().catch(e=>{console.error(e);process.exit(1)});
