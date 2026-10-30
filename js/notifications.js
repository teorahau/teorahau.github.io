/* Cloche et notifications du bureau. Lecture propre à chaque compte. */
(function () {
  if (window.TOH_BELL_STARTED) return;
  window.TOH_BELL_STARTED = true;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const labels = {contact:"Message de contact",inscription:"Nouvelle inscription",forum:"Message sur le forum",annonce:"Nouvelle annonce",test:"Test des notifications"};
  const symbols = {annonce:"A",contact:"✉",inscription:"+",forum:"💬",test:"✓"};
  let rows = [], count = 0, user = null, busy = false, filter = "all", limit = 100;
  let bell, panel, counter, opened = false, mounted = false;
  const style = document.createElement("style");
  style.textContent = `
    #toh-header .brand>span:last-child{min-width:0}#toh-header .brand .logo{flex:0 0 48px}\n    .toh-bell-wrap{display:flex;align-items:center;flex-shrink:0;margin-left:auto;margin-right:10px}
    .menu .toh-bell-wrap{margin:0 4px}
    .toh-bell{position:relative;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.16);color:white;cursor:pointer}
    .toh-bell:hover,.toh-bell[aria-expanded=true]{background:rgba(255,255,255,.3)}
    .toh-bell svg{width:25px;height:25px}
    .toh-bell-count{position:absolute;top:-4px;right:-5px;min-width:20px;height:20px;padding:0 4px;border-radius:12px;background:#d83a45;color:white;font:700 12px/20px sans-serif;box-shadow:0 0 0 2px #087a82}
    .toh-bell-count[hidden]{display:none}
    .toh-notifs{position:fixed;right:16px;width:min(410px,calc(100vw - 24px));max-height:calc(100dvh - 110px);overflow:auto;background:white;color:#233c40;border:1px solid #e0e8e8;border-radius:18px;box-shadow:0 12px 48px #183c4050;z-index:10001;font-family:inherit}
    .toh-notifs[hidden]{display:none}
    .toh-notifs-head{padding:16px 16px 8px;position:sticky;top:0;background:white;z-index:1;border-bottom:1px solid #edf1f1}
    .toh-notifs-top{display:flex;align-items:center;gap:8px;justify-content:space-between}
    .toh-notifs h2{margin:0;font-size:1.35rem;color:#134d55}
    .toh-notifs-close{border:0;background:#eff4f4;border-radius:50%;width:36px;height:36px;font-size:24px;cursor:pointer}
    .toh-notifs-tabs{display:flex;gap:6px;margin:10px 0}
    .toh-notifs-tab{border:0;background:transparent;border-radius:18px;padding:8px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;color:#456369}
    .toh-notifs-tab[aria-pressed=true]{background:#dff2f1;color:#067984}
    .toh-notifs-mark{border:0;background:none;color:#067984;font-size:13px;padding:4px 0 8px;cursor:pointer;text-decoration:underline}
    .toh-notif-row{display:flex;align-items:flex-start;gap:12px;width:100%;border:0;background:white;text-align:left;padding:14px 16px;cursor:pointer;font:inherit;color:inherit}
    .toh-notif-row:hover{background:#f0f7f7}
    .toh-notif-row.unread{background:#f2f9f9}
    .toh-notif-avatar{position:relative;flex:0 0 44px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#dceeed;color:#116e76;font-size:15px;font-weight:700}
    .toh-notif-type{position:absolute;bottom:-3px;right:-3px;border-radius:50%;width:22px;height:22px;display:grid;place-items:center;background:#087e88;color:white;border:2px solid white;font-size:12px}
    .toh-notif-copy{flex:1;min-width:0;overflow-wrap:anywhere;line-height:1.4}
    .toh-notif-copy strong,.toh-notif-copy small{display:block}
    .toh-notif-copy small{margin-top:4px;color:#617b80;font-size:12px}
    .toh-notif-dot{width:9px;height:9px;background:#07828e;border-radius:50%;flex-shrink:0;margin-top:15px}
    .toh-notif-empty,.toh-notif-status{padding:14px 16px;margin:0;color:#597277}
    .toh-notif-status:empty{display:none}
    .toh-notifs-foot{padding:10px 16px;border-top:1px solid #edf1f1;font-size:12px;color:#617b80}
    .toh-notifs button:focus-visible,.toh-bell:focus-visible{outline:3px solid #edab45;outline-offset:2px}
    @media(max-width:600px){#toh-header .brand{min-width:0;flex:1}#toh-header .brand .titre{font-size:clamp(18px,5vw,27px)}#toh-header .brand .sous{font-size:clamp(10px,2.7vw,14px)}.toh-bell-wrap{margin:0 8px}.toh-notifs{right:12px}}
  `;
  document.head.appendChild(style);
  function positionPanel() {
    if (!bell || !panel) return;
    const r = bell.getBoundingClientRect();
    panel.style.top = Math.max(8, Math.min(r.bottom + 12, innerHeight - 230)) + "px";
    panel.style.maxHeight = Math.max(180, innerHeight - parseFloat(panel.style.top) - 16) + "px";
    const width = document.documentElement.clientWidth;
    panel.style.width = Math.min(410, width - 24) + "px";
    panel.style.right = Math.min(Math.max(12, width - r.right), Math.max(12, width - Math.min(410, width - 24) - 12)) + "px";
  }
  function toggle(value) {
    opened = value; panel.hidden = !value;
    bell.setAttribute("aria-expanded", String(value));
    if (value) { positionPanel(); render(); refresh(); panel.querySelector("[data-close]").focus(); }
  }
  function render() {
    counter.textContent = count > 99 ? "99+" : String(count);
    counter.hidden = count === 0;
    bell.setAttribute("aria-label", "Notifications, " + count + " non lue" + (count > 1 ? "s" : ""));
    const visible = filter === "unread" ? rows.filter(n => !n.read_at) : rows;
    panel.innerHTML = '<div class="toh-notifs-head"><div class="toh-notifs-top"><h2 id="toh-notifs-title">Notifications</h2><button type="button" class="toh-notifs-close" data-close aria-label="Fermer les notifications">×</button></div><div class="toh-notifs-tabs" aria-label="Filtrer les notifications"><button type="button" class="toh-notifs-tab" data-filter="all" aria-pressed="' + (filter === "all") + '">Tout</button><button type="button" class="toh-notifs-tab" data-filter="unread" aria-pressed="' + (filter === "unread") + '">Non lu' + (count ? " (" + count + ")" : "") + '</button></div><button type="button" class="toh-notifs-mark" data-all>Toutes marquer comme lues</button></div><p class="toh-notif-status" role="status"></p><div>' + (visible.length ? visible.map(n => {
      const name = [n.actor_prenom,n.actor_nom].filter(Boolean).join(" ").trim();
      const initials = [n.actor_prenom,n.actor_nom].filter(Boolean).map(s => String(s).trim()[0] || "").join("").slice(0,2).toUpperCase() || symbols[n.kind] || "!";
      const date = new Date(n.created_at).toLocaleString("fr-FR", {timeZone:"Pacific/Tahiti",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
      return '<button type="button" class="toh-notif-row ' + (!n.read_at ? "unread" : "") + '" data-open="' + esc(n.id) + '"><span class="toh-notif-avatar" aria-hidden="true">' + esc(initials) + '<span class="toh-notif-type">' + (symbols[n.kind] || "!") + '</span></span><span class="toh-notif-copy"><strong>' + esc(name || (n.kind === "test" ? "Te Ora Hau" : labels[n.kind] || n.title)) + '</strong>' + esc(labels[n.kind] || n.title) + ((n.kind === "test" || n.kind === "annonce") ? '<small>' + esc(n.body) + '</small>' : "") + '<small>' + esc(date) + ' · ' + (n.read_at ? "Lue" : "Non lue") + '</small></span>' + (!n.read_at ? '<span class="toh-notif-dot" aria-label="Non lue"></span>' : "") + '</button>';
    }).join("") : '<p class="toh-notif-empty">' + (filter === "unread" ? "Vous avez lu toutes vos notifications." : "Aucune notification pour le moment.") + '</p>') + '</div><div class="toh-notifs-foot">' + (rows.length >= limit ? '<button type="button" data-more>Afficher les notifications précédentes</button>' : "Vos notifications personnelles.") + '</div>';
  }
  async function badge() {
    try { if (navigator.setAppBadge) { if (count) await navigator.setAppBadge(count); else await navigator.clearAppBadge(); } } catch {}
    try {
      if (!navigator.serviceWorker?.controller) return;
      const reg = await navigator.serviceWorker.ready;
      const unread = new Set(rows.filter(n => !n.read_at).map(n => n.id));
      const known = new Set(rows.map(n => n.id));
      for (const n of await reg.getNotifications()) {
        if ((n.data?.notificationId && known.has(n.data.notificationId) && !unread.has(n.data.notificationId)) ||
            (!count && n.data?.url?.includes("#notifications"))) n.close();
      }
    } catch {}
  }
  async function refresh() {
    if (busy || !mounted) return; busy = true;
    try {
      const {data,error} = await sb.from("bureau_notifications").select("*").order("created_at",{ascending:false}).limit(limit);
      const result = await sb.from("bureau_notifications").select("id",{count:"exact",head:true}).is("read_at",null);
      if (error || result.error) throw error || result.error;
      rows = data || []; count = result.count || 0; render(); await badge();
    } catch { const status=panel.querySelector("[role=status]"); if(status)status.textContent="Impossible de charger les alertes. Fermez puis rouvrez la cloche pour réessayer."; }
    finally { busy = false; }
  }
  async function mark(id) {
    let q = sb.from("bureau_notifications").update({read_at:new Date().toISOString()}).eq("user_id",user.id).is("read_at",null);
    if (id) q=q.eq("id",id);
    const {error}=await q; if(error)throw error;
  }
  function destination(n) {
    if (!/^[0-9a-f-]{36}$/i.test(n.target_id || "")) return null;
    if(n.kind==="annonce") return "espace.html?alerte=annonce&cible="+encodeURIComponent(n.target_id)+"#annonce-"+n.target_id;
    if(n.kind==="forum") return "forum.html?alerte=forum&cible="+encodeURIComponent(n.target_id)+"#forum-"+n.target_id;
    if(n.kind==="contact"||n.kind==="inscription") return "admin.html?alerte="+n.kind+"&cible="+encodeURIComponent(n.target_id)+"#"+(n.kind==="contact"?"admin-messages":"admin-adherents");
    return null;
  }
  async function init() {
    const {data}=await sb.auth.getUser(); if(!data.user)return;
    const {data:p,error}=await sb.from("profils").select("role,acces_suspendu").eq("id",data.user.id).single();
    if(error || !p || p.acces_suspendu)return;
    user=data.user;
    const nav=document.querySelector("#toh-header .nav-inner");if(!nav){setTimeout(init,250);return;}
    const wrap=document.createElement("div");wrap.className="toh-bell-wrap";
    wrap.innerHTML='<button type="button" class="toh-bell" aria-expanded="false" aria-controls="toh-notifications-panel" aria-label="Notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4M12 2V1"/></svg><span class="toh-bell-count" hidden></span></button>';

    const desktop = matchMedia("(min-width: 861px)");
    function placeBell() {
      const logout = document.querySelector('#menu-principal a[onclick*="deconnecter"]');
      if (desktop.matches && logout) logout.before(wrap);
      else nav.insertBefore(wrap,document.getElementById("hamburger"));
    }
    placeBell();
    desktop.addEventListener("change", () => { placeBell(); dispatchEvent(new Event("resize")); });

    bell=wrap.querySelector("button");counter=wrap.querySelector("span");
    panel=document.createElement("section");panel.id="toh-notifications-panel";panel.className="toh-notifs";panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-labelledby","toh-notifs-title");document.body.appendChild(panel);mounted=true;dispatchEvent(new Event("resize"));
    bell.addEventListener("click",()=>toggle(!opened));
    panel.addEventListener("click",async event=>{
      const b=event.target.closest("button");if(!b)return;
      if(b.hasAttribute("data-close")){toggle(false);bell.focus();return;}
      if(b.dataset.filter){filter=b.dataset.filter;render();panel.querySelector('[data-filter="'+filter+'"]').focus();return;}
      if(b.hasAttribute("data-more")){limit+=100;await refresh();return;}
      b.disabled=true;
      try{
        if(b.hasAttribute("data-all")){await mark();await refresh();return;}
        const n=rows.find(n=>n.id===b.dataset.open);if(!n)return;
        await mark(n.id);await refresh();
        const url=destination(n);if(url)location.href=url;
      }catch{const status=panel.querySelector("[role=status]");if(status)status.textContent="La lecture n’a pas été enregistrée. Réessayez.";b.disabled=false;}
    });
    document.addEventListener("click",e=>{if(opened&&!panel.contains(e.target)&&!wrap.contains(e.target))toggle(false);});
    document.addEventListener("keydown",e=>{if(opened&&e.key==="Escape"){toggle(false);bell.focus();}});
    addEventListener("resize",()=>{if(opened)positionPanel();});
    addEventListener("scroll",()=>{if(opened)positionPanel();},{passive:true});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
    window.TOH_NOTIFICATIONS={refresh,open:()=>toggle(true)};
    await refresh();
    if(location.hash==="#notifications")toggle(true);
    setInterval(()=>{if(!document.hidden)refresh();},30000);
  }
  function focusTarget(){
    const q=new URLSearchParams(location.search),kind=q.get("alerte"),id=q.get("cible");
    if(!/^[0-9a-f-]{36}$/i.test(id||""))return true;
    const prefix=kind==="contact"?"contact-":kind==="forum"?"forum-":kind==="annonce"?"annonce-":"profil-";
    const el=document.getElementById(prefix+id);if(!el)return false;
    for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==="DETAILS")parent.open=true;
    el.style.outline="3px solid #e8a23c";el.scrollIntoView({block:"center",behavior:"smooth"});return true;
  }
  let tries=0;const timer=setInterval(()=>{if(focusTarget()||++tries>40)clearInterval(timer);},500);
  init().catch(()=>{window.TOH_BELL_STARTED=false;});
})();
