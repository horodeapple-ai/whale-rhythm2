/* Deterministic, source-time choreography. The scene owns cut retiming.
 * Gaits take two beats per stride, so each alternating foot lands once per beat.
 * Physical contacts retain their original source timestamps.
 *
 * ★ 节拍来源已换成**实测节拍表**（src/rhythm.mjs），不再用 BPM=128.35 的恒速网格：
 *   这首歌速度在 126–131 BPM 间变化，恒速网格在 70–100s 段会落到反拍上。
 *   函数名与签名保持不变（第 3 个参数语义由"秒偏移"变为"周期相位"，现有调用都只传前两个）。 */
import {musicTime} from './music-clock.mjs';
import {kOf, periodAt} from './rhythm.mjs';
const TAU=Math.PI*2;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
/** 连续拍号（小数）。用法：beatCycles(T,2) = 每 2 拍一圈 */
export const beatCycles=(t,beats=1,phase=0)=>kOf(musicTime(t))/beats-phase;
export const beatWave=(t,beats=2,phase=0)=>Math.sin(TAU*(beatCycles(t,beats)+phase));
export const beatOpen=(t,phase=0)=>.5-.5*Math.cos(TAU*(beatCycles(t,1)+phase));
/** 本拍时长（秒）。原来代码里的 BEAT 常量改成 periodAt(t) —— 跑步步幅 = 速度 × 2 个实测拍 */
export const beatPeriod=(t)=>periodAt(musicTime(t));
export function keys(t,stops){if(t<=stops[0][0])return stops[0][1];for(let i=1;i<stops.length;i++)if(t<=stops[i][0]){const[a,x]=stops[i-1],[b,y]=stops[i];return x+(y-x)*smooth((t-a)/(b-a));}return stops.at(-1)[1];}
// Compact bell: exactly zero at both ends; safe to add around anchored contacts.
export function pulse(t,start,duration){const q=(t-start)/duration;return q<=0||q>=1?0:Math.sin(Math.PI*q)**2;}
export function settle(t,impact,{delay=0,duration=.48,cycles=1.7}={}){const q=(t-impact-delay)/duration;return q<=0||q>=1?0:Math.sin(q*TAU*cycles)*(1-q)**2;}
export function landing(t,impact,strength=1){return strength*(10*pulse(t,impact,.17)-3.5*pulse(t,impact+.17,.24));}
export function arrive(t,start,contact,{pre=.13,hold=.06}={}){if(t>=contact)return 1;const q=clamp((t-start)/(contact-start));const a=Math.min(.28,pre/Math.max(.01,contact-start));if(q<a)return -.055*Math.sin(Math.PI*q/a);const p=clamp((q-a)/(1-a));return p<.74?.87*(1-(1-p/.74)**3):.87+.13*((p-.74)/.26)**2;}
// A short incoming hold ends exactly at contact, followed by an outgoing hold.
export function contactClock(t,contact,pre=2/30,post=2/30){if(t>=contact-pre&&t<contact)return contact-pre;if(t>=contact&&t<=contact+post)return contact;return t;}
