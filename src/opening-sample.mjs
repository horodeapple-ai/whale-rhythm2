import {drawOriginalWorldDetail,drawOpeningSignDetail,drawStageDetail,drawForegroundDetail} from './original-world-detail.mjs';
import {C} from './art-palette.mjs';
import {drawWhale,whaleRig,piece,blob,smooth,ribbon,ell,rr,stroke,curve,at,M,tr,rt,sc,pt,inv} from './paper-whale.mjs';
import {poly,cut,lin,mixHex} from '../vendor/core/paper.js';
// ★ 节拍改读实测节拍表；A-8 跨窗跑的步频 = 2 个实测拍
import {kOf, cue} from './rhythm.mjs';
import {beatPeriod} from './action-motion.mjs';   // 本拍时长（实测节拍表）
import {playbackTime, musicTime} from './music-clock.mjs';
// ★ 世界层（背景里的屏幕均衡条/灯笼光晕/辉光/地线/光点/纸屑）与纸片 UI 的节拍弹跳
import {drawWorldFx} from './world-fx.mjs';
import {popDraw,stageBounce} from './rhythm-fx.mjs';
export const WIDTH=1920,HEIGHT=1080,DURATION=18;
const CUTS=[0,64,106,162,218,288,359,429,485,540];
export const SHOTS=['差一口','来活了','谁是大肥鱼','嘴硬','接单变装','猫耳鲸尾','入戏了','跨窗跑','开工喵'].map((title,i)=>({id:i+1,title,start:CUTS[i]/30,end:CUTS[i+1]/30,startFrame:CUTS[i],endFrame:CUTS[i+1]}));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,k)=>a+(b-a)*k,ease=v=>{v=clamp(v);return v*v*(3-2*v)},seg=(v,a,b)=>ease((v-a)/(b-a)),TAU=Math.PI*2;
function txt(g,s,x,y,size=40,col=C.ink,align='left'){g.fillStyle=col;g.font=`${size}px KuaiLe`;g.textAlign=align;g.textBaseline='middle';g.fillText(s,x,y)}
function line(g,a,b,col=C.ink,w=2,alpha=1){stroke(g,curve([a,b]),col,w,alpha)}
function polygon(g,p,col,o={}){piece(g,poly(p,{amp:.75,step:42,round:0}),col,{lift:5,r:350,c:p[0],shade:.1,rimW:2.2,underW:2,...o});}
function card(g,x,y,w,h,col=C.white,rot=0){popDraw(g,x+w/2,y+h/2,x,Math.round(x+y*0.7),()=>at(g,M(tr(x,y),rt(rot)),()=>{const p=poly([[0,0],[w,0],[w,h],[0,h]],{amp:1.2,step:60});cut(g,p,'#9e8d74',{shadow:8,shadowAlpha:.23});g.save();g.translate(4,6);piece(g,p,'#bbaa8e',{lift:1,r:500,c:[w/2,h/2],shade:.1});g.restore();piece(g,p,col,{lift:1.6,r:Math.max(w,h),c:[w/2,h/2],shade:.06,rimW:2.2,underW:2});}));}
function foldedStar(g,x,y,r=20,col=C.gold,rot=0){at(g,M(tr(x,y),rt(rot)),()=>{for(let i=0;i<4;i++){const a=i*Math.PI/2;at(g,rt(a),()=>{polygon(g,[[0,0],[0,-r],[r*.23,-r*.23]],col,{lift:1.4,r:r*2,c:[0,-r/2],shade:.13});polygon(g,[[0,0],[0,-r],[-r*.23,-r*.23]],mixHex(col,C.white,.2),{lift:.4,r:r*2,c:[0,-r/2],shade:.05});});}});}
function fan(g,x,y,r,col=C.blueLight){at(g,tr(x,y),()=>{cut(g,ell(0,0,r,r*.92),'#a59c83',{shadow:14,shadowAlpha:.13});for(let i=0;i<24;i++){const a=i/24*TAU,b=(i+1)/24*TAU;polygon(g,[[0,0],[Math.cos(a)*r,Math.sin(a)*r],[Math.cos(b)*r,Math.sin(b)*r]],i%2?col:mixHex(col,C.navy,.16),{lift:.6,r:r,c:[Math.cos(a)*r*.5,Math.sin(a)*r*.5],shade:.07,rimW:.5});}piece(g,ell(0,0,r*.46),C.paper,{lift:3,r:r*.7,c:[0,0],shade:.07});});}
let worldCache=null;
function worldArchitecture(g){drawOriginalWorldDetail(g,{bars:false});}   // 请求条改为逐帧画（才能跟着拍伸缩）

function book(g,t,id){
 if(!worldCache){worldCache=document.createElement('canvas');const r=globalThis.ART_RENDER_SCALE||1;worldCache.width=1920*r;worldCache.height=1080*r;const q=worldCache.getContext('2d');q.scale(r,r);worldArchitecture(q);}
 g.drawImage(worldCache,0,0,1920,1080);
 // ★ 世界层：屏幕均衡条 / 灯笼光晕 / 中央辉光 / 地砖金线与地灯 / 光点与纸屑
 //   （原来这里是 16 粒与音乐无关的自由漂移光点；现在整层由节奏总线驱动）
 drawWorldFx(g,Number.isFinite(t)?t:playbackTime());
}
function stage(g,x,y,w,col=C.blue){popDraw(g,x+w/2,y+24,x,Math.round(x+y),()=>drawStageDetail(g,x,y+stageBounce(x,Math.round(x+y)),w,col));}

function windowFrame(g,x,y,w,h,title,color=C.blue,fold=1){
 // ★ 节拍弹跳：以窗口中心为锚点缩放（行波 + 强度分级）。文字元素幅度 ≤3%，不会糊边。
 popDraw(g,x+w/2,y+h/2,x,Math.round(x*3+y),()=>
 at(g,M(tr(x,y),sc(Math.max(.015,fold),1)),()=>{
  polygon(g,[[0,0],[w,0],[w+22,24],[22,24]],mixHex(color,C.white,.24),{lift:5,r:w,c:[w/2,14]});
  polygon(g,[[w,0],[w+22,24],[w+22,h+19],[w,h]],'#0d4268',{lift:8,r:h,c:[w+8,h/2]});
  card(g,0,0,w,h,'#093857');
  piece(g,rr(8,8,w-16,h-16,3),'#d5a145',{lift:2.5,r:Math.max(w,h),c:[w/2,h/2],shade:.16,rimW:1.6});
  piece(g,rr(14,14,w-28,h-28,2),color,{lift:2,r:Math.max(w,h),c:[w/2,h/2],shade:.08,rimW:1});
  piece(g,rr(23,69,w-46,h-92,2),'#fff0d0',{lift:2,r:Math.max(w,h),c:[w/2,h/2],shade:.07});
  piece(g,rr(24,17,w-48,38,1),mixHex(color,C.white,.25),{lift:1,r:w,c:[w/2,32],shade:.04});
  txt(g,title,Math.max(32,w*.5),37,Math.min(26,(w-80)/(title.length*.65+1)),C.navy,'center');
  for(const q of[[14,14],[w-14,14],[14,h-14],[w-14,h-14]]){piece(g,ell(...q,4.2),'#e7cf97',{lift:1.1,r:9,c:q,shade:.15});line(g,[q[0]-2,q[1]],[q[0]+2,q[1]],'#8c734a',1,.6);}
  line(g,[26,h-30],[w-26,h-30],'#fff8df',1.2,.75);
  // Consistent crafted metal frame, inner bevel and tiny fasteners across every task window.
  line(g,[15,15],[w-15,15],'#ffdf88',2,.92);
  line(g,[15,61],[w-15,61],'#155b7b',1.5,.8);
  for(const sx of[17,w-17]){line(g,[sx,75],[sx,h-24],'#ffe19b',1.1,.6);}
  for(const cx of[34,45,56]){piece(g,ell(cx,36,2.1),cx===34?'#ec8d6f':cx===45?'#ffe6a0':'#c3f0d9',{lift:.5,r:4,c:[cx,36],shade:.05});}
  for(const sy of[73,h-18])for(const sx of[17,w-17]){line(g,[sx-2,sy],[sx+2,sy],'#ffdf8c',1,.85);}

 }));
}
function request(g,x,y,w,h,title,body,rotation=0){at(g,M(tr(x,y),rt(rotation)),()=>{windowFrame(g,0,0,w,h,title,C.pink);txt(g,body,w/2,110,42,C.ink,'center');line(g,[40,152],[w-60,152],'#bec5b7',7);line(g,[40,178],[w-120,178],'#d6c3a4',7);polygon(g,[[w-50,-12],[w+22,0],[w+19,27],[w-56,14]],'#d2b572',{lift:1.1,r:70,c:[w-10,6],shade:.05});});}
/* 台词后缀（用户 2026-10-08 要求，原话「角色每句话后面都加：喵~」「变成猫娘前不要加」「已经有了的不加」）
 *   · 分界点 = A-4「接单变装」收到"请变成猫娘！"委托 → A-5 设计 → A-6「猫耳鲸尾」变身完成；
 *     所以变身前的两句话（A-2「诶？！」、A-3「我才不是大肥鱼！」）不加后缀。
 *   · 已经带「喵」的句子（喵？/ 好啦，开工喵！/ 坐稳喵～/ 猫耳鲸尾，接单喵！）不重复加。
 *   · 「又是大肥鱼！」是**别人**说的（D-D18：气泡尾巴指向右侧三个子代理，而且是第三人称说她），
 *     主角在这句之后才接「才、才不是……」（那句加）——用户 2026-10-08 看图确认后要求去掉。
 *   · 全片 21 句台词 → 14 句加后缀、7 句不动。核对：node tools/check_speech.mjs */
const CAT_TAIL='喵~';
const NO_CAT_TAIL=new Set([
  '诶？！','我才不是大肥鱼！',   // 变成猫娘之前
  '又是大肥鱼！',                // 不是主角说的（子代理/围观者）
]);
export function catSpeak(s){return (s.includes('喵')||NO_CAT_TAIL.has(s))?s:s+CAT_TAIL;}
function speech(g,s,x,y,w=440,h=120,rotation=0){const say=catSpeak(s);at(g,M(tr(x,y),rt(rotation)),()=>{card(g,0,0,w,h,C.white);polygon(g,[[42,h-2],[59,h+25],[90,h-1]],C.white,{lift:2,r:45,c:[63,h+7],shade:.05});txt(g,say,w/2,h*.51,Math.min(54,w/(say.length+.5)),C.navy,'center');});}
function bowl(g,b){at(g,M(tr(b.x,b.y),M(rt(b.rot||0),sc(b.s,b.s))),()=>{const p=smooth([[-64,0],[-55,39],[-32,49],[32,49],[56,31],[64,0]],{tension:.16});piece(g,p,'#358fae',{lift:4,r:85,c:[0,24],shade:.15,rimW:2});polygon(g,[[-58,4],[-30,8],[-18,44],[-39,42]],'#b1f0ef',{lift:.65,r:60,c:[-39,20],shade:.08});polygon(g,[[18,6],[49,4],[46,33],[32,43]],'#126985',{lift:.6,r:55,c:[36,22],shade:.1});piece(g,ell(0,0,66,20),'#a4e2dc',{lift:2,r:75,c:[0,0],shade:.13});piece(g,smooth([[-57,-2],[-41,-23],[-11,-34],[25,-28],[55,-6]],{tension:.2}),C.white,{lift:2,r:68,c:[0,-14],shade:.09});for(let i=0;i<28;i++){const x=-45+(i*19)%91,y=-4-(i*13)%23;if((x/52)**2+((y+2)/30)**2<1)grain(g,x,y,.55,i*.45);}stroke(g,curve([[-61,1],[-42,13],[0,19],[42,13],[61,1]]),'#edf0df',3,.9);});}
function grain(g,x,y,s=1,rot=0){at(g,M(tr(x,y),M(rt(rot),sc(s,s))),()=>piece(g,blob(0,0,3.4,7,{seed:4,amp:.04,n:16}),C.white,{lift:.7,r:10,c:[0,0],shade:.12,rimW:.4,underW:.5}));}
function spoon(g,a,tip,s=1,rice=true){const dx=tip[0]-a[0],dy=tip[1]-a[1],len=Math.hypot(dx,dy);at(g,M(tr(...a),rt(Math.atan2(dy,dx))),()=>{piece(g,rr(-5,-2.2,len-2.2,4.4,1),'#b8c9c1',{lift:2,r:len,c:[len/2,0],shade:.12,rimW:.8});piece(g,ell(len,0,15*s,8*s),'#dae1ce',{lift:2,r:24,c:[len,0],shade:.12});if(rice)for(let i=0;i<4;i++)grain(g,len-7*s+i*4*s,-2*s,(.7)*s,i);});}
function cursor(g,x,y,s=1,rot=0){at(g,M(tr(x,y),M(rt(rot),sc(s,s))),()=>polygon(g,[[0,0],[0,65],[18,48],[31,71],[42,64],[29,42],[52,39]],C.white,{lift:4,r:75,c:[18,31],shade:.13,underW:2,rimW:2}));}
function speed(g,x,y){for(let i=0;i<3;i++)line(g,[x-i*23,y+i*22],[x-70-i*33,y+i*22],C.blueDark,4-i*.6,.65)}
function floorShadow(g,o,air=0){const y=o.floor||908;g.save();g.globalAlpha=.19*(1-air*.38);g.fillStyle='#364b49';g.shadowColor='#364b4940';g.shadowBlur=17;g.fill(ell(o.x+16,y+9,105*o.s/2*(1-air*.25),14));g.restore();}
function holdBowl(o,R){return{x:R.anchors.lHand[0]-37*o.s,y:R.anchors.lHand[1]-8*o.s,s:o.s*.85,rot:0};}
export function sampleState(t){t=clamp(t,0,18-1e-7);const shot=SHOTS.find(s=>t>=s.start&&t<s.end),u=(t-shot.start)/(shot.end-shot.start),l=t-shot.start;const o={x:720,y:913,s:2.25,t,expr:'smile',mouth:.2,cat:0,left:[-45,-133],right:[56,-149],nod:0,lean:0,tail:Math.sin(t*3)*.5,hair:0,feet:[[-23,0],[24,0]],floor:913};let basinMode='hand',rice=true,extra={};
 if(shot.id===1){const k=seg(u,.05,.86);Object.assign(o,{x:706,s:2.32,left:[-48,-95],right:[mix(-40,45,k),mix(-100,-97,k)],nod:.10*k,mouth:.12+.5*k,expr:u>.84?'shock':'grin',tail:.3*Math.sin(t*4)});extra.spoonTip=[mix(-80,0,k),mix(-127,-130,k)];}
 if(shot.id===2){const bounce=Math.sin(Math.PI*seg(u,0,.62));Object.assign(o,{x:755,y:913-28*bounce,rot:-.06*bounce,left:[-48,-95],right:[58,-105],nod:-.13*bounce,expr:'shock',mouth:.8,tail:-.3+1.25*seg(u,.2,.8)});extra.spoonTip=[80,-139];rice=false;extra.catch=seg(u,0,.5);}
 if(shot.id===3){const k=seg(u,.14,.64);Object.assign(o,{x:818,y:912,s:2.3,left:[-49,-95],right:[mix(41,96,k),mix(-175,-148,k)],expr:'determined',mouth:.4+.35*Math.sin(t*13)**2,nod:-.08,lean:.025*k});extra.press=k;rice=false;}
 if(shot.id===4){Object.assign(o,{x:680,y:1345,s:4,left:[-49,-95],right:[72,-151],expr:u>.70?'shock':'determined',mouth:.35+.4*Math.sin(l*15)**2,nod:.085*Math.sin(l*17)*(1-seg(u,.48,.78)),look:[u>.7?.8:.1,0],tail:.3});rice=false;}
 if(shot.id===5){const put=seg(u,0,.22),j=seg(u,.34,.91),h=245*Math.sin(Math.PI*j),lower=seg(u,0,.15);Object.assign(o,{x:mix(511,1299,j),y:913-h,s:1.88,left:[mix(-48,-31,lower),mix(-95,-97,lower)],right:[65,-148],expr:'grin',mouth:.35,rot:.16*Math.sin(Math.PI*j),nod:.08,hair:-.45*Math.sin(Math.PI*j),tail:.6,feet:[[-23-9*Math.sin(Math.PI*j),-36*Math.sin(Math.PI*j)],[24+11*Math.sin(Math.PI*j),-50*Math.sin(Math.PI*j)]]});if(u>.22){const lift=seg(u,.22,.34);o.left=[mix(-31,-44,lift),mix(-97,-193,lift)];o.right=[mix(65,69,lift),mix(-148,-195,lift)];}basinMode=u<.16?'hand':u<.29?'drop':'shelf';extra.jump=j;}
 if(shot.id===6){const c=seg(u,.08,.5);Object.assign(o,{x:958,y:914,s:2.17,cat:c,left:[-63,-160-22*Math.sin(l*5)],right:[64,-161+23*Math.sin(l*5)],expr:u<.5?'shock':'grin',mouth:.35+.45*Math.sin(l*14)**2,nod:.075*Math.sin(l*8),tail:.8*Math.sin(l*6),hair:.10*Math.sin(l*7)});basinMode='none';extra.cat=c;}
 if(shot.id===7){const j=seg(u,.25,.89),h=204*Math.sin(Math.PI*j);Object.assign(o,{x:mix(635,1318,j),y:914-h,s:2.05,cat:1,left:[mix(-50,37,j),mix(-176,-181,j)],right:[mix(68,92,j),mix(-185,-159,j)],expr:'grin',mouth:.4,rot:.16*Math.sin(Math.PI*j),nod:.07,tail:.6,hair:-.35*Math.sin(Math.PI*j),feet:[[-23-11*Math.sin(Math.PI*j),-38*Math.sin(Math.PI*j)],[24+13*Math.sin(Math.PI*j),-36*Math.sin(Math.PI*j)]]});basinMode='none';extra.jump=j;}
 // A-8 跨窗跑：一个跑步循环 = 2 个实测拍。
 // ★ 必须守住恒等式「step × cycle == v × l」——脚才不会相对身体越跑越远：
 //     walkRate = 每秒几步（1 步 = 2 拍）= 1/(2·本拍时长)   ≈ 1.075
 //     cycle    = 已走几步 = Δ拍数 / 2                     ≈ l · walkRate
 //     step     = 每步位移 = v / walkRate                  ≈ 0.93·v
 //   三者用同一个 walkRate 推出来。曾经把 step 写死成 v/2（不同源），
 //   于是 step·cycle 只有 v·l 的 54%，脚一路往后漂 → 腿被拉成一条直线。
 if(shot.id===8){const T8=musicTime(t),walkRate=1/(2*beatPeriod(T8)),cycle=(kOf(T8)-kOf(musicTime(shot.start)))/2,v=550,s=2.04,step=v/walkRate,bob=-5*Math.cos(cycle*TAU*2);Object.assign(o,{x:276+v*l,y:914,s,cat:1,lean:.08,bob,left:[-53-20*Math.sin(cycle*TAU),-133+18*Math.sin(cycle*TAU)],right:[53+20*Math.sin(cycle*TAU),-133-18*Math.sin(cycle*TAU)],expr:'grin',mouth:.3,nod:.05,tail:.6*Math.sin(cycle*TAU-.6),hair:-.25,flare:.3});const feet=[],stance=[];for(let i=0;i<2;i++){const phase=cycle+i*.5,n=Math.floor(phase),q=phase-n,sx=276+step*(n-i*.5)+step*.25;const x=q<.5?sx:sx+step*ease((q-.5)*2),y=q<.5?914:914-69*Math.sin((q-.5)*TAU);feet.push([(x-o.x)/s,(y-o.y)/s]);stance.push(q<.5)}o.feet=feet;extra.runCycle=cycle;extra.stance=stance;basinMode='none';}
 if(shot.id===9){const k=seg(u,0,.4),pull=seg(u,.43,.82);Object.assign(o,{x:mix(1090,1248,1-(1-clamp(u/.41))**3),y:914,s:2.04,cat:1,left:[-56,-174],right:[mix(91,58,pull),mix(-145,-150,pull)],expr:pull>.5?'wink':'shock',mouth:.4,nod:mix(.03,-.07,pull),tail:.3*Math.sin(l*5),hair:.25*(1-k),feet:[[-25,0],[25,0]]});basinMode='none';extra.pull=pull;extra.brake=k;}
 const R=whaleRig(o),anchors=Object.fromEntries(Object.entries(R.anchors).map(([k,p])=>[k,{x:p[0],y:p[1]}]));if(extra.stance){anchors.lStance=extra.stance[0];anchors.rStance=extra.stance[1];}
 let basin=null;if(basinMode==='hand')basin=holdBowl(o,R);if(basinMode==='drop'){const release={...o,x:511,y:913,s:1.88,rot:0,left:[-31,-97],right:[65,-148],feet:[[-23,0],[24,0]]},b=holdBowl(release,whaleRig(release)),q=clamp((u-.16)/.13);basin={x:mix(b.x,383,q),y:mix(b.y,798,q*q),s:mix(b.s,1.42,q),rot:0};}if(basinMode==='shelf')basin={x:383,y:798,s:1.42,rot:0};
 return{t,shot,u,local:l,pose:o,rig:R,anchors,basin,bowlMode:basinMode,rice,...extra};}
function hero(g,s){floorShadow(g,s.pose,s.jump?Math.sin(s.jump*Math.PI):0);drawWhale(g,s.pose);if(s.basin)bowl(g,s.basin);}
/* ★ 铃铛 +「来活了」预告：开场"午饭开动"到"来活了"这一段（镜头 1–2）。
 *   第 4 拍（cue(4)）铃铛响一下 —— 提前暗示"来活了"，随后 2.6s 那张
 *   「新请求 / 大肥鱼，帮我…」卡片才飞入（第二次）。 */
function bellHint(g,T){
 const c=cue(4),k=T-c;
 const down=clamp((T-(c-.62))/.5),up=clamp((T-(c+1.15))/.62),drop=down*(1-up);
 if(drop<=.002)return;
 const ring=drop>.9&&k>=0?Math.exp(-3.1*k):0, sw=ring?0.46*ring*Math.sin(k*27):0.018*Math.sin(T*2.6);
 const bx=250,by=205-(1-drop)*330,csc=.80+.20*drop;
 g.save();g.globalAlpha=Math.min(1,drop*3);g.translate(bx,by);g.scale(csc,csc);g.translate(-bx,-by);
 at(g,M(tr(bx,0),rt(sw)),()=>{
  line(g,[0,0],[0,by-36],'#9c7b46',1.8);
  piece(g,ell(0,by-2,25,9),C.gold,{lift:2,r:30,c:[0,by-2],shade:.12});
  piece(g,smooth([[-23,by-8],[-16,by-31],[0,by-35],[16,by-31],[23,by-8]],{tension:.26}),C.gold,{lift:3.2,r:42,c:[0,by-20],shade:.14});
  polygon(g,[[-12,by-27],[-5,by-33],[0,by-34],[-3,by-23]],'#fff0bc',{lift:.8,r:20,c:[-6,by-29],shade:.05});
  piece(g,ell(0,by+5,4.6),C.navyDark,{lift:1,r:9,c:[0,by+5]});
 });
 g.save();
 for(let i=0;i<3;i++){const p=ring?k*3.4-i*.24:0;if(p<=0||p>=1)continue;
  g.globalAlpha=.55*(1-p);g.strokeStyle='#ffe6a0';g.lineWidth=3.2*(1-p*.55);
  for(const s of[-1,1]){g.beginPath();g.arc(bx,by-18,28+48*p,s>0?-1.0:Math.PI+1.0,s>0?1.0:Math.PI-1.0);g.stroke();}}
 g.restore();
 if(k>-0.10&&drop>.02){const q=clamp((k+0.10)/.30),e=Math.exp(-5.2*q),pop=Math.max(1,1+.34*e*Math.sin(10*q)),cs=pop*(1-.88*up);
  g.save();g.globalAlpha*=Math.max(0,1-up*1.25);
  at(g,M(tr(bx+52,148-330*(1-drop)),sc(Math.max(.05,cs),Math.max(.05,cs))),()=>{
   polygon(g,[[10,58],[30,80],[50,58]],'#ffd27a',{lift:1.4,r:40,c:[30,64],shade:.06});
   card(g,0,0,188,60,'#ffd27a',-.02);txt(g,'来活了',94,31,33,C.navy,'center');
   line(g,[10,6],[178,6],'#fff3c8',2,.8);});g.restore();}
 g.restore();
}
function drawSpoon(g,s){const target=pt(s.rig.root,s.spoonTip||[75,-185]),h=s.rig.anchors.rHand,d=Math.hypot(target[0]-h[0],target[1]-h[1]),len=32*s.pose.s,tip=[h[0]+(target[0]-h[0])*len/d,h[1]+(target[1]-h[1])*len/d];spoon(g,h,tip,s.pose.s*.70,s.rice);}
function foreground(g){drawForegroundDetail(g);}

export function renderFrame(g,t){const s=sampleState(t),{shot,u,local:l,pose:o,anchors:a}=s;g.save();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,1920,1080);book(g,t,shot.id);
 if(shot.id===1||shot.id===2||shot.id===3)bellHint(g,t);
 if(shot.id===1){stage(g,380,914,798,C.blue);card(g,1062,607,442,239,'#ffe4a6',-.035);drawOpeningSignDetail(g,1062,607,442,239,-.035);txt(g,'午饭，开动！',1280,699,53,C.navy,'center');txt(g,'差一点就吃到了…',1280,770,31,C.navy,'center');hero(g,s);drawSpoon(g,s);if(u>.4)foldedStar(g,944,331,20,C.gold,l);}
 if(shot.id===2){stage(g,358,914,1135,C.blue);hero(g,s);drawSpoon(g,s);const p=s.rig.anchors.tailTip,k=s.catch;request(g,mix(1900,p[0]-55,k),mix(270,p[1]-209,k),390,204,'新请求','大肥鱼，帮我…',mix(-.21,.035,k));for(let i=0;i<6;i++){const q=clamp(u*1.3);grain(g,a.mouth.x+20+180*q+i*9,a.mouth.y-35-180*q+300*q*q-i*12,1.7,q*5+i);}speech(g,'诶？！',387,244,230,99,-.11);}
 if(shot.id===3){stage(g,343,912,1320,C.blue);windowFrame(g,998,347,596,439,'称呼输入框',C.blueLight);txt(g,'大',1097,484,76);txt(g,'鱼',1452,484,76);piece(g,rr(1065,555,452,154,2),'#dbd8c4',{lift:3,r:480,c:[1287,630],shade:.08});hero(g,s);const k=s.press;at(g,M(tr(a.rHand.x+19,a.rHand.y-23),sc(1-.57*k,1+.18*k)),()=>{card(g,0,-59,120,126,C.pink,-.055);txt(g,'肥',61,5,90,C.navy,'center');});speech(g,'我才不是大肥鱼！',1057,167,649,121,-.03);if(k>.67)for(let i=0;i<3;i++)line(g,[a.rHand.x+13+i*22,a.rHand.y-65],[a.rHand.x+22+i*27,a.rHand.y-98],C.pink,5);}
 if(shot.id===4){fan(g,679,540,425,'#d4d8ba');card(g,1225,188,526,382,'#ecd8b0',.025);txt(g,'才不是！',1490,297,71,C.navy,'center');txt(g,'大 肥 鱼',1490,408,56,'#b97570','center');line(g,[1377,384],[1605,429],'#b97570',7);hero(g,s);grain(g,a.mouth.x+68,a.mouth.y-19,2.9,Math.sin(l*17)*.15);if(u>.66)request(g,mix(2000,1320,seg(u,.66,.92)),645,469,242,'人设委托','请变成猫娘！',-.06);}
 if(shot.id===5){stage(g,225,914,410,C.blue);stage(g,1090,914,595,C.pink);g.save();g.translate(1094,0);g.scale(Math.max(.015,seg(u,0,.22)),1);g.translate(-1094,0);windowFrame(g,1094,249,589,663,'人设 / CAT GIRL',C.pink,1);fan(g,1394,558,191,C.blueLight);for(const side of[-1,1])polygon(g,[[1394+side*48,509],[1394+side*82,434],[1394+side*98,526]],C.navy,{lift:3,r:70,c:[1394+side*75,483],shade:.1});piece(g,blob(1394,558,95,80,{amp:.025,n:28}),C.white,{lift:4,r:120,c:[1394,558],shade:.1});piece(g,ell(1361,551,7,10),C.navy,{lift:1,r:15,c:[1361,551]});piece(g,ell(1427,551,7,10),C.navy,{lift:1,r:15,c:[1427,551]});txt(g,'猫耳 × 鲸尾',1393,710,46,C.navy,'center');g.restore();card(g,269,872,250,30,C.gold);hero(g,s);if(u<.16)drawSpoon(g,s);if(s.jump>.08&&s.jump<.87)speed(g,o.x-140,o.y-190);}   // 原结尾有一块 #a87179 的"幕板"从右侧滑入（u>.88），滑进来后镜头就切了、什么也没变成，看着像游离色块 —— 已删
 if(shot.id===6){windowFrame(g,400,177,1107,739,'人设完成中',C.pink);fan(g,957,521,312,'#c6d4be');stage(g,470,914,966,C.blueLight);hero(g,s);for(let i=0;i<7;i++){let a0=i/7*TAU+l*.25;foldedStar(g,963+Math.cos(a0)*(260+30*s.cat),535+Math.sin(a0)*(285+20*s.cat),14+10*Math.sin(s.cat*Math.PI),i%2?C.gold:C.pink,a0);}if(u>.64){speech(g,'喵？',1241,309,198,95,.07);}}
 if(shot.id===7){stage(g,246,914,567,C.blue);stage(g,1010,914,655,C.pink);windowFrame(g,1150,222,472,464,'下一份委托',C.blueLight);const cx=1001+450*seg(u,.07,.84),cy=362+40*Math.sin(l*4);cursor(g,cx,cy,1.15,.12*Math.sin(l*6));hero(g,s);if(s.jump>.02&&s.jump<.92)speed(g,o.x-145,o.y-180);if(u>.91)for(let i=0;i<3;i++)line(g,[o.x-70+i*61,916],[o.x-91+i*83,896-i%2*13],C.blueDark,3,.65);}
 if(shot.id===8){for(let i=0;i<4;i++){const x=192+i*408;windowFrame(g,x,264+(i%2)*47,354,473,['人设','草图','动画','接单'][i],[C.blueLight,C.pink,'#bdb6c8',C.mint][i]);stage(g,x-22,914,418,[C.blue,C.pink,'#b1a8c0',C.mint][i]);for(let j=0;j<3;j++)piece(g,rr(x+55,397+(i%2)*47+j*55,237-j*30,12,1),j%2?C.pink:C.blue,{lift:2,r:250,c:[x+150,440],shade:.06});}hero(g,s);speed(g,o.x-165,o.y-160);cursor(g,1743,599,1);}
 if(shot.id===9){stage(g,220,914,1474,C.mint);windowFrame(g,1450,257,316,655,'接单中',C.blueLight);card(g,1482-67*s.pull,565,246,166,C.pink);txt(g,'下一单',1604-67*s.pull,634,50,C.navy,'center');hero(g,s);const grip=s.rig.anchors.rHand,end=[1483-67*s.pull,691];line(g,grip,end,'#8f7e6a',12);line(g,grip,end,C.pink,9);line(g,[grip[0],grip[1]-2],[end[0],end[1]-2],'#f9debf',2);piece(g,ell(...grip,13,13),C.pink,{lift:2,r:18,c:grip,shade:.1});piece(g,ell(...grip,6,6),C.white,{lift:1,r:10,c:grip,shade:.1});if(u>.53){speech(g,'好啦，开工喵！',423,252,645,126,-.027);foldedStar(g,1592,400,33,C.gold,l*.4);}if(u<.37)speed(g,o.x-146,o.y-100);}
 foreground(g);g.restore();return s;}

// Shared drawing vocabulary exported for the full-film blocks. Frozen sample remains unchanged.
export {txt,line,polygon,card,foldedStar,fan,book,stage,windowFrame,request,speech,bowl,grain,spoon,cursor,speed,floorShadow,holdBowl,hero,drawSpoon,foreground};
