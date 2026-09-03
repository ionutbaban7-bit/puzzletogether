#!/usr/bin/env node
/**
 * Deterministically create the 30 original Stage 5 artworks for the new
 * categories. The drawing source is this dependency-free script; it writes
 * temporary PPM frames and converts them to compact quality-95 JPEG inputs.
 * No third-party image, text, logo, or watermark is used.
 *
 * Usage: node scripts/generate-stage5-procedural-originals.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "data/catalog/incoming");
const W = 1800, H = 1200;
fs.mkdirSync(out, { recursive: true });

const proceduralNature = ["ice-cave"];
const cities = ["bucharest-calea-victoriei", "sibiu-square", "cluj-unirii-square", "timisoara-union-square", "brasov-council-square"];
const isometric = ["iso-floating-garden", "iso-harbor-village", "iso-solar-observatory", "iso-mountain-railway", "iso-desert-oasis", "iso-coastal-lighthouse", "iso-forest-workshop", "iso-arctic-research", "iso-river-market", "iso-sky-islands"];
const abstract = ["abstract-azure-arches", "abstract-pink-orbit", "abstract-violet-lattice", "abstract-crystalline", "abstract-tessellation", "abstract-fluid-topography", "abstract-paper-folds", "abstract-solar-rings", "abstract-kinetic-grid", "abstract-night-mosaic"];
const blueprints = ["blueprint-bran-castle", "blueprint-modern-pavilion", "blueprint-observatory", "blueprint-bridge", "blueprint-greenhouse", "blueprint-train-station", "blueprint-library", "blueprint-amphitheater", "blueprint-lighthouse", "blueprint-courtyard-house"];
const palettes = [
  ["#071a3d", "#0e6ca0", "#72d4ce", "#f2ca70", "#ec72a5"],
  ["#180d3d", "#5949aa", "#8bdde1", "#f1ca77", "#e75fa2"],
  ["#092b45", "#167e9d", "#70cda9", "#edb76a", "#db7498"],
  ["#101d46", "#416eb4", "#8ad9df", "#f0d17d", "#df68aa"],
  ["#17203e", "#3b5ba4", "#6ac8ba", "#f3c873", "#dc719a"],
];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const shift = (a, amount) => a.map((v) => Math.max(0, Math.min(255, Math.round(v + amount))));
const hash = (text) => [...text].reduce((v, char) => ((v * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
function rng(seed) { let v = seed >>> 0; return () => ((v = (v * 1664525 + 1013904223) >>> 0) / 4294967296); }

class Raster {
  constructor(colors, seed) {
    this.pixels = Buffer.alloc(W * H * 3);
    this.random = rng(seed);
    this.colors = colors.map(rgb);
    const [top, mid, bottom] = this.colors;
    for (let y = 0; y < H; y++) {
      const base = y < H * .58 ? mix(top, mid, y / (H * .58)) : mix(mid, bottom, (y - H * .58) / (H * .42));
      for (let x = 0; x < W; x++) {
        const wobble = Math.round(Math.sin(x / 80 + y / 95) * 3 + Math.sin(x / 27) * 2);
        const at = (y * W + x) * 3;
        this.pixels[at] = Math.max(0, base[0] + wobble);
        this.pixels[at + 1] = Math.max(0, base[1] + wobble);
        this.pixels[at + 2] = Math.max(0, base[2] + wobble);
      }
    }
  }
  pixel(x, y, color, alpha = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const at = (y * W + x) * 3;
    this.pixels[at] = Math.round(this.pixels[at] * (1 - alpha) + color[0] * alpha);
    this.pixels[at + 1] = Math.round(this.pixels[at + 1] * (1 - alpha) + color[1] * alpha);
    this.pixels[at + 2] = Math.round(this.pixels[at + 2] * (1 - alpha) + color[2] * alpha);
  }
  disc(cx, cy, radius, color, alpha = 1) {
    const r = Math.max(1, Math.round(radius));
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.pixel(cx + x, cy + y, color, alpha);
  }
  line(x1, y1, x2, y2, color, width = 1, alpha = 1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    for (let i = 0; i <= steps; i++) this.disc(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, width / 2, color, alpha);
  }
  poly(points, fill, alpha = 1, stroke = null, width = 1) {
    const ys = points.map((p) => p[1]); const minY = Math.max(0, Math.ceil(Math.min(...ys))), maxY = Math.min(H - 1, Math.floor(Math.max(...ys)));
    for (let y = minY; y <= maxY; y++) {
      const hits = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hits.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i < hits.length; i += 2) for (let x = Math.ceil(hits[i]); x <= Math.floor(hits[i + 1]); x++) this.pixel(x, y, fill, alpha);
    }
    if (stroke) for (let i = 0; i < points.length; i++) this.line(...points[i], ...points[(i + 1) % points.length], stroke, width, 1);
  }
  ring(cx, cy, radius, color, width = 2, alpha = 1, squash = 1) {
    const parts = Math.max(32, Math.ceil(radius * 1.7));
    let prev = [cx + radius, cy];
    for (let i = 1; i <= parts; i++) { const a = i * Math.PI * 2 / parts, next = [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * squash]; this.line(...prev, ...next, color, width, alpha); prev = next; }
  }
  write(id) {
    const ppm = path.join("/tmp", `${id}.ppm`), jpg = path.join(out, `${id}.jpg`);
    fs.writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), this.pixels]));
    execFileSync("convert", [ppm, "-strip", "-quality", "95", jpg], { stdio: "pipe" });
    fs.rmSync(ppm, { force: true });
  }
}
function choose(canvas) { return canvas.colors[2 + Math.floor(canvas.random() * 3) % 3]; }

/** Illustrated landscapes / landmarks / cityscapes with lots of small puzzle detail. */
function scenicArt(id, index, group) {
  const art = new Raster(palettes[index % palettes.length], hash(id));
  const r = art.random;
  const [ink, blue, mint, gold, pink] = art.colors;
  const sky = shift([255, 255, 255], -15);
  // Clouds, distant mountain layers, fields and water all provide distinct local texture.
  for (let i = 0; i < 38; i++) art.disc(40 + r() * (W - 80), 40 + r() * 360, 18 + r() * 68, sky, .08 + r() * .12);
  for (let layer = 0; layer < 4; layer++) {
    const y = 520 + layer * 92;
    const points = [[0, H], [0, y]];
    for (let x = 0; x <= W; x += 70) points.push([x, y - 70 - r() * (160 - layer * 18)]);
    points.push([W, H]);
    art.poly(points, layer % 2 ? shift(blue, -32) : shift(mint, -65), .84, shift(mint, 22), 2);
  }
  for (let i = 0; i < 250; i++) {
    const x = r() * W, y = 635 + r() * 540;
    art.line(x, y, x + 8 + r() * 30, y - 3 + r() * 8, i % 5 ? shift(mint, -45 + r() * 40) : gold, 1 + r() * 2, .35 + r() * .45);
  }
  if (group === "nature") {
    if (index === 0) { // beech forest
      for (let i = 0; i < 28; i++) { const x = 55 + i * 64 + r() * 26, base = 1040 - r() * 125, h = 320 + r() * 330; art.line(x, base, x + r() * 38 - 19, base - h, shift(gold, -95), 16 + r() * 16, .92); for (let k=0;k<11;k++) art.disc(x - 80 + r()*160, base-h+20+r()*210, 30+r()*70, shift(mint, -20+r()*30), .52); }
    } else if (index === 1) { // pelicans over delta water
      for (let y = 670; y < 1080; y += 22) art.line(40, y, W - 40, y + (r() - .5) * 12, shift([190,240,245],-20), 2, .48);
      for (let i=0;i<32;i++) { const x=90+r()*(W-180),y=570+r()*270; art.line(x-34,y,x,y-15,[255,255,255],5,.92);art.line(x,y-15,x+34,y,[255,255,255],5,.92);art.line(x-3,y-12,x+10,y+12,gold,2,.85); }
      for(let i=0;i<95;i++){const x=r()*W;art.line(x,880+r()*260,x,800+r()*150,shift(mint,-55),4,.78);}
    } else if (index === 2) { // deer small within the meadow
      for (let i=0;i<100;i++) art.disc(r()*W, 700+r()*330, 3+r()*13, i%3?pink:gold,.48);
      const x=980,y=780; art.poly([[x-90,y],[x+80,y-10],[x+104,y+55],[x-100,y+54]],shift(gold,-70),.96,ink,4);art.line(x-62,y+48,x-72,y+145,ink,9);art.line(x+53,y+45,x+65,y+142,ink,9);art.line(x+75,y-4,x+104,y-66,ink,7);art.line(x+102,y-67,x+120,y-112,ink,4);art.line(x+105,y-67,x+139,y-96,ink,4);
    } else if (index === 3) { // poppy field
      for (let i=0;i<310;i++) { const x=r()*W,y=620+r()*440; art.line(x,y,x+(r()-.5)*8,y-23-r()*35,shift(mint,-58),2,.85); art.disc(x+(r()-.5)*8,y-23-r()*35,6+r()*12,pink,.88); }
    } else { // ice cave
      art.poly([[0,260],[220,80],[480,200],[710,70],[900,190],[1120,55],[1470,180],[1800,90],[1800,1200],[0,1200]],shift(blue,-28),.83,mint,3);
      for(let i=0;i<135;i++){const x=r()*W,y=80+r()*890,len=25+r()*180;art.poly([[x,y],[x+12+r()*25,y+len],[x-10-r()*25,y+len]],i%2?mint:sky,.25+r()*.35,mint,1);}
      art.ring(905,670,255,sky,9,.48,.75);art.ring(905,670,160,mint,7,.7,.75);
    }
  } else {
    // Architectural / urban facades, repeatedly detailed with roof, windows and lamps.
    const count = group === "cities" ? 15 : 7;
    for (let i = 0; i < count; i++) {
      const bw = 85 + r() * 105, bh = 190 + r() * 300, x = 45 + i * (W - 90) / count + r() * 28, y = 855 - bh;
      const facade = i % 3 === 0 ? pink : i % 3 === 1 ? gold : mint;
      art.poly([[x,y],[x+bw,y-30],[x+bw,y+bh-30],[x,y+bh]],facade,.79,ink,4);
      art.poly([[x-12,y],[x+bw+12,y-35],[x+bw*.5,y-94]],shift(facade,42),.88,ink,3);
      for(let row=0;row<Math.floor(bh/43);row++) for(let col=0;col<3;col++){const wx=x+16+col*(bw-28)/3,wy=y+25+row*43;art.poly([[wx,wy],[wx+15,wy-5],[wx+15,wy+20],[wx,wy+25]],ink,.75,gold,1);}
    }
    if (group === "landmarks") {
      const x = 900, y = 810, motif = index;
      if (motif === 0 || motif === 2) { // castles
        art.poly([[x-225,y],[x-185,y-400],[x-85,y-400],[x-60,y],[x+35,y],[x+75,y-520],[x+190,y-520],[x+235,y]],shift(gold,-38),.96,ink,5); for(const tx of [x-135,x+130]){art.poly([[tx-76,y-400],[tx+76,y-400],[tx,y-530]],pink,.95,ink,4);} art.line(x-285,y,x+275,y,ink,12);
      } else if (motif === 1) { // Parliament-like symmetric colonnade
        art.poly([[x-370,y],[x-320,y-360],[x+320,y-360],[x+370,y]],shift(gold,-24),.93,ink,5);for(let i=0;i<13;i++){const cx=x-275+i*46;art.line(cx,y-18,cx,y-297,ink,13,.88);art.line(cx+10,y-18,cx+10,y-297,gold,5,.75);}art.poly([[x-420,y-360],[x+420,y-360],[x,y-470]],pink,.86,ink,5);
      } else if (motif === 3) { // clock tower
        art.poly([[x-82,y],[x-62,y-530],[x+62,y-530],[x+82,y]],shift(gold,-36),.96,ink,5);art.poly([[x-115,y-530],[x+115,y-530],[x,y-690]],pink,.95,ink,5);art.ring(x,y-365,58,sky,8,.95);art.line(x,y-365,x+27,y-398,sky,6,.95);art.line(x,y-365,x-20,y-330,sky,6,.95);
      } else { // wooden church
        art.poly([[x-125,y],[x-95,y-410],[x+95,y-410],[x+125,y]],shift(gold,-75),.98,ink,5);art.poly([[x-148,y-410],[x+148,y-410],[x,y-600]],shift(pink,-20),.9,ink,5);art.line(x,y-410,x,y-730,shift(gold,34),14);art.line(x-55,y-630,x+55,y-630,shift(gold,34),12);
      }
    }
  }
  for (let i=0;i<90;i++) art.disc(r()*W, 450+r()*590, .6+r()*2.1, [255,255,255], .18+r()*.38);
  art.write(id);
}

function isometricArt(id, index) {
  const art = new Raster(palettes[index % palettes.length], hash(id)); const r = art.random, [ink, blue, mint, gold, pink] = art.colors;
  const p = (x, y, z = 0) => [900 + (x - y) * 1.12, 675 + (x + y) * .56 - z];
  for (let i = 0; i < 185; i++) art.disc(r() * W, r() * 560, .7 + r() * 2.6, [255,255,255], .12 + r() * .58);
  for (let x = -690; x < 690; x += 70) for (let y = -360; y < 360; y += 70) {
    const q = [[x,y],[x+67,y],[x+67,y+67],[x,y+67]].map(([a,b]) => p(a,b)); art.poly(q, ((x+y)/70%2 ? mint : ink), .16, shift([220,255,255], 0), 1);
  }
  for (let i = 0; i < 32; i++) {
    const x=-530+r()*1060,y=-290+r()*580,s=27+r()*58,h=28+r()*122;
    const a=p(x-s,y-s),b=p(x+s,y-s),c=p(x+s,y+s),d=p(x-s,y+s),at=p(x-s,y-s,h),bt=p(x+s,y-s,h),ct=p(x+s,y+s,h),dt=p(x-s,y+s,h);
    art.poly([a,b,c,d],gold,.35,shift(gold,35),2); art.poly([at,bt,ct,dt],choose(art),.92,shift([255,255,255],0),1); art.poly([a,b,bt,at],ink,.76); art.poly([b,c,ct,bt],mint,.52);
    if (i%2===0) { const [tx,ty]=p(x,y,h+35); art.poly([[tx,ty-42],[tx-29,ty+46],[tx+29,ty+46]],shift(mint,45),.95,shift([255,255,255],0),1); art.line(tx,ty+42,tx,ty+75,shift(pink,-65),8); }
  }
  const [x,y]=p(0,0,95), motif=index%5;
  if(motif===0){art.poly([[x-65,y+150],[x-35,y-106],[x+35,y-106],[x+65,y+150]],shift([255,255,255],-12),.95,ink,4);art.poly([[x-80,y-106],[x+80,y-106],[x,y-180]],pink,.95,ink,4);art.disc(x,y-54,19,gold);}
  if(motif===1){art.ring(x,y+84,152,mint,5,.95,.48);art.ring(x,y+84,91,[255,255,255],3,.85,.48);art.ring(x,y+40,92,mint,6,.94,.48);}
  if(motif===2){let prev=[x-340,y+190];for(let i=1;i<=120;i++){const t=i/120,next=[x-340+680*t,y+190-190*Math.sin(t*Math.PI*1.55)];art.line(...prev,...next,gold,18,.95);art.line(...prev,...next,ink,4,.85);prev=next;}}
  if(motif===3){art.poly([[x-210,y+160],[x-72,y-135],[x+44,y+125],[x+178,y-95],[x+255,y+160]],shift(mint,55),.94,[255,255,255],3);art.ring(x,y-8,60,pink,10,.94);}
  if(motif===4){art.poly([[x,y-175],[x+157,y-68],[x+100,y+112],[x-100,y+112],[x-157,y-68]],pink,.9,[255,255,255],3);art.disc(x,y-30,52,gold,.95);}
  art.write(id);
}
function abstractArt(id,index) {
  const art=new Raster(palettes[index%palettes.length],hash(id)),r=art.random,[ink,blue,mint,gold,pink]=art.colors;
  for(let i=0;i<70;i++) art.ring(r()*W,r()*H,70+r()*420,choose(art),20+r()*60,.05,.45+r()*.6);
  for(let x=-120;x<W+130;x+=52) art.line(x,0,x+190,H,[230,255,255],2,.09);
  for(let y=0;y<H+100;y+=52) art.line(0,y,W,y-135,[230,255,255],2,.08);
  for(let i=0;i<64;i++){const cx=70+r()*(W-140),cy=70+r()*(H-140),rad=32+r()*162,sides=3+Math.floor(r()*5),rot=r()*6.28,pts=[];for(let j=0;j<sides;j++)pts.push([cx+Math.cos(rot+j*6.28/sides)*rad,cy+Math.sin(rot+j*6.28/sides)*rad]);art.poly(pts,choose(art),.18+r()*.27,[255,255,255],1+r()*3);}
  for(let i=0;i<28;i++)art.ring(100+r()*(W-200),100+r()*(H-200),40+r()*230,choose(art),2+r()*7,.68,.35+r()*.5);
  for(let radius=65;radius<590;radius+=43){const steps=96;let last=[900-radius,600];for(let i=1;i<=steps;i++){const a=Math.PI+i*Math.PI/steps,next=[900+Math.cos(a)*radius,600+Math.sin(a)*radius*.72];art.line(...last,...next,radius%86?mint:pink,8,.74);last=next;}}
  for(let i=0;i<260;i++)art.disc(r()*W,r()*H,.7+r()*3,[255,255,255],.12+r()*.65);
  art.write(id);
}
function blueprintArt(id,index) {
  const art=new Raster(palettes[index%palettes.length],hash(id)),r=art.random,[ink,blue,mint,gold]=art.colors;
  for(let x=0;x<=W;x+=30)art.line(x,0,x,H,[200,255,255],x%150?1:2,x%150?.07:.21);
  for(let y=0;y<=H;y+=30)art.line(0,y,W,y,[200,255,255],y%150?1:2,y%150?.07:.21);
  const p=(x,y,z=0)=>[900+(x-y),605+(x+y)*.5-z];
  for(let level=0;level<5;level++){const s=400-level*48,z=level*54;art.poly([p(-s,-s,z),p(s,-s,z),p(s,s,z),p(-s,s,z)],level%2?blue:ink,.32,mint,4);}
  const a=p(-255,-255),b=p(255,-255),c=p(255,255),d=p(-255,255),at=p(-255,-255,310),bt=p(255,-255,310),ct=p(255,255,310),dt=p(-255,255,310);
  art.poly([a,b,bt,at],blue,.3,mint,4);art.poly([b,c,ct,bt],blue,.43,mint,4);art.poly([at,bt,ct,dt],ink,.4,mint,5);
  for(let i=0;i<20;i++){const [x,y]=p(-205+(i%5)*103,-185+Math.floor(i/5)*125,100+(i%3)*45);art.line(x-36,y+48,x-36,y-48,gold,3,.86);art.line(x-36,y-48,x+36,y-48,gold,3,.86);art.line(x+36,y-48,x+36,y+48,gold,3,.86);}
  [[270,235],[1530,235],[270,950],[1530,950]].forEach(([x,y],i)=>{for(let rad=40;rad<155;rad+=27)art.ring(x,y,rad,i%2?gold:mint,2,.65);for(let a=0;a<8;a++)art.line(x,y,x+Math.cos(a*.785)*155,y+Math.sin(a*.785)*155,mint,2,.5);});
  // A distinct unlabeled architectural focus for each blueprint subject.
  const focus = index % 10;
  if (focus === 0) { // castle: towers and a crenellated ridge
    for (const dx of [-150, 0, 150]) { art.poly([[900+dx-38,470],[900+dx-25,330],[900+dx+25,330],[900+dx+38,470]], blue,.38,mint,4); art.poly([[900+dx-48,330],[900+dx+48,330],[900+dx,265]], gold,.34,mint,3); }
  } else if (focus === 1) { // pavilion: folded roof planes
    art.poly([[690,550],[900,355],[1110,550],[900,660]], blue,.34,gold,4); art.poly([[690,550],[900,660],[900,850]], mint,.2,gold,3); art.poly([[1110,550],[900,660],[900,850]], ink,.26,gold,3);
  } else if (focus === 2) { // observatory: concentric dome
    art.ring(900,530,154,mint,7,.85,.56); art.ring(900,530,105,gold,4,.85,.56); art.line(746,530,1054,530,mint,4,.85);
  } else if (focus === 3) { // bridge: deck and suspension cables
    art.line(570,690,1230,690,gold,11,.88); for (const dx of [650,1150]) { art.line(dx,720,dx,340,mint,7,.9); for (let j=0;j<8;j++) art.line(dx,350+j*42,900,690,mint,2,.65); }
  } else if (focus === 4) { // greenhouse: repeated glass arches
    for (let i=0;i<8;i++) { const x=585+i*90; art.ring(x,625,75,mint,4,.8,.75); art.line(x-75,625,x-75,800,mint,3,.75); art.line(x+75,625,x+75,800,mint,3,.75); }
  } else if (focus === 5) { // station: rails and roof trusses
    for (const dx of [-145,-55,55,145]) art.line(900+dx,850,900+dx*.4,325,gold,5,.82); for(let y=400;y<800;y+=62)art.line(700,y,1100,y,mint,3,.65);
  } else if (focus === 6) { // library: stacked shelf bays
    for(let row=0;row<5;row++) for(let col=0;col<8;col++){const x=640+col*66,y=390+row*78;art.poly([[x,y],[x+48,y-18],[x+48,y+35],[x,y+53]],row%2?gold:mint,.5,ink,2);}
  } else if (focus === 7) { // amphitheater: nested seating arcs
    for(let radius=90;radius<360;radius+=47){const steps=72;let prior=[900-radius,760];for(let j=1;j<=steps;j++){const theta=Math.PI+j*Math.PI/steps,next=[900+Math.cos(theta)*radius,760+Math.sin(theta)*radius*.48];art.line(...prior,...next,j%2?mint:gold,5,.78);prior=next;}}
  } else if (focus === 8) { // lighthouse: vertical section
    art.poly([[850,825],[870,310],[930,310],[950,825]], blue,.35,mint,5); art.poly([[842,310],[958,310],[900,220]], gold,.45,mint,4); for(let y=385;y<760;y+=70)art.line(865,y,935,y,gold,3,.8);
  } else { // courtyard: square plan with inner void
    art.poly([[635,420],[1165,420],[1165,850],[635,850]], blue,.23,mint,5); art.poly([[770,525],[1030,525],[1030,745],[770,745]], ink,.8,gold,5); for(let i=0;i<8;i++)art.ring(900,635,46+i*24,mint,2,.42,.72);
  }
  for(let i=0;i<45;i++){const x=r()*W,y=r()*H,a=r()*6.28,len=30+r()*150;art.line(x,y,x+Math.cos(a)*len,y+Math.sin(a)*len,gold,2,.43);}
  art.write(id);
}
for (const [index,id] of proceduralNature.entries()) scenicArt(id,index + 4,"nature");
for (const [index,id] of cities.entries()) scenicArt(id,index + 2,"cities");
for (const [index,id] of isometric.entries()) isometricArt(id,index);
for (const [index,id] of abstract.entries()) abstractArt(id,index);
for (const [index,id] of blueprints.entries()) blueprintArt(id,index);
console.log(`Generated ${proceduralNature.length + cities.length + isometric.length + abstract.length + blueprints.length} original procedural Stage 5 sources.`);
