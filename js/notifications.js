/* Notifications du bureau : lecture propre à chaque compte. */
(async function(){
 const box=document.createElement("section");box.id="notifications";box.hidden=true;
 box.style.cssText="max-width:1100px;margin:1rem auto;padding:1rem;background:white;border:1px solid #bedcda;border-radius:16px;scroll-margin-top:100px";
 document.getElementById("contenu").before(box);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let rows=[],busy=false,user;
 async function badge(n){
 try{if(navigator.setAppBadge){if(n)await navigator.setAppBadge(n);else await navigator.clearAppBadge();}}catch{}
 try{const reg=await navigator.serviceWorker.ready;const shown=await reg.getNotifications();const unread=new Set(rows.filter(n=>!n.read_at).map(n=>n.id));for(const n of shown){if(n.data?.notificationId&&!unread.has(n.data.notificationId))n.close();if(!n.data?.notificationId&&n.data?.url?.includes("#notifications")&&!nCount)n.close();}}catch{}
 }
 let nCount=0;
 async function refresh(){
 if(busy||!sb)return;busy=true;
 try{
 const {data:auth}=await sb.auth.getUser();if(!auth.user){box.hidden=true;return;}user=auth.user;
 const {data:p,error:pe}=await sb.from("profils").select("role,acces_suspendu").eq("id",user.id).single();
 if(pe||p?.role!=="bureau"||p.acces_suspendu){box.hidden=true;return;}
 box.hidden=false;
 const {data,error}=await sb.from("bureau_notifications").select("*").order("created_at",{ascending:false}).limit(100);
 const {count,error:ce}=await sb.from("bureau_notifications").select("id",{count:"exact",head:true}).is("read_at",null);
 if(error||ce)throw error||ce;
 rows=data||[];nCount=count||0;
 box.innerHTML='<h2 style="margin:0">Notifications <span style="background:#087e88;color:white;border-radius:20px;padding:0.1rem 0.6rem">'+nCount+'</span></h2><p>Vos alertes de messages et d’inscriptions. Le compteur indique vos notifications non lues.</p><button type="button" data-all>Toutes marquer comme lues</button><p role="status" data-status></p><div>'+(
 rows.length?rows.map(n=>'<article style="padding:0.8rem;margin-top:0.6rem;border-left:4px solid '+(n.read_at?'#ccc':'#087e88')+';background:#f5faf9"><strong>'+esc(n.title)+'</strong> <span>'+ (n.read_at?'Lue':'Non lue')+'</span><p>'+esc(n.body)+'</p><small>'+esc(new Date(n.created_at).toLocaleString("fr-FR",{timeZone:"Pacific/Tahiti"}))+'</small><div style="margin-top:0.5rem"><button type="button" data-open="'+n.id+'">'+(n.kind==='test'?'Lire le test':'Consulter')+'</button> '+(!n.read_at?'<button type="button" data-read="'+n.id+'">Marquer comme lue</button>':'')+'</div></article>').join(''):'<p>Aucune notification pour le moment. Les nouvelles alertes apparaîtront ici.</p>')+'</div><small>Les 100 dernières notifications sont affichées.</small>';
 await badge(nCount);
 }catch{box.hidden=false;box.innerHTML='<h2>Notifications</h2><p role="alert">Impossible de charger les notifications. Réessayez en rechargeant la page.</p>';}finally{busy=false;}
 }
 async function mark(id){
 let q=sb.from("bureau_notifications").update({read_at:new Date().toISOString()}).eq("user_id",user.id).is("read_at",null);
 if(id)q=q.eq("id",id);
 const {error}=await q;if(error)throw error;
 }
 box.addEventListener("click",async e=>{
 const b=e.target.closest("button");if(!b)return;b.disabled=true;
 try{
 if(b.hasAttribute("data-all")){await mark();await refresh();return;}
 const id=b.dataset.open||b.dataset.read,n=rows.find(n=>n.id===id);if(!n)return;
 await mark(id);await refresh();
 if(b.dataset.open&&n.kind!=="test"){
 const section=n.kind==="contact"?"admin-messages":"admin-adherents";
 location.href="admin.html?alerte="+encodeURIComponent(n.kind)+"&cible="+encodeURIComponent(n.target_id)+"#"+section;
 }
 }catch{const s=box.querySelector("[data-status]");if(s)s.textContent="La lecture n’a pas pu être enregistrée. Réessayez.";b.disabled=false;}
 });
 function focusTarget(){
 const q=new URLSearchParams(location.search),kind=q.get("alerte"),id=q.get("cible");if(!/^[0-9a-f-]{36}$/i.test(id||""))return false;
 const el=document.getElementById((kind==="contact"?"contact-":"profil-")+id);if(!el)return false;
 let parent=el.parentElement;while(parent){if(parent.tagName==="DETAILS")parent.open=true;parent=parent.parentElement;}
 el.style.outline="3px solid #e8a23c";el.scrollIntoView({block:"center",behavior:"smooth"});return true;
 }
 let tries=0;const targetTimer=setInterval(()=>{if(focusTarget()||++tries>30)clearInterval(targetTimer);},500);
 await refresh();if(location.hash==="#notifications")box.scrollIntoView();
 setInterval(()=>{if(!document.hidden)refresh();},30000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
})();