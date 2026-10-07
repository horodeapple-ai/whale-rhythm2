// Detailed blue-haired whale maid restored from the approved V3 sample.
// Scene-facing drawing primitives and placement/anchor API remain compatible.
import {piece,blob,smooth,ribbon,ell,rr,stroke,curve,at,M,tr,rt,sc,pt,inv} from '../vendor/rigs/shared.js';
export const C={ink:'#32384c',paper:'#f7ecd7',white:'#fff9e9',blue:'#82bdce',blueLight:'#bde0dc',blueDark:'#458ca4',navy:'#34586e',navyDark:'#273c53',skin:'#f8cda6',pink:'#e79fa1',gold:'#e8b856',mint:'#b8caba',kraft:'#c1a782'};
export {piece,blob,smooth,ribbon,ell,rr,stroke,curve,at,M,tr,rt,sc,pt,inv};
const ART_SCALE=.80,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const arr=p=>[p.x,p.y];
function expression(o){
 if(o.expr&&typeof o.expr==='object')return o.expr.eyes==='half'||o.expr.mouth==='flat'?'deadpan':o.expr.mouth==='wavy'||o.expr.eyes==='tight'?'faint':o.expr.eyes==='closed'?'sleepy':'open';
 return ({smile:'open',grin:'open',happy:'happy',laugh:'happy',sing:'sing',surprise:'shock',shock:'shock',wink:'wink',determined:'determined',serious:'determined',pout:'determined',cry:'cry',sad:'cry',smug:'smug',proud:'smug',sleepy:'sleepy',dizzy:'dizzy',wobble:'dizzy',neutral:'open',worried:'dizzy',think:'deadpan',confused:'deadpan',faint:'faint',relieved:'happy'})[o.expr]||'open';
}
function blinkAt(t){const q=((t+.47)%3.7+3.7)%3.7;return q<.14?Math.sin(q/.14*Math.PI)**2:0;}
function resolve(o={}){
 const root=M(tr(o.x||0,o.y||0),M(rt(o.rot||0),sc(o.s??1,o.s??1)));
 const bodyPose=M(tr(0,o.bob||0),rt(o.lean||0));
 const art=M(bodyPose,sc(ART_SCALE,ART_SCALE)),inverse=inv(art);
 const feet=o.feet||[[-23,0],[24,0]];
 const p={x:0,y:0,s:1,visualScale:Math.max(.1,(o.s??1)*ART_SCALE),sq:1,alpha:1,rot:0,dy:0,headTilt:o.nod||0,
  face:expression(o),mouth:clamp(o.mouth??.25),blink:o.blink??blinkAt(o.t||0),look:o.look||[.1,0],blush:1,
  hair:o.hair||0,tail:(o.tail||0)*25,ears:Math.sin((o.t||0)*2)*1.5,ahoge:(o.hair||0)*.6,skirtFlare:o.flare||0,cat:clamp(o.cat||0),
  lContact:pt(inverse,o.left||[-58,-116]),rContact:pt(inverse,o.right||[54,-133]),feet:feet.map(f=>pt(inverse,f)),legBend:o.legBend??-1,apronLogo:true};
 // Consumers use body/head frames to attach scarves, satchels, helmets and bows.
 // They are compatibility coordinates derived from the actual restored anatomy.
 const body=M(art,tr(0,22));
 const head=M(art,M(tr(0,-146),M(rt(p.headTilt),M(tr(0,-86),sc(1.65,1.65)))));
 return{root,body,head,art,p};
}
export function whaleRig(o={}){
 const R=resolve(o),A=globalThis.CAST.joints(R.p),toLocal=p=>pt(R.art,arr(p)),toWorld=p=>pt(R.root,toLocal(p));
 const limb=side=>{const S=toLocal(A[side+'Shoulder']),E=toLocal(A[side+'Elbow']),C=toLocal(A[side+'Hand']),ha=Math.atan2(C[1]-E[1],C[0]-E[0]);return{S,E,W:[C[0]-Math.cos(ha)*8,C[1]-Math.sin(ha)*8],C,ha};};
 const l=limb('l'),r=limb('r'),legs=['l','r'].map(side=>({H:toLocal(A[side+'Hip']),K:toLocal(A[side+'Knee']),A:toLocal(A[side+'Ankle']),F:toLocal(A[side+'Foot'])}));
 const anchors={lHand:toWorld(A.lHand),rHand:toWorld(A.rHand),lFoot:toWorld(A.lFoot),rFoot:toWorld(A.rFoot),mouth:toWorld(A.mouth),tailTip:toWorld(A.tailTip),head:toWorld(A.head),eye:pt(R.root,pt(R.head,[20,18]))};
 return{...R,l,r,legs,tail:A.tailCurve.map(toLocal),fluke:toLocal(A.tailTip),fg:{mouth:[0,69/1.65]},anchors};
}
export function drawWhale(g,o={}){
 const R=whaleRig(o);g.save();g.transform(...R.root);g.transform(...R.art);globalThis.CAST.fish(g,R.p);g.restore();return R.anchors;
}
