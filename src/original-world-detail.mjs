/* Original screen-world art refinement. Drawing only: no poses, timing, camera, or audio changes. */
const P={ink:'#082e56',deep:'#082653',royal:'#145995',blue:'#1988c0',cyan:'#49c7da',ice:'#b8eff2',gold:'#f0b941',goldLight:'#ffe5a0',goldDark:'#a96520',cream:'#fff0cd',coral:'#ef8564'};
function poly(g,pts,fill,stroke=null,w=1){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=w;g.stroke();}}
function line(g,a,b,c,w=1){g.beginPath();g.moveTo(...a);g.lineTo(...b);g.strokeStyle=c;g.lineWidth=w;g.stroke();}
function rect(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h);}
function circle(g,x,y,r,c){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=c;g.fill();}
function gradient(g,x,y,w,h,colors){const z=g.createLinearGradient(x,y,x+w,y+h);colors.forEach((c,i)=>z.addColorStop(i/(colors.length-1),c));return z;}
function rivet(g,x,y,r=2){circle(g,x,y,r+1,'#956120');circle(g,x-.3,y-.6,r,'#ffdf89');line(g,[x-r*.5,y],[x+r*.5,y],'#b47b2d',.7);}
function diamond(g,x,y,r,col){poly(g,[[x,y-r],[x+r*.58,y],[x,y+r],[x-r*.58,y]],col);}
function arc(g,r,c,w,start=Math.PI*1.03,end=Math.PI*1.97){g.save();g.translate(960,540);g.scale(1,.79);g.beginPath();g.arc(0,0,r,start,end);g.strokeStyle=c;g.lineWidth=w;g.stroke();g.restore();}
function building(g,x,base,h,w,layer,seed){
 const y=base-h,depth=layer===0?13:19+layer*3;
 const palette=[['#15558c','#0b3c73','#2677ad'],['#1976ad','#104e85','#46afd0'],['#258ea9','#11677e','#74d5d3']][layer];
 // Every tower keeps the source silhouette; separate side, roof and face planes add depth.
 poly(g,[[x,base],[x,y],[x+w*.3,y-32],[x+w,y-22],[x+w,base]],palette[0]);
 poly(g,[[x+w-depth,y-20],[x+w,y-22],[x+w,base],[x+w-depth,base]],palette[1]);
 poly(g,[[x,y],[x+w*.3,y-32],[x+w,y-22],[x+w-depth,y-12],[x+depth,y+8]],palette[2]);
 line(g,[x,y],[x,base],layer===2?'#81d9d6':'#53b8db',1.25);
 line(g,[x,y],[x+w*.3,y-32],palette[2],1.5);
 line(g,[x+w*.3,y-32],[x+w,y-22],layer===2?'#c1f1dc':'#78ceee',1.1);
 line(g,[x+w-depth,y-12],[x+w-depth,base],palette[2],.8);
 // Crisp inset casements, individual warm windows and horizontal cornices.
 const cols=Math.floor((w-depth-22)/25),rows=Math.floor((h-26)/34);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const wx=x+13+c*26,wy=y+23+r*34,lit=(seed+r*3+c*7)%5<2;
  rect(g,wx-1,wy-1,15,21,palette[1]);
  rect(g,wx,wy,13,18,lit?(layer===2?'#ffc85a':'#ffe19a'):(layer===0?'#2e8ab5':'#79ced7'));
  rect(g,wx,wy,13,3,lit?'#fff1bc':'#a1ebee');
  line(g,[wx+6.5,wy+2],[wx+6.5,wy+18],palette[1],.9);
  line(g,[wx,wy+10],[wx+13,wy+10],palette[1],.8);
  rect(g,wx-1.5,wy+19,16,2,layer===2?'#ace3d7':'#3d9dbc');
 }
 for(let r=1;r<rows;r++)line(g,[x+3,y+14+r*34],[x+w-depth-3,y+14+r*34],layer===2?'#55bcbf':'#2a90b5',.6);
 if(layer>0){rect(g,x+7,base-14,w-depth-14,3,palette[1]);line(g,[x+4,base-5],[x+w-3,base-5],palette[2],1);}
 if(layer===2&&seed%3===0){const sx=x+w*.48;line(g,[sx,y-24],[sx,y-58],P.gold,1.2);diamond(g,sx,y-59,4,P.goldLight);}
}
function screen(g,x,y,w,h,i,bars=true){
 line(g,[x+w/2,y-45],[x+w/2,y-8],'#d7a64b',1.5);
 poly(g,[[x-6,y-6],[x+w+6,y-6],[x+w+8,y+h+9],[x-6,y+h+9]],'#543c31');
 rect(g,x-5,y-5,w+10,h+10,gradient(g,x,y,w,h,['#ffdf87','#be7f2b']));
 rect(g,x-1,y-1,w+2,h+2,'#123e5c');
 const cool=i%2===1;
 rect(g,x+2,y+2,w-4,h-4,gradient(g,x,y,w,h,cool?['#5fe0e4','#168eb3']:['#ffecab','#e9bc60']));
 rect(g,x+3,y+3,w-6,15,cool?'#097d9e':'#d09a3c');
 for(let k=0;k<3;k++)circle(g,x+10+k*7,y+10,1.5,k===0?P.coral:k===1?P.goldLight:'#cefff2');
 line(g,[x+5,y+19],[x+w-5,y+19],cool?'#a6f5ee':'#fff4cd',.7);
 // Original request bars retained; small header and status details are architectural texture.
 // ★ bars=false 时这里不画条 —— 位置与外框仍在缓存里，条改由 world-fx.mjs 逐帧画，
 //   这样才能跟着 lo/mid/hi 三个频段的包络伸缩（"屏幕均衡器"）。
 if(bars)for(let j=0;j<3;j++){
  rect(g,x+14,y+29+j*13,w-31-j*17,2.5,cool?'#10647e':'#926029');
  rect(g,x+14,y+33+j*13,(w-31-j*17)*.62,.7,cool?'#78e7e4':'#f8e0a0');
 }
 else for(let j=0;j<3;j++)rect(g,x+14,y+29+j*13,w-31-j*17,2.5,cool?'#10647e':'#926029');
 rect(g,x+w-17,y+h-14,8,4,cool?'#c9ffe0':'#d68141');
 for(const [dx,dy]of[[0,0],[w,0],[0,h],[w,h]])rivet(g,x+dx,y+dy,1.35);
 line(g,[x-4,y-4],[x+w+4,y-4],'#ffeeb7',1.25);
 line(g,[x-4,y+h+6],[x+w+6,y+h+6],'#b97626',1.8);
}
function lantern(g,x,y){
 line(g,[x,0],[x,y-5],'#d6ac55',1.5);
 const halo=g.createRadialGradient(x,y+22,0,x,y+22,81);halo.addColorStop(0,'rgba(255,211,106,.25)');halo.addColorStop(1,'rgba(255,202,80,0)');g.fillStyle=halo;g.fillRect(x-85,y-65,170,180);
 const beam=g.createLinearGradient(x,y+26,x,y+218);beam.addColorStop(0,'rgba(255,226,147,.13)');beam.addColorStop(1,'rgba(255,227,153,0)');poly(g,[[x-13,y+25],[x+13,y+25],[x+82,y+214],[x-82,y+214]],beam);
 poly(g,[[x-15,y],[x+15,y],[x+21,y+28],[x-21,y+28]],gradient(g,x-18,y,36,26,['#fff0a4','#edb449']),P.goldLight,1);
 poly(g,[[x-12,y+3],[x-6,y+3],[x-10,y+24],[x-18,y+24]],'#ffeab4');
 line(g,[x-3,y+3],[x-4,y+24],'#cf8f29',1);line(g,[x+8,y+3],[x+12,y+24],'#d6922c',1);
 rect(g,x-21,y+25,42,4,'#8c5922');rect(g,x-18,y+25,36,2,'#fff3bf');rect(g,x-5,y-4,10,4,'#c48731');
}
function stairs(g,side){
 for(let j=5;j>=0;j--){const x=side<0?40+j*92:1550-j*65,y=696-j*34,w=270-j*13;
  // Dark undercut, folded sidewalls, a pale stone tread and brass edge.
  poly(g,[[x+28,y+22],[x+w+39,y+22],[x+w+39,y+38],[x+28,y+38]],'#0c547a');
  poly(g,[[x+w,y],[x+w+38,y+22],[x+w+38,y+37],[x+w,y+16]],'#147191');
  poly(g,[[x,y],[x+w,y],[x+w+38,y+22],[x+27,y+22]],gradient(g,x,y,w,22,['#b6f0ee','#63b9ce']));
  line(g,[x,y],[x+w,y],'#e0fff5',1.5);line(g,[x+27,y+22],[x+w+38,y+22],'#ffcf6b',3);
  line(g,[x+28,y+28],[x+w+37,y+28],'#37acbf',1);
  for(let k=1;k<5;k++)line(g,[x+w*k/5,y+3],[x+27+w*k/5,y+20],'#479fb4',.55);
  // Cantilever braces attach to the tier below, keeping the original floating-paper language.
  if(j<5){const bx=side<0?x+w-48:x+49;poly(g,[[bx,y+38],[bx+19,y+38],[bx+37,y+68],[bx+27,y+68]],'#0e607e');line(g,[bx+19,y+38],[bx+37,y+68],'#d1ab5a',1.2);}
 }
}
export function drawOriginalWorldDetail(g,{bars=true}={}){
 g.save();g.lineJoin='miter';g.lineCap='butt';
 g.fillStyle=gradient(g,0,0,0,1080,['#092652','#145b98','#37a9bd']);g.fillRect(0,0,1920,1080);
 // Soft central turquoise light is spatial; the heroine and UI remain the brightest elements.
 const glow=g.createRadialGradient(1070,500,40,1070,500,700);glow.addColorStop(0,'rgba(50,199,232,.17)');glow.addColorStop(1,'rgba(31,102,194,0)');g.fillStyle=glow;g.fillRect(0,0,1920,1080);
 // Fine celestial register lines add crafted detail only at the outer arch.
 for(let j=0;j<2;j++)arc(g,651+j*8,'rgba(111,199,224,.10)',.75,Math.PI*1.17,Math.PI*1.83);
 for(let layer=0;layer<3;layer++)for(let i=0;i<13;i++)building(g,-90+i*165+layer*37,665+layer*62,110+((i*47+layer*29)%180),95+layer*19,layer,i+layer*13);
 // Original monumental arch proportions, now beveled azure and gilded layers.
 arc(g,571,'#062e57',31);arc(g,577,'#12759c',20);arc(g,581,'#43b5cb',2.2);
 arc(g,590,'#835422',17);arc(g,592,'#f0b33e',13);arc(g,590,'#ffe5a0',2.4);
 arc(g,605,'#ffdc7c',6);arc(g,609,'#ffedb7',1.5);arc(g,620,'#d1a650',1.3);
 for(let i=0;i<=42;i++){const a=Math.PI*1.035+i/42*Math.PI*.93;const r=592,x=960+Math.cos(a)*r,y=540+Math.sin(a)*r*.79;line(g,[960+Math.cos(a)*586,540+Math.sin(a)*586*.79],[960+Math.cos(a)*598,540+Math.sin(a)*598*.79],i%3===0?'#976022':'#c28831',i%3===0?1.4:.6);if(i%6===0)rivet(g,x,y,2);}
 for(let i=0;i<7;i++)screen(g,345+i*190,185+Math.abs(i-3)*39,125,79,i,bars);
 for(const [x,y]of[[115,144],[1770,195],[300,280],[1570,108]])lantern(g,x,y);
 stairs(g,-1);stairs(g,1);
 // Warm ivory tiled apron and a visible layered edge, preserving the original perspective.
 poly(g,[[-50,866],[570,713],[1408,713],[1980,866],[1980,1080],[-50,1080]],'#d4a750');
 poly(g,[[0,879],[582,733],[1394,733],[1920,879],[1920,1052],[0,1052]],gradient(g,0,733,0,360,['#ffe6a9','#fff2d0']));
 line(g,[0,878],[582,732],'#fff7dc',3);line(g,[582,732],[1394,732],'#fff7dc',3);line(g,[1394,732],[1920,878],'#fff7dc',3);
 for(let j=0;j<8;j++){const x=-250+j*340;line(g,[960+(x-960)*.33,737],[x,1052],'#dab66f',1);}
 for(const y of[803,871,958,1042]){line(g,[0,y],[1920,y],'#d9b66f',.85);line(g,[0,y+1],[1920,y+1],'#fff7e0',.75);}
 // Fine inlays follow the apron rather than becoming flat screen-space decoration.
 poly(g,[[70,970],[82,966],[94,970],[82,974]],'#dcac55');poly(g,[[1550,925],[1560,922],[1570,925],[1560,928]],'#dcac55');
 for(let side of[-1,1]){const x=side<0?26:1848;
  poly(g,[[x,234],[x+34,223],[x+34,942],[x,970]],gradient(g,x,230,34,0,['#0a547f','#2f98ad']));
  poly(g,[[x+34,223],[x+42,231],[x+42,941],[x+34,942]],'#0c3d64');
  line(g,[x+2,236],[x+2,965],'#72d7df',1.5);line(g,[x+31,227],[x+31,941],'#edc765',1.5);
  for(let j=0;j<4;j++){const y=328+j*143;rect(g,x-8,y-3,50,7,'#9e6a24');rect(g,x-8,y-3,50,2,'#ffdb81');for(const rx of[x-3,x+35])rivet(g,rx,y,1.7);}
  for(let j=0;j<11;j++){const y=269+j*58;line(g,[x+10,y],[x+22,y-4],'#388fa9',.8);line(g,[x+10,y+21],[x+22,y+17],'#104d70',.8);}
 }
 rect(g,0,1052,1920,28,'#a56d2a');for(let j=0;j<6;j++){rect(g,0,1053+j*4,1920,2,j%2?'#dba94d':'#f4cd7b');}
 g.restore();
}
export function drawOpeningSignDetail(g,x,y,w,h,rot){
 g.save();g.translate(x,y);g.rotate(rot);
 // A lightly embossed frame, keeping the original wording area entirely clear.
 g.strokeStyle='#cb8e30';g.lineWidth=2;g.strokeRect(10,10,w-20,h-20);g.strokeStyle='#fff6d8';g.lineWidth=1;g.strokeRect(13,13,w-26,h-26);
 for(const sx of[21,w-21])for(const sy of[21,h-21]){diamond(g,sx,sy,3.2,'#c58d30');}
 for(const sx of[20,w-20]){line(g,[sx,34],[sx,57],'#d5a14e',1);line(g,[sx,h-34],[sx,h-57],'#d5a14e',1);}
 line(g,[w/2-52,h-37],[w/2-11,h-37],'#d5a14e',.9);line(g,[w/2+11,h-37],[w/2+52,h-37],'#d5a14e',.9);diamond(g,w/2,h-37,4,'#e6a948');
 g.restore();
}
export function drawStageDetail(g,x,y,w,col='#199fca'){
 const variant=col==='#ed8b83'||col==='#e79fa1'?'coral':col==='#74cbb1'||col==='#b8caba'?'mint':col==='#f5bd42'||col==='#e8b856'?'gold':'blue';
 const body={blue:['#35bed9','#0b6e9e'],coral:['#f0a18b','#b85060'],mint:['#84d7bd','#207f85'],gold:['#f4d17b','#b57a30']}[variant];
 const glint={blue:'#65daea',coral:'#ffd1a5',mint:'#bbf8d5',gold:'#ffe8ab'}[variant];
 g.save();poly(g,[[x,y+10],[x+w,y+10],[x+w+25,y+40],[x+20,y+40]],gradient(g,x,y,w,35,body));
 poly(g,[[x+20,y+40],[x+w+25,y+40],[x+w+25,y+46],[x+20,y+46]],'#684d2d');
 line(g,[x+20,y+39],[x+w+23,y+39],'#ffcf68',2.1);rect(g,x,y,w,9,'#fff0c6');rect(g,x,y+8,w,2,'#ffd264');
 for(let i=0;i<7;i++){let xx=x+24+i*(w-40)/6;line(g,[xx,y+14],[xx+10,y+33],glint,1);rivet(g,xx+8,y+29,1.1);}
 g.restore();
}
export function drawForegroundDetail(g){
 g.save();
 for(const side of[-1,1]){
  const x=side<0?48:1649,y=side<0?935:958,a=side<0?.138:-.123,w=side<0?184:220;
  g.save();g.translate(x,y);g.rotate(a);
  poly(g,[[0,0],[w,0],[w,75],[0,75]],side<0?'#12567b':'#a66c28');
  rect(g,3,3,w-6,65,side<0?'#368da5':'#e2ad51');line(g,[3,3],[w-3,3],side<0?'#8ee7e8':'#ffe6a0',2);
  for(let i=0;i<6;i++){const sx=11+i*(w-25)/6;rect(g,sx,12,7,43,side<0?'#073d63':'#805422');rect(g,sx,12,2,43,side<0?'#72d3df':'#ffdf94');}
  for(const [dx,dy]of[[7,7],[w-7,7],[7,61],[w-7,61]])rivet(g,dx,dy,1.4);
  line(g,[0,73],[w,73],side<0?'#061f3e':'#785027',3);g.restore();
 }
 g.restore();
}
