import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {createCanvas, loadImage, Path2D} from '@napi-rs/canvas';
globalThis.Path2D=Path2D;
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
 const {drawPuzzleImage,containImage}=await vite.ssrLoadModule('/src/puzzle/imageGeometry.ts');
 const {buildEdgeMap,buildPiecePath,pieceEdges}=await vite.ssrLoadModule('/src/puzzle/jigsaw.ts');
 const manifest=JSON.parse(fs.readFileSync('server/public/images/manifest.json'));
 let sprites=0;
 for(const id of ['mona-lisa','great-wave','the-kiss','water-lilies']){
  const img=await loadImage(`server/public/images/full/${id}.webp`);
  assert.deepEqual(manifest[id+'.webp'],{w:img.width,h:img.height},'manifest must describe delivered pixels');
  for(const multiplier of [1,1.73])for(const [cols,rows] of [[5,5],[8,8],[10,10],[12,12],[12,16]]){
   const width=img.width*multiplier,height=img.height*multiplier,pw=width/cols,ph=height/rows,scale=500/Math.max(width,height);
   const ref=createCanvas(Math.ceil(width*scale),Math.ceil(height*scale));ref.getContext('2d').drawImage(img,0,0,width*scale,height*scale);
   const edges=buildEdgeMap(cols,rows,1234);
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const left=Math.floor(x*pw*scale),top=Math.floor(y*ph*scale);
    const spr=createCanvas(Math.ceil(pw*scale)+2,Math.ceil(ph*scale)+2),ctx=spr.getContext('2d');
    ctx.translate(-left,-top);ctx.scale(scale,scale);ctx.translate(x*pw,y*ph);
    ctx.clip(buildPiecePath(pw,ph,pieceEdges(edges,x,y)));
    drawPuzzleImage(ctx,img,width,height,x*pw,y*ph);
    const sx=Math.floor(pw*scale/2),sy=Math.floor(ph*scale/2);
    const actual=ctx.getImageData(sx,sy,1,1).data,expected=ref.getContext('2d').getImageData(left+sx,top+sy,1,1).data;
    assert.equal(actual[3],255,`${id} ${cols*rows} piece ${x},${y} must have image coverage`);
    for(let c=0;c<3;c++)assert.ok(Math.abs(actual[c]-expected[c])<=2,`${id} piece ${x},${y} must match full reference`);
    sprites++;
   }
  }
  console.log('PASS portrait/landscape/square image + legacy oversized geometry:',id);
 }
 for(const [w,h] of [[1476,2200],[2200,1476],[2000,2000]])for(const [mw,mh] of [[168,132],[124,100]]){
  const r=containImage(w,h,mw,mh);assert.ok(r.width<=mw+.001&&r.height<=mh+.001);assert.ok(Math.abs(r.width/r.height-w/h)<.00001);
 }
 console.log(`PASS ${sprites} clipped sprites across 40 image/difficulty/legacy combinations; desktop/mobile reference ratios preserved`);
}finally{await vite.close();}
