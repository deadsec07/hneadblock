// content.js — stealth (mute+skip) / aggressive (+fast-forward/seek) + safe corner toast
(() => {
  let enabled = true;
  let mode = "stealth"; // "stealth" | "aggressive"
  chrome.storage.sync.get({ enabled: true, mode: "stealth" }, v => { enabled = !!v.enabled; mode = v.mode || "stealth"; });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "sync") return;
    if (ch.enabled) enabled = !!ch.enabled.newValue;
    if (ch.mode) mode = ch.mode.newValue === "aggressive" ? "aggressive" : "stealth";
  });

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // --- CSS: keep your ad UI hide, plus a tiny fixed toast (no player DOM changes) ---
  const CSS = `
    .ytp-ad-overlay-slot, .ytp-ad-image-overlay, #player-ads,
    .ytp-ad-module, .video-ads, .ytp-paid-content-overlay,
    ytd-action-companion-ad-renderer, .ytp-ad-player-overlay, .ytp-ad-text { display:none !important; }

    /* Tiny corner toast (pointer-events:none; never blocks clicks) */
    #edu-ad-toast {
      position: fixed; left: 12px; bottom: 12px; z-index: 2147483647; pointer-events: none;
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(15,23,42,.84); color: #e2e8f0; padding: 8px 10px; border-radius: 10px;
      font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,.25);
      opacity: 1; transform: translateY(0); transition: opacity .15s ease, transform .15s ease;
    }
    #edu-ad-toast.hide { opacity: 0; transform: translateY(6px); }
    #edu-ad-toast .spin {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(226,232,240,.32); border-top-color: rgba(226,232,240,.95);
      animation: eatspin .9s linear infinite;
    }
    @keyframes eatspin { to { transform: rotate(360deg); } }
  `;
  (function injectCssOnce(){
    if (document.getElementById("edu-adtools-style")) return;
    const s = document.createElement("style"); s.id = "edu-adtools-style"; s.textContent = CSS;
    (document.head || document.documentElement || document.body)?.appendChild(s);
  })();

  // --- ultra-light toast helpers (fixed to viewport; no player interaction) ---
  const TOAST_ID = "edu-ad-toast";
  function ensureToast() {
    let t = document.getElementById(TOAST_ID);
    if (t) return t;
    t = document.createElement("div");
    t.id = TOAST_ID;
    t.className = "hide";
    t.innerHTML = `<span class="spin"></span><span class="msg">Skipping ads…</span>`;
    (document.body || document.documentElement)?.appendChild(t);
    return t;
  }
  function toastShow(text = "Skipping ads…") {
    const t = ensureToast();
    const msg = t.querySelector(".msg"); if (msg && msg.textContent !== text) msg.textContent = text;
    t.classList.remove("hide");
  }
  function toastHide() {
    const t = document.getElementById(TOAST_ID);
    if (t) t.classList.add("hide");
  }

  function root() { return $("#movie_player") || $(".html5-video-player") || $("ytd-player") || $("ytd-watch-flexy") || document.body || document; }
  function vid(r=root()) { return $("video", r) || $("video"); }

  function isAd(r=root()) {
    try {
      if (r?.classList?.contains("ad-showing") || r?.classList?.contains("ad-interrupting")) return true;
      const vis = (sel) => {
        const el = document.querySelector(sel); if (!el) return false;
        const cs = getComputedStyle(el); return cs && cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity || "1") > 0.01;
      };
      return vis(".ytp-ad-player-overlay") || vis(".ytp-ad-preview") || vis(".ytp-ad-skip-button") || vis(".ytp-ad-skip-button-modern");
    } catch { return false; }
  }

  function clickSkips(r=root()) {
    [".ytp-ad-skip-button",".ytp-ad-skip-button-modern",".ytp-skip-ad-button",".ytp-ad-overlay-close-button","#dismiss-button button"]
      .forEach(sel => $$(sel, r).forEach(b => { try { b.click(); } catch {} }));
  }

  function speedThrough(v) {
    if (!v) return;
    try {
      if (!v.dataset.eduSaved) {
        v.dataset.eduSaved = "1";
        v.dataset.eduPrevMuted = String(v.muted);
        v.dataset.eduPrevRate  = String(v.playbackRate || 1);
        v.dataset.eduPrevVol   = String(v.volume ?? 1);
      }
      v.muted = true;
      if (mode === "aggressive") {
        if (v.playbackRate < 16) v.playbackRate = 16;
        const dur = Number(v.duration);
        if (Number.isFinite(dur) && dur > 0 && dur < 120) {
          const target = Math.max(0, dur - 0.05);
          if (v.currentTime < target) v.currentTime = target;
        }
        if (v.paused) v.play().catch(()=>{});
      }
    } catch {}
  }

  function restore(v) {
    if (!v) return;
    try {
      if (v.dataset.eduSaved) {
        v.muted = (v.dataset.eduPrevMuted === "true");
        const pr = Number(v.dataset.eduPrevRate || 1);
        const pv = Number(v.dataset.eduPrevVol || 1);
        v.playbackRate = Number.isFinite(pr) ? Math.max(0.25, Math.min(4, pr)) : 1;
        v.volume = Number.isFinite(pv) ? Math.max(0, Math.min(1, pv)) : v.volume;
        delete v.dataset.eduSaved; delete v.dataset.eduPrevMuted; delete v.dataset.eduPrevRate; delete v.dataset.eduPrevVol;
      } else {
        if (v.playbackRate > 2.5) v.playbackRate = 1; // safety
      }
    } catch {}
  }

  let prevWasAd = false, counted = false, nonAdStreak = 0, prevCT = 0;

  function tick() {
    try {
      if (!enabled) return;
      const r = root(); const v = vid(r); if (!r || !v) return;

      const ad = isAd(r);
      clickSkips(r);

      if (ad) {
        nonAdStreak = 0;
        speedThrough(v);
        // 👇 show tiny corner toast while ad is present
        toastShow("Skipping ads…");
      } else {
        nonAdStreak++;
        restore(v);
        const ct = Number(v.currentTime || 0);
        if (ct > prevCT + 0.05 && nonAdStreak >= 2 && v.playbackRate > 2.5) v.playbackRate = 1;
        prevCT = ct;

        if (prevWasAd && !counted) { counted = true; chrome.runtime.sendMessage({ type: "ad-ended" }); }
        // 👇 hide toast once we’re stably back on content (nonAdStreak>=2)
        if (nonAdStreak >= 2) toastHide();
      }

      if (!ad) counted = false;
      prevWasAd = ad;
    } catch {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick);
  else tick();

  window.addEventListener("yt-navigate-start", () => {
    try { const v = vid(); if (v) { v.playbackRate = 1; delete v.dataset.eduSaved; } } catch {};
    toastHide();
    setTimeout(tick, 60);
  }, true);

  ["yt-navigate-finish","yt-page-data-updated"].forEach(ev =>
    window.addEventListener(ev, () => { setTimeout(tick, 60); setTimeout(tick, 300); setTimeout(tick, 1200); }, true)
  );
  setInterval(tick, 700);

  // count “prevented” from stubs (if ruleset blocks IMA/VMAP)
  window.addEventListener("EDU_ADBLOCK_HIT", () => { chrome.runtime.sendMessage({ type: "ad-blocked" }); }, true);
})();
