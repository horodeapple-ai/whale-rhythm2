import {C} from './art-palette.mjs';
import {musicTime} from './music-clock.mjs';
// ★ 节拍改读实测节拍表（rhythm.mjs）：恒速网格在后半片会落到反拍上
import {kOf} from './rhythm.mjs';
// Designed task props for the original blue-and-gold screen world.
// Character artwork stays in the untouched approved rig; these are removable props.
import {whaleRig,piece,rr,ell,at,M,tr,rt,sc,pt} from './paper-whale.mjs';
import {txt,line,polygon} from './opening-sample.mjs';
export const AGENTS=Object.freeze([
 {id:'01',key:'scarf',role:'bike',label:'绘图',detail:'鹈鹕动画',color:'#36b7d1'},
 {id:'02',key:'satchel',role:'game',label:'代码',detail:'游戏搭建',color:'#e8b64b'},
 {id:'03',key:'ribbon',role:'dispatch',label:'验收',detail:'旧代码测试',color:'#8dcbc0'}
]);
const P={deep:'#0b365b',blue:'#176c9c',ice:'#bdeff0',gold:'#f0bc53',cream:'#fff0cd'};
const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
export const agentFor=key=>AGENTS.find(a=>a.key===key||a.role===key);
export function beatPhase(T,multiple=1,delay=0){return (kOf(musicTime(T))*multiple-delay)*TAU;}
export function settle(T,since,amount=1){const q=Math.max(0,T-since);return q<.65?Math.sin(q*18)*Math.exp(-q*8)*amount:0;}
function pin(g,x,y){piece(g,ell(x,y,2.3),P.gold,{lift:1,r:5,c:[x,y],rimW:.5});line(g,[x-1,y],[x+1,y],P.deep,.5);}
export function agentBadge(g,o,key){
 const a=agentFor(key),main=!a;
 // ★ 本体（主角）不挂牌子：原来会在她胸口挂一块写着"本体"的小牌，用户要求去掉。
 //   三个子代理（01/02/03）继续保留各自的标识牌 —— 那是用来区分"谁是谁"的，
 //   本体不需要挂牌也能认出来。
 if(main)return;
 const R=whaleRig(o),w=94,h=54;
 const y=-57,local=M(R.root,M(tr(0,y+(o.bob||0)),rt(.035*Math.sin(beatPhase(o.t||0,.5,.14)))));
 // A background character may deliberately cross a close-up crop; never leave
 // an unreadable half badge at the edge. This includes the final camera push.
 if(g.getTransform&&g.canvas){const q=g.getTransform(),screen=M([q.a,q.b,q.c,q.d,q.e,q.f],local),corners=[[-w/2,-h],[w/2,-h],[w/2,0],[-w/2,0]].map(p=>pt(screen,p)),sx=g.canvas.width/1920,sy=g.canvas.height/1080;if(corners.some(p=>p[0]<24*sx||p[0]>g.canvas.width-24*sx||p[1]<24*sy||p[1]>g.canvas.height-28*sy))return;}
 at(g,local,()=>{
  line(g,[-w*.30,-h-8],[0,-h+3],P.gold,1.3);line(g,[w*.30,-h-8],[0,-h+3],P.gold,1.3);
  piece(g,rr(-w/2,-h,w,h,3),P.deep,{lift:2,r:100,c:[0,-h/2],shade:.1,rimW:1});
  g.strokeStyle=P.gold;g.lineWidth=1;g.strokeRect(-w/2+3,-h+3,w-6,h-6);
  txt(g,'子代理 '+a.id,0,-h+12,12,P.ice,'center');line(g,[-32,-h+21],[32,-h+21],P.gold,.7);txt(g,a.label,0,-16,25,P.cream,'center');
  pin(g,-w/2+7,-h+7);pin(g,w/2-7,-h+7);
 });
}
export function workCard(g,x,y,key,opts={}){
 const a=agentFor(key)||AGENTS[0],s=opts.s??1,r=opts.rot??0;
 at(g,M(tr(x,y),M(rt(r),sc(s,s))),()=>{
  piece(g,rr(-85,-55,170,110,3),P.deep,{lift:5,r:180,c:[0,0],shade:.15,rimW:1.6});
  polygon(g,[[-85,-55],[85,-55],[91,-48],[-79,-48]],P.gold,{lift:1,r:180,c:[0,-52],rimW:.6});
  piece(g,rr(-78,-47,156,94,2),'#fff0cf',{lift:1,r:160,c:[0,0],shade:.045,rimW:.7});
  piece(g,rr(-78,-47,156,25,1),P.blue,{lift:.5,r:160,c:[0,-35],shade:.07,rimW:.5});
  txt(g,(opts.result?'结果':'工单')+' '+a.id+' / 子代理',0,-35,14,P.cream,'center');
  txt(g,a.label,-11,0,33,P.deep,'center');
  txt(g,opts.result?'已完成 · 回本体':a.detail,0,32,16,P.deep,'center');
  line(g,[-62,17],[62,17],P.gold,1);
  if(opts.result){line(g,[38,-2],[45,6],P.blue,3);line(g,[45,6],[59,-10],P.blue,3);}else{
   piece(g,ell(52,-2,12),a.color,{lift:1,r:18,c:[52,-2],rimW:.6});txt(g,a.id,52,-1,12,P.deep,'center');
  }
  pin(g,-71,-35);pin(g,71,-35);
 });
}
export function cuePlaque(g,x,y,text,w=290,s=1){at(g,M(tr(x,y),sc(s,s)),()=>{
 piece(g,rr(-w/2,-24,w,48,3),P.deep,{lift:3,r:w,c:[0,0],shade:.1,rimW:1});
 g.strokeStyle=P.gold;g.lineWidth=1.2;g.strokeRect(-w/2+4,-20,w-8,40);
 txt(g,text,0,0,23,P.cream,'center');for(const xx of[-w/2+12,w/2-12])pin(g,xx,0);
});}
export function route(g,from,to,progress=1){g.save();g.globalAlpha=.42;g.setLineDash([4,8]);line(g,from,[from[0]+(to[0]-from[0])*clamp(progress),from[1]+(to[1]-from[1])*clamp(progress)],P.gold,1.6);g.restore();}
export function contact(name,hand,target,active=true){return{name,hand:[...hand],target:[...target],distance:Math.hypot(hand[0]-target[0],hand[1]-target[1]),active};}
