import {CREATURES,ERAS,ROSTER,CLASSES,eraArt} from './data.js';
export function eraId(id,era=0) {
 const base=String(id).split('@')[0];
 return era && CREATURES[base+'@'+era] ? base+'@'+era : base;
}
export function syncEra(state,playerId) {
 const p=state.players.find(p=>p.id===playerId);if(!p)return;
 const era=p.era||0;
 const army=a=>{for(const sl of a||[])if(sl)sl.id=eraId(sl.id,era);};
 for(const h of state.heroes.filter(h=>h.player===p.id)) {
  army(h.army); const list=ROSTER.filter(r=>CLASSES[r.classId].faction===h.faction);
  h.portrait=eraArt(h.faction,era,Math.max(0,list.findIndex(r=>r.id===h.rosterId))%3);
 }
 for(const t of state.towns.filter(t=>t.owner===p.id))army(t.garrison);
}
export function eraStatus(state,town) {
 const p=state.players.find(p=>p.id===town.owner), current=p?.era||0, next=ERAS[current+1];
 if(!next)return {current,next:null,ready:false,reasons:[]};
 const reasons=[];
 if(state.current!==p.id)reasons.push('Дождитесь своего хода');
 if(state.battle)reasons.push('Сначала завершите бой');
 if(state.day<next.day)reasons.push('Доступно с '+next.day+' дня');
 if(town.builtToday)reasons.push('Сегодня строительство уже использовано');
 for(const id of next.req)if(!town.buildings[id])reasons.push('building:'+id);
 for(const [k,v] of Object.entries(next.cost))if((p.resources[k]||0)<v)reasons.push('resource:'+k+':'+(v-(p.resources[k]||0)));
 return {current,next,ready:!reasons.length,reasons};
}
export function researchEra(state,townId) {
 const town=state.towns.find(t=>String(t.id)===String(townId));
 if(!town)return {ok:false,error:'Город не найден.'};
 const status=eraStatus(state,town);if(!status.ready)return {ok:false,error:'Условия перехода ещё не выполнены.'};
 const p=state.players.find(p=>p.id===town.owner);
 for(const [k,v] of Object.entries(status.next.cost))p.resources[k]-=v;
 p.era=status.next.id;town.builtToday=true;syncEra(state,p.id);
 const message=p.name+': наступает '+status.next.name+'!';
 state.log.push({day:state.day,text:message});return {ok:true,message};
}
