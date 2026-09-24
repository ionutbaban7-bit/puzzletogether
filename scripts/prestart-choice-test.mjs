import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import WebSocket from 'ws';
const data=mkdtempSync(path.join(os.tmpdir(),'pt-prestart-')),port=3122,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:data,NODE_ENV:'test'},stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function post(url,body){const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
async function member(room,id){return new Promise((resolve,reject)=>{const ws=new WebSocket(base.replace(/^http/,'ws')+'/ws');const messages=[],waiters=[];ws.on('open',()=>ws.send(JSON.stringify({t:'hello',v:2,roomId:room,playerId:id})));ws.on('message',b=>{const m=JSON.parse(b);const i=waiters.findIndex(w=>w.t===m.t&&w.p(m));i<0?messages.push(m):waiters.splice(i,1)[0].resolve(m)});ws.on('error',reject);ws.wait=(t,p=()=>true)=>new Promise((resolve,reject)=>{const i=messages.findIndex(m=>m.t===t&&p(m));if(i>=0)return resolve(messages.splice(i,1)[0]);const timer=setTimeout(()=>reject(new Error('timeout '+t)),3000);waiters.push({t,p,resolve:m=>{clearTimeout(timer);resolve(m)}})});resolve(ws)});}
try{
 let ready=false;for(let i=0;i<50;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break}catch{}await pause(100)}assert(ready);
 const a=await post('/api/rooms',{puzzleId:'mona-lisa',difficulty:'hard',mystery:true,name:'Gazdă'});assert.equal(a.status,200);
 const room=a.data.room,join=await post(`/api/rooms/${room.id}/join`,{name:'Prieten',code:room.code});assert.equal(join.status,200);
 const host=await member(room.id,a.data.playerId),guest=await member(room.id,join.data.playerId);await host.wait('init');await guest.wait('init');
 const denied=await post(`/api/rooms/${room.id}/puzzle`,{pid:join.data.playerId,puzzleId:'great-wave',difficulty:'easy',mystery:false});assert.equal(denied.status,403);
 const changed=await post(`/api/rooms/${room.id}/puzzle`,{pid:a.data.playerId,puzzleId:'great-wave',difficulty:'master',mystery:false});assert.equal(changed.status,200);
 const event=await guest.wait('puzzle',m=>m.room.puzzleId==='great-wave');assert.equal(event.room.stage,'lobby');assert.equal(event.room.startedAt,null);assert.equal(event.room.total,192);assert.equal(event.puzzle.mystery,undefined);
 const lobby=await (await fetch(base+`/api/rooms/${room.id}`)).json();assert.equal(lobby.playerCount,2);assert.equal(lobby.room.code,undefined);
 host.send(JSON.stringify({t:'control',action:'start'}));const started=await guest.wait('room',m=>m.room.stage==='play');assert.equal(started.room.total,192);assert.ok(started.room.startedAt);
 host.close();guest.close();console.log('PASS host/guest room code, guest denial, live lobby rechoice, 192 pieces, mystery toggle, retained members, clock starts on Start');
}finally{server.kill();rmSync(data,{recursive:true,force:true})}
