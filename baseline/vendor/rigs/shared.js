/** Shared actor tools. Report hero §2.13 / royals §5.1, completed from stated formulae.
 * This is the report's per-piece material helper, NOT a replacement for src/core.
 * Every public draw routine balances save/restore; no layers or temporal state. */
import {PAL, smooth, blob, rr, ribbon} from '../core/paper.js';
import {clamp, lerp, rgba, mixHex, TAU, hash2, fract} from '../core/util.js';
export {PAL, smooth, blob, rr, ribbon, clamp, lerp, rgba, mixHex, TAU};
export const D=Math.PI/180;
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
export const rot=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
export const I=[1,0,0,1,0,0];
export const M=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export const tr=(x,y)=>[1,0,0,1,x,y], sc=(x,y)=>[x,0,0,y,0,0], rt=a=>[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];
export const pt=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
export const inv=m=>{const d=m[0]*m[3]-m[1]*m[2];return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];};
export function rootMatrix(o){const s=o.s??o.scale??1,F=o.face===-1?-1:1,q=Math.max(-.85,o.squash??0),p=o.pivot??[0,0];let turn=Math.cos(Math.PI*(o.turn??0));if(Math.abs(turn)<.04)turn=Math.sign(turn||1)*.04;return M(tr(o.x??0,o.y??0),M(sc(F*s,s),M(tr(...p),M(rt(o.rot??0),M(tr(-p[0],-p[1]),sc(turn/Math.sqrt(1+q),1+q))))));}
export function at(g,m,fn){g.save();g.transform(...m);fn();g.restore();}
export function localDirection(g,x,y){const m=g.getTransform(),d=m.a*m.d-m.b*m.c;let u=(m.d*x-m.c*y)/d,v=(-m.b*x+m.a*y)/d;const l=Math.hypot(u,v)||1;return [u/l,v/l];}
export function rimLine(g,p,c,w=1.5,a=.65,dir=1){const d=localDirection(g,0,dir);g.save();g.clip(p);g.translate(d[0]*w,d[1]*w);g.lineWidth=w*1.7;g.lineJoin='round';g.strokeStyle=c;g.globalAlpha*=a;g.stroke(p);g.restore();}
let paperFiber=null;
function fiber(g,p){
 if(!paperFiber){const c=document.createElement('canvas');c.width=c.height=128;const q=c.getContext('2d');for(let i=0;i<470;i++){let x=hash2(i,73)*128,y=hash2(i,97)*128;q.fillStyle=i%2?'#493f3214':'#fffbe721';q.fillRect(x,y,i%5===0?2:.65,i%3===0?.65:1.2)}paperFiber=c;}
 g.save();g.clip(p);g.fillStyle=g.createPattern(paperFiber,'repeat');g.fillRect(-2600,-2600,5200,5200);g.restore();
}
export function piece(g,p,fill,o={}){
  g.save();
  if(o.silhouette){g.fillStyle=o.silColor??PAL.ink;g.fill(p);g.restore();return;}
  const detail=o.detail!==0,lift=detail?(o.lift??1.7):0;
  if(lift){const d=localDirection(g,.38,.92);g.save();g.translate(d[0]*lift,d[1]*lift);g.fillStyle=rgba(PAL.shadow,o.liftA??.2);g.fill(p);g.restore();}
  g.fillStyle=fill;g.fill(p);
  if(detail)fiber(g,p);
  if(detail){const r=o.r??45,c=o.c??[0,0],d=localDirection(g,.6,.8);g.save();g.clip(p);const gr=g.createLinearGradient(c[0]-d[0]*r*.2,c[1]-d[1]*r*.2,c[0]+d[0]*r,c[1]+d[1]*r);gr.addColorStop(0,rgba(o.shadeCol??PAL.ink,0));gr.addColorStop(1,rgba(o.shadeCol??PAL.ink,o.shade??.18));g.fillStyle=gr;g.fillRect(c[0]-r*5,c[1]-r*5,r*10,r*10);g.restore();rimLine(g,p,o.under??mixHex(fill,PAL.ink,.4),o.underW??1.4,o.underA??.27,-1);if(o.rim!==false)rimLine(g,p,o.rim??mixHex(fill,PAL.white,.4),o.rimW??1.6,o.rimA??.7,1);}
  g.restore();
}
export function ell(x,y,rx,ry=rx){const p=new Path2D();p.ellipse(x,y,rx,ry,0,0,TAU);return p;}
const caps=new Map();
export function cap(y0,y1,w0,w1){const k=[y0,y1,w0,w1].join(',');if(caps.has(k))return caps.get(k);const p=new Path2D(),r0=w0/2,r1=w1/2;p.moveTo(r0,y0);p.lineTo(r1,y1);p.arc(0,y1,r1,0,Math.PI);p.lineTo(-r0,y0);p.arc(0,y0,r0,Math.PI,TAU);p.closePath();caps.set(k,p);return p;}
export function stroke(g,p,c=PAL.ink,w=1.5,alpha=1,dash=[]){g.save();g.lineCap='round';g.lineJoin='round';g.strokeStyle=c;g.lineWidth=w;g.globalAlpha*=alpha;g.setLineDash(dash);g.stroke(p);g.restore();}
export function curve(points){return smooth(points,{closed:false,tension:.5});}
export function mixJ(A,B,k){const out={};for(const key of new Set([...Object.keys(A),...Object.keys(B)])){const a=A[key],b=B[key];out[key]=typeof a==='number'&&typeof b==='number'?lerp(a,b,k):Array.isArray(a)&&Array.isArray(b)?a.map((v,i)=>typeof v==='number'&&typeof b[i]==='number'?lerp(v,b[i],k):k<.5?v:b[i]):k<.5?a:b;}return out;}
export function resolvePose(p,table,base,c){if(p&&typeof p==='object')return mixJ(resolvePose(p.from,table,base,c),resolvePose(p.to,table,base,c),clamp(p.k??0));return {...base,...(table[p??'idle']??table.idle)(c)};}
export function applyJoints(J,o){J={...J,...o.joints};for(const [k,v] of Object.entries(o.jointsAdd??{}))J[k]=Array.isArray(v)?v.map((n,i)=>(J[k]?.[i]??0)+n):typeof v==='number'?(J[k]??0)+v:v;return J;}
export function keyed(k,keys,base={}){let i=0;k=clamp(k);while(i<keys.length-2&&k>keys[i+1][0])i++;let u=clamp((k-keys[i][0])/(keys[i+1][0]-keys[i][0]||1));u=u*u*(3-2*u);return mixJ({...base,...keys[i][1]},{...base,...keys[i+1][1]},u);}
export function blinkAt(t,seed=1){const n=Math.floor(t/3.7),start=.35+hash2(n,seed)*2.6,dt=t-n*3.7-start;const bump=d=>d>=0&&d<.16?Math.sin(d/.16*Math.PI):0;return Math.max(bump(dt),hash2(n,seed+3)>.72?bump(dt-.3):0);}
/** Pure FK: angle zero is down; positive degrees bend the segment toward +x. */
export function armFK(S,a,l1=29,l2=27,hand=8.5,tA=0){const ua=tA-a[0]*D,fa=ua-a[1]*D,ha=fa-(a[2]??0)*D,E=add(S,rot([0,l1],ua)),W=add(E,rot([0,l2],fa)),C=add(W,rot([0,hand],ha));return {S,E,W,C,ua,fa,ha,l1,l2,hand};}
/** Target is palm center, including the exact rendered palm offset. */
export function armIK(S,target,l1,l2,hand,ha,bend=1){const W=sub(target,rot([0,hand],ha)),v=sub(W,S),len=Math.hypot(...v)||1,d=clamp(len,Math.abs(l1-l2)+.05,l1+l2-.05),targetW=add(S,v.map(x=>x*d/len)),b=Math.atan2(v[1],v[0]),a=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1)),E=add(S,[l1*Math.cos(b+bend*a),l1*Math.sin(b+bend*a)]);return {S,E,W:targetW,C:add(targetW,rot([0,hand],ha)),ua:Math.atan2(E[1]-S[1],E[0]-S[0])-Math.PI/2,fa:Math.atan2(targetW[1]-E[1],targetW[0]-E[0])-Math.PI/2,ha,l1,l2,hand,target,error:Math.hypot(...sub(target,add(targetW,rot([0,hand],ha))))};}
/** Angle-space IK transition preserves every drawn bone length throughout the blend. */
export function blendArm(A,B,k){k=clamp(k);const branch=a=>a+TAU*Math.round((B.ha-a)/TAU),ua=lerp(A.ua,branch(B.ua),k),fa=lerp(A.fa,branch(B.fa),k),ha=lerp(A.ha,B.ha,k),E=add(A.S,rot([0,A.l1],ua)),W=add(E,rot([0,A.l2],fa)),C=add(W,rot([0,A.hand],ha));return {...A,E,W,C,ua,fa,ha,error:k===1?B.error:0};}
export const EXPRESSIONS={
 normal:{eyes:'bean',brows:'neutral',mouth:'smile'}, smile:{eyes:'bean',brows:'neutral',mouth:'smile'},
 proud:{eyes:'half',brows:'proud',mouth:'smirk'}, smug:{eyes:'half',brows:'proud',mouth:'smirk'},
 grin:{eyes:'happy',brows:'up',mouth:'grin'}, laugh:{eyes:'happy',brows:'up',mouth:'laugh'},
 proclaim:{eyes:'bean',brows:'up',mouth:'talk'}, shout:{eyes:'tight',brows:'angry',mouth:'shout'},
 inhale:{eyes:'closed',brows:'up',mouth:'puff'}, confused:{eyes:'bean',brows:'question',mouth:'hmm'},
 think:{eyes:'look',brows:'question',mouth:'hmm'}, question:{eyes:'look',brows:'question',mouth:'o'},
 worried:{eyes:'bean',brows:'worried',mouth:'wavy'}, shock:{eyes:'wide',brows:'high',mouth:'o'},
 reaction:{eyes:'wide',brows:'high',mouth:'gasp'}, relieved:{eyes:'closed',brows:'neutral',mouth:'smile'},
 determined:{eyes:'bean',brows:'angry',mouth:'flat'}, wink:{eyes:'wink',brows:'up',mouth:'grin'},
};
export function faceGeometry(yaw=0,king=false){const ya=clamp(yaw,-1,1)*32*D,rx=king?50:47;const f=lam=>({x:.75*rx*Math.sin(lam*D+ya),sc:.62+.38*Math.cos(lam*D+ya)});const eyes=[f(-34),f(34)].map(e=>({...e,y:king?-1:7}));const mx=f(0).x;return {eyes,mouth:[mx+.5,king?30:26],nose:[mx+2,king?13:17],ear:[-.98*rx,king?3:7],yaw:ya};}
function eye(g,x,y,s,k,blink,look=[0,0]){if(k==='look')look=[look[0]+.8,look[1]-1.8];g.save();g.translate(x,y);g.scale(s,1);g.fillStyle=g.strokeStyle=PAL.ink;g.lineWidth=2.5;g.lineCap='round';if(blink>.65&&['bean','half','wide','look'].includes(k))k='closed';if(k==='closed'||k==='happy'){const p=new Path2D();p.moveTo(-5,0);p.quadraticCurveTo(0,k==='happy'?-6:4.5,5,0);g.stroke(p);}else if(k==='tight'){const p=new Path2D();p.moveTo(-4,-4);p.lineTo(1,0);p.lineTo(-4,4);g.stroke(p);}else{const wide=k==='wide'||k==='look',ry=6.4*(1-.8*blink);if(wide){g.fillStyle=PAL.white;const ox=k==='look'?5.6:6.2,oy=k==='look'?7.4:8;g.fill(ell(0,0,ox,oy));g.lineWidth=k==='look'?1.2:1.65;g.stroke(ell(0,0,ox,oy));g.fillStyle=PAL.ink;}const er=wide?(k==='wide'?2.6:3.7):4.3;g.fill(ell(look[0]*1.8,look[1],er,wide?er*1.35:ry));g.fillStyle=PAL.white;g.fill(ell(-1.25+look[0]*1.8,-2.5+look[1],wide?1.15:1.65));if(k==='half'){g.fillStyle=PAL.skin;g.fillRect(-7,-10,14,9);stroke(g,curve([[-5.5,-1],[0,-.5],[5.5,-1]]),PAL.ink,2.4);}}g.restore();}
function brow(g,x,y,s,side,k,white=false){let dy=0,a=0,arc=-1.2;if(k==='up'){dy=-3;arc=-2;}if(k==='high'){dy=-7;arc=-3;}if(k==='angry')a=-3*side;if(k==='worried')a=3*side;if(k==='proud'){a=side>0?-1:1;dy=side>0?-3:0;}if(k==='question'){dy=side>0?-6:1;a=side>0?0:2;}const p=new Path2D();p.moveTo(x-5.9*s,y+dy-a);p.quadraticCurveTo(x,y+dy+arc,x+5.9*s,y+dy+a);stroke(g,p,white?PAL.beard:PAL.ink,white?3.3:2.6);}
export function drawMouth(g,p,kind='smile',o={}){const [x,y]=p,s=o.s??1,open=clamp(o.open??.7);if(kind==='talk'&&open<.06)kind='smile';g.save();g.translate(x,y);g.scale(s,s);if(['smile','smirk','hmm','flat','wavy'].includes(kind)){const path=new Path2D();if(kind==='wavy'){path.moveTo(-7,1);path.bezierCurveTo(-3,-3,-1,5,2,1);path.quadraticCurveTo(5,-2,8,1);}else{path.moveTo(-6,kind==='smirk'?2:0);path.quadraticCurveTo(0,kind==='flat'?0:kind==='hmm'?-2:5,7,kind==='smirk'?-2:0);}stroke(g,path,PAL.ink,2.2);}else{let rx=8,ry=8,cy=3;if(kind==='o'){rx=4.4;ry=6;cy=1;}if(kind==='puff'){rx=2.8;ry=3.1;cy=0;}if(kind==='shout'||kind==='gasp'){rx=9.7;ry=13;cy=4;}if(kind==='laugh'){rx=10.5;ry=11;cy=3;}if(kind==='talk'){rx=7+3*open;ry=3+10*open;cy=3;}const path=ell(0,cy,rx,ry);piece(g,path,PAL.redDeep,{lift:.45,shade:.09,r:14,rim:false,underW:.6});if(!['o','puff'].includes(kind)){g.save();g.clip(path);g.fillStyle=PAL.white;g.fillRect(-14,cy-ry,28,3.5);g.fillStyle=PAL.heart;const tongue=new Path2D();tongue.moveTo(0,cy+ry);tongue.bezierCurveTo(-10,cy+2,-3,cy+1,0,cy+5);tongue.bezierCurveTo(4,cy,10,cy+4,0,cy+ry);g.fill(tongue);g.restore();}}g.restore();}
/** Draws face ink only. Hair/beard are the caller's layers; eyebrows can be deferred. */
export function drawFace(g,geom,o={}){const ex=typeof o.expr==='object'?{...EXPRESSIONS.normal,...o.expr}:EXPRESSIONS[o.expr]??EXPRESSIONS.normal;const b=o.blink??blinkAt(o.t??0,o.seed??1),blush=.45+(o.blush??0)*.3;
  if(o.part!=='brows'){for(let i=0;i<2;i++){const e=geom.eyes[i];g.fillStyle=rgba(PAL.blush,blush);g.fill(ell(e.x+(i?5:-5),o.king?9:21,8.3,5));eye(g,e.x,e.y,e.sc,ex.eyes==='wink'?(i?'happy':'bean'):ex.eyes,b,o.look);}
  if(!o.noMouth)drawMouth(g,geom.mouth,o.mouth??ex.mouth,{open:o.open});if(!o.noNose){g.fillStyle=PAL.skinShade;g.fill(ell(...geom.nose,2.3,1.8));}}
  if(o.part!=='features')geom.eyes.forEach((e,i)=>brow(g,e.x,e.y-13.5,e.sc,i?1:-1,ex.brows,o.whiteBrows));
}
export function drawHand(g,A,kind='fist',color=PAL.leather,o={}){at(g,M(tr(...A.W),rt(A.ha)),()=>{const r=o.r??8.5,H=A.hand??8.5;let p=blob(0,H,r,r*.98,{seed:4,amp:.018,n:24});if(kind==='open')p=smooth([[-r*.8,1],[-r*.96,H],[-r*.72,H+r*.83],[-r*.18,H+r],[r*.7,H+r*.7],[r*.88,H*.66],[r*.45,-1]],{tension:.4});if(kind==='flat')p=smooth([[-r*.7,0],[-r*.82,H+7],[r*.28,H+11],[r*.64,0]],{tension:.45});piece(g,p,color,{...o,lift:1.2,c:[0,H],r:16});if(kind==='point')piece(g,cap(H,H+17,5.5,4.3),color,{...o,lift:.7,r:24});const thumb=blob(-r*.73,H*.65,r*.47,r*.7,{seed:8,amp:.015,n:20});piece(g,thumb,mixHex(color,PAL.white,.08),{...o,lift:.65,r:11});if(o.detail!==0&&!o.silhouette)stroke(g,curve([[-r*.45,H*.85],[-r*.2,H*.45],[r*.07,H*.51]]),mixHex(color,PAL.ink,.4),.8,.5);});}
export function drawArm(g,A,opts={}){const color=opts.color??PAL.heroBlue,far=opts.far,base=far?mixHex(color,PAL.ink,.18):color,p={detail:opts.detail,rim:far?false:undefined,silhouette:opts.silhouette};if(opts.part!=='lower')at(g,M(tr(...A.S),rt(A.ua)),()=>piece(g,cap(-1,A.l1+1,opts.w0??16,opts.w1??14.6),base,{...p,r:24,c:[0,A.l1/2]}));if(opts.part!=='upper'){at(g,M(tr(...A.E),rt(A.fa)),()=>{piece(g,cap(-2,A.l2+2,opts.w1??14.6,opts.w2??13),base,{...p,r:25,c:[0,A.l2/2]});piece(g,rr(-(opts.w2??13)/2-1,A.l2-5,(opts.w2??13)+2,8,3),opts.cuff??PAL.leather,{...p,lift:1,r:14,c:[0,A.l2]});});if(!opts.noHand)drawHand(g,A,opts.hand??'fist',opts.skin??PAL.leather,{...p,r:opts.hr??8.5});}}
export function socketSet(root,points){return Object.fromEntries(Object.entries(points).map(([k,p])=>[k,pt(root,p)]));}
