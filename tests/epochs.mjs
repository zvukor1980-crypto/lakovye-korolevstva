import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {FACTION_ORDER,ERAS,CREATURES,SKIRMISH,tiersOf,eraArt} from '../js/data.js';
import {createGame,makeSkirmish,recruit,serialize,deserialize,aiAct} from '../js/engine.js';
import {researchEra,eraStatus,eraId,initializeEra} from '../js/epochs.js';
import {hallHTML,recruitHTML,shopHTML,skirmishHTML} from '../js/ui.js';
for(const faction of FACTION_ORDER){
 const spec=makeSkirmish({map:SKIRMISH.find(m=>m.players===4),faction});
 assert.equal(new Set(spec.players.map(p=>p.faction)).size,4);
 const s=createGame(spec),p=s.players[0],t=s.towns.find(t=>t.owner===0);
 assert.equal(tiersOf(faction).length,7);
 assert.equal(s.heroes.find(h=>h.player===0).faction,faction);
 assert(!researchEra(s,t.id).ok);
 for(const era of [1,2]){
  s.day=ERAS[era].day;t.builtToday=false;
  for(const id of ERAS[era].req)t.buildings[id]=true;
  for(const k of Object.keys(p.resources))p.resources[k]=100000;
  assert(eraStatus(s,t).ready);assert(researchEra(s,t.id).ok);assert.equal(p.era,era);
  assert(!researchEra(s,t.id).ok,'no second research on same day');
  for(const h of s.heroes.filter(h=>h.player===0))for(const unit of h.army.filter(Boolean))assert.equal(CREATURES[unit.id].era,era);
  const base=tiersOf(faction)[0];t.pool[base.id]=100;
  assert(recruit(s,t.id,base.id,1,'garrison').ok);
  assert(t.garrison.some(u=>u?.id===eraId(base.id,era)));
  assert(hallHTML(s,t.id).includes(ERAS[era].name));
  assert(recruitHTML(s,t.id,'dw1').includes('@'+era));
  assert(shopHTML(s).includes('@'+era));
  const loaded=deserialize(serialize(s));assert.equal(loaded.players[0].era,era);assert.equal(loaded.heroes[0].portrait,s.heroes[0].portrait);
 }
 const other=s.players[1],ot=s.towns.find(t=>t.owner===1);s.current=1;ot.builtToday=false;s.day=30;
 Object.assign(ot.buildings,{townHall:true,blacksmith:true});for(const k of Object.keys(other.resources))other.resources[k]=100000;
 assert.equal(aiAct(s).type,'research');
 for(let era=0;era<3;era++)for(let role=0;role<3;role++)assert(existsSync(eraArt(faction,era,role)));
}
assert.equal((skirmishHTML().match(/name="faction-choice"/g)||[]).length,4);
console.log('PASS: four distinct opponents, all faction starts, both era transitions, army conversion, recruitment, saves, AI research, UI and 36 assets');
const {createBattle,startFight,prepareTurn,currentStack,chooseAiAction,act,reachable}=await import('../js/combat.js');
for(const faction of FACTION_ORDER)for(const era of [0,1,2]){
 const troop=eraId(tiersOf(faction)[1].id,era);
 const b=createBattle({seed:71,attacker:{stacks:[{cr:troop,count:15}],ai:true},defender:{stacks:[{cr:eraId('s_page',era),count:25}],ai:true}});
 startFight(b);let n=0;while(!b.result&&n++<1500){prepareTurn(b);if(currentStack(b))assert(act(b,chooseAiAction(b)).ok);}
 assert(b.result,'era battle terminates');
}
const b=createBattle({seed:2,attacker:{stacks:[{cr:'s_griff',count:1}]},defender:{stacks:[{cr:'e_bow',count:1}]}});
assert(reachable(b,b.stacks[0]).flying,'natural flying trait is respected');
console.log('PASS: 12 era/faction battles and natural flight');

for(const era of [0,1,2]){
 const s=createGame(makeSkirmish({map:SKIRMISH[0],faction:'scarlet'}));initializeEra(s,era);
 assert(s.players.every(p=>p.era===era));
 for(const h of s.heroes){assert(h.portrait.includes(era===2?'modern-v3':'epochs'));for(const slot of h.army.filter(Boolean))assert.equal(CREATURES[slot.id].era||0,era);}
 assert.equal(s.day,ERAS[era].day);
 const loaded=deserialize(serialize(s));assert.equal(loaded.players[0].era,era);
}
console.log('PASS: all starting eras convert both sides and survive save/load');

// The school must grow the troop it advertises, including after save/load.
const {growTown}=await import('../js/engine.js');
const {townHTML}=await import('../js/ui.js');
const solar=createGame(makeSkirmish({map:SKIRMISH[0],faction:'inca'}));
const solarTown=solar.towns.find(t=>t.owner===0);
Object.assign(solarTown.buildings,{dw3:true,dw4:true});
growTown(solarTown,true);const ordinary={...solarTown.pool};
solarTown.buildings.horde=true;growTown(solarTown,true);
const solarTiers=tiersOf('inca');
assert.equal(solarTown.pool[solarTiers[2].id]-ordinary[solarTiers[2].id],solarTiers[2].growth);
assert.equal(solarTown.pool[solarTiers[3].id],ordinary[solarTiers[3].id]);
const solarMarkup=townHTML(deserialize(serialize(solar)),solarTown.id);
assert(solarMarkup.includes('sun-court'));
assert(solarMarkup.includes('art/world-v4/temple.webp'));
assert(!solarMarkup.includes('art/sprites/castle-emerald.webp'));
console.log('PASS: solar school grows the advertised rank; solar city uses temple artwork after save/load');
