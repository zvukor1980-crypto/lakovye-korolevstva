/** Register immediately: boot may finish after window.load. Never clear saved games. */
export function startUpdates(version, {status=()=>{}, beforeReload=async()=>{}}={}) {
 let registration, checking, lastCheck=0, reloading=false;
 const sw=navigator.serviceWorker;
 let controlled=!!sw?.controller;
 async function reload(){if(reloading)return;reloading=true;try{await beforeReload();location.reload();}catch(e){reloading=false;status(e.message||"Не удалось сохранить игру. Перезапуск отменён.");}}
 function show(reg){
  if(document.getElementById('upd'))return;
  const el=document.createElement('div');el.id='upd';el.className='banner';
  el.innerHTML='<div class="card"><b>Доступна новая версия</b><p class="muted">Установим обновление и перезапустим игру.</p><button class="btn primary" id="upd-btn">Обновить игру</button><p id="upd-state" role="status"></p></div>';
  document.body.appendChild(el);
  document.getElementById('upd-btn').onclick=async()=>{
   const button=document.getElementById('upd-btn'),label=document.getElementById('upd-state');button.disabled=true;label.textContent='Загружаем файлы…';
   try{
    await beforeReload();await reg.update();
    let worker=reg.waiting||reg.installing;
    if(worker&&worker.state!=='installed'&&worker.state!=='activated')await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{worker.removeEventListener('statechange',changed);reject(Error('Загрузка занимает больше времени. Попробуйте снова.'));},45000);
      function changed(){if(worker.state==='installed'||worker.state==='activated'){clearTimeout(timeout);worker.removeEventListener('statechange',changed);resolve();}else if(worker.state==='redundant'){clearTimeout(timeout);worker.removeEventListener('statechange',changed);reject(Error('Не удалось загрузить обновление. Проверьте интернет.'));}}
      worker.addEventListener('statechange',changed);changed();
    });
    worker=reg.waiting||worker;
    if(worker&&worker.state==='installed')worker.postMessage({type:'SKIP_WAITING'});
    else await reload();
   }catch(e){label.textContent=e.message||'Нет связи. Попробуйте снова.';button.disabled=false;}
  };
 }
 async function check(manual=false){
  if(checking)return checking;if(!manual&&Date.now()-lastCheck<60000)return;
  lastCheck=Date.now();
  checking=(async()=>{
   try{
    if(!sw){status('Автообновление недоступно в этом браузере.');return;}
    if(!registration){
     registration=await sw.register('./sw.js',{updateViaCache:'none'});
     registration.addEventListener('updatefound',()=>{const w=registration.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&sw.controller)show(registration);});});
    }
    await registration.update();
    if(registration.waiting){show(registration);return;}
    const response=await fetch('./version.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('offline');
    const remote=await response.json();
    if(remote.version&&remote.version!==version)show(registration);
    else if(manual)status('Установлена версия '+version+'. Обновлений нет.');
   }catch{if(manual)status('Не удалось проверить обновление. Проверьте интернет.');}
  })().finally(()=>{checking=null;});return checking;
 }
 if(sw)sw.addEventListener('controllerchange',()=>{if(!controlled){controlled=true;return;}if(registration)return reload();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
 window.addEventListener('online',()=>check(true));
 check();return check;
}
