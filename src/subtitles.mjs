// 歌词字幕（当前：**只显示英文**一行）。
// 数据来自 src/lyrics-data.mjs —— 官方网易云 LRC（英）+ 网易云官方翻译（中），
// 已映射到本工程 140.032s 时间轴（映射依据见该文件头部注释）。
// 显示规则：每句只在 [t, end) 内出现，两侧各 0.18 秒淡入淡出；不做任何闪光/抖动/弹跳。
//
// 版式沿革（用户 2026-10-08 逐条要求，依次是）：
//   ① 不要纸片条背景 → ② 中文字号调小 → ③ 英文离中文近一点、整块往下一点
//   → ④ 不要给字体描边 → ⑤ **去掉中文字幕，英文放到合适位置**（= 现在这一版）。
// 所以现在：纯英文一行、无底色无描边、居中在屏幕下方 EN_CY 处。
// 想恢复双语：把 SHOW_ZH 改 true（两行版式常量 GAP/CY_TWO 都还在）；
// 想给字加回奶油描边：把 OUTLINE_EN / OUTLINE_ZH 从 0 调到 4 左右（描边机制还在）。
//
// 说明：中文那 39 句翻译仍完整保存在 src/lyrics-data.mjs 里（没删数据，只是不画）。
// 字幕画在相机变换之外（屏幕空间），所以不会被推镜放大。
import {C} from './art-palette.mjs';
import {LYRICS,LRC_NUDGE} from './lyrics-data.mjs';

const FADE=.18;
const MAXW=1520;              // 单行最大宽度（超了缩字号）
const EN_SIZE=30, ZH_SIZE=32; // 英文字号 / 中文字号
const SHOW_ZH=false;          // 用户要求：去掉中文字幕
const EN_CY=1030;             // 只显示英文时，英文行的中心（屏幕空间）
const GAP=4, CY_TWO=1014;     // 两行版式（SHOW_ZH=true 时才用）
const EN_COL='#42597d';       // 英文色
const ZH_COL=C.navy;
const EN_WEIGHT='bold';       // 用户 2026-10-08：「加粗一些」（真 bold 字重；Fredoka 是可变字体）
const OUTLINE='#f7e7c4';      // 描边色（奶油纸色）——用户 2026-10-08 先否后要，现已启用
const OUTLINE_EN=4.0, OUTLINE_ZH=4.8;   // 0 = 不描边

const LINES=LYRICS.map(l=>({t:l.t+LRC_NUDGE,end:l.end+LRC_NUDGE,en:(l.en||'').trim(),zh:(l.zh||'').trim()}))
  .filter(l=>l.en||l.zh);

export function lyricAt(t){for(const l of LINES)if(t>=l.t&&t<l.end)return l;return null;}
export function subtitleEnabled(){return globalThis.__subs!==false}

function widthOf(g,s,font,size,weight=''){g.font=`${weight?weight+' ':''}${size}px ${font}`;return g.measureText(s).width;}

// ow<=0 时就是纯填色（当前设置）；ow>0 时先描奶油边再填色
function text(g,s,x,y,font,size,fill,ow,weight=''){
  g.font=`${weight?weight+' ':''}${size}px ${font}`;g.textAlign='center';g.textBaseline='middle';
  if(ow>0){g.lineWidth=ow;g.strokeStyle=OUTLINE;g.lineJoin='round';g.miterLimit=2;g.strokeText(s,x,y);}
  g.fillStyle=fill;g.fillText(s,x,y);
}

export function drawSubtitle(g,t){
 if(!subtitleEnabled())return;
 const l=lyricAt(t);if(!l)return;
 const a=Math.min(1,(t-l.t)/FADE,(l.end-t)/FADE);if(a<=.01)return;

 // 英文行的波浪号统一成半角，避免 Latin 字体缺字回退
 const en=l.en.replace(/～/g,'~');
 let se=EN_SIZE,sz=ZH_SIZE;
 let we=widthOf(g,en,'Fredoka',se,EN_WEIGHT);
 let wz=SHOW_ZH?widthOf(g,l.zh,'KuaiLe',sz):0;
 const avail=MAXW;
 if(Math.max(we,wz)>avail){const k=avail/Math.max(we,wz);se=Math.max(18,Math.floor(se*k));sz=Math.max(21,Math.floor(sz*k));
   we=widthOf(g,en,'Fredoka',se,EN_WEIGHT);wz=SHOW_ZH?widthOf(g,l.zh,'KuaiLe',sz):0;}

 // 单行：英文居中在 EN_CY；两行：按 GAP 排，整块居中在 CY_TWO
 const rowE=Math.round(se*1.30),rowZ=Math.round(sz*1.30);
 let cy=EN_CY,yE=0,yZ=0;
 if(SHOW_ZH){cy=CY_TWO;const block=rowE+GAP+rowZ;yE=-(block)/2+rowE/2;yZ=(block)/2-rowZ/2;}

 g.save();g.globalAlpha=a;
 g.translate(960,cy);
 if(en)text(g,en,0,yE,'Fredoka',se,EN_COL,OUTLINE_EN,EN_WEIGHT);
 if(SHOW_ZH&&l.zh)text(g,l.zh,0,yZ,'KuaiLe',sz,ZH_COL,OUTLINE_ZH);
 g.restore();
}
