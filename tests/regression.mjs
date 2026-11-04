import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {hexNeighbors,hexDist,createBattle,startFight,prepareTurn,currentStack,chooseAiAction,act,reachable} from '../js/combat.js';
import {writeSave,readSave,listSaves} from '../js/save.js';
for(let c=1;c<14;c++)for(let r=1;r<10;r++)for(const [nc,nr] of hexNeighbors(c,r)){
 assert.equal(hexDist(c,r,nc,nr),1);
 assert(hexNeighbors(nc,nr).some(([x,y])=>x===c&&y===r));
 const pos=(c,r)=>[Math.sqrt(3)*(r+.5*(c&1)),1.5*(14-c)];
 const a=pos(c,r),b=pos(nc,nr);assert(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-Math.sqrt(3))<1e-9);
}
for(let seed=1;seed<=20;seed++){
 const b=createBattle({seed,attacker:{stacks:[{cr:'s_page',count:20}],ai:true},defender:{stacks:[{cr:'e_bow',count:10}],ai:true}});
 startFight(b);let n=0;
 while(!b.result&&n++<1000){prepareTurn(b);if(!currentStack(b))continue;assert.equal(act(b,chooseAiAction(b)).ok,true);}
 assert(b.result,'battle must terminate');
}
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const paths=[...sw.matchAll(/"\.\/([^"\n]+)"/g)].map(x=>x[1]);
for(const p of paths)assert(existsSync(new URL('../'+p,import.meta.url)),`missing precache ${p}`);
globalThis.localStorage={getItem(){return this.v||null},setItem(k,v){this.v=v}};
await writeSave('1',{data:{day:4}});assert.equal((await readSave('1')).data.day,4);assert.equal((await listSaves()).length,1);
globalThis.localStorage.setItem=()=>{throw Error('quota')};
await assert.rejects(writeSave('2',{}),/Не удалось/);
console.log('PASS: hex geometry, 20 simulated battles, precache files, save fallback and failure reporting');

const flight=createBattle({seed:1,attacker:{stacks:[{cr:'s_page',count:1}]},defender:{stacks:[{cr:'e_bow',count:1}]}});
const flyer=flight.stacks[0];flyer.c=5;flyer.r=5;flyer.buffs.fly={t:40,v:1};flight.obstacles={};
for(const [c,r] of hexNeighbors(5,5)) flight.obstacles[`${c},${r}`]='wall';
const reach=reachable(flight,flyer);
assert(reach.dist.has('7,5'),'flight crosses surrounding walls');
for(const key of Object.keys(flight.obstacles))assert(!reach.dist.has(key),'cannot land on wall');
console.log('PASS: flight crosses walls without landing inside them');
