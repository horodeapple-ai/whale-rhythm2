const path=require('path');
const {createCanvas,Path2D,DOMMatrix,ImageData,GlobalFonts}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
global.window=global;global.Path2D=Path2D;global.DOMMatrix=DOMMatrix;global.ImageData=ImageData;
global.document={createElement:()=>createCanvas(1920,1080)};
GlobalFonts.registerFromPath(root+'/assets/ZCOOLKuaiLe-Regular.ttf','KuaiLe');
GlobalFonts.registerFromPath(root+'/assets/Fredoka-Variable.ttf','Fredoka');
require(root+'/vendor/rich-song.js');require(root+'/vendor/rich-lib.js');require(root+'/vendor/rich-cast.js');
module.exports={root,createCanvas};
