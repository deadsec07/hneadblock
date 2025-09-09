(() => {
  const NS = "[EduAdTools]";
  let booted = false;

  // Toggle this to see logs in DevTools
  const DEBUG = false;
  const log = (...a) => DEBUG && console.debug(NS, ...a);

  // CSS to hide the most common overlay/companion units
  const CSS = `
    .ytp-ad-overlay-slot, .ytp-ad-image-overlay, #player-ads,
    .ytp-ad-module, .video-ads, .ytp-paid-content-overlay,
    ytd-action-companion-ad-renderer, ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_ACTIONS_PANEL"],
    .ytp-ad-player-overlay, .ytp-ad-text { display: none !important; }
  `;

  function injectCssOnce() {
    if (document.getElementById("edu-adtools-style")) return;
    const style = document.createElement("style");
    style.id = "edu-adtools-style";
    style.textContent = CSS;
    document.documentElement.appendChild(style);
  }

  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

  function isAdShowing(playerRoot) {
    // YT usually toggles this class on the main player container
    return playerRoot && playerRoot.classList.contains("ad-showing");
  }

  function clickAllSkips(playerRoot) {
    const btns = [
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-modern",
      ".ytp-skip-ad-button",
      ".ytp-ad-overlay-close-button"
    ];
    for (const sel of btns) {
      $all(sel, playerRoot || document).forEach((b) => {
        b.click();
        log("Clicked:", sel);
      });
    }
  }

  function hideAdNodes() {
    const sels = [
      ".ytp-ad-overlay-slot", ".ytp-ad-image-overlay", "#player-ads",
      ".ytp-ad-module", ".video-ads", ".ytp-paid-content-overlay",
      "ytd-action-companion-ad-renderer",
      '.ytp-ad-player-overlay'
    ];
    sels.forEach((sel) => $all(sel).forEach((n) => n.remove()));
  }

  function getPlayerRoot() {
    // Typical ids/classes YT uses
    return (
      $("#movie_player") ||
      $(".html5-video-player") ||
      $("ytd-player") ||
      $("ytd-watch-flexy")
    );
  }

  function getVideoEl(playerRoot) {
    // Main HTML5 video element (same for ad & content)
    return playerRoot ? $("video", playerRoot) : $("video");
  }

  function speedThroughAd(video, playerRoot) {
    try {
      if (!video) return;

      // Remember state so we can restore
      if (!video.dataset.eduSaved) {
        video.dataset.eduSaved = "1";
        video.dataset.eduPrevMuted = String(video.muted);
        video.dataset.eduPrevRate = String(video.playbackRate || 1);
        video.dataset.eduPrevVol = String(video.volume ?? 1);
      }

      // Mute & go fast
      video.muted = true;
      if (video.playbackRate < 16) video.playbackRate = 16;

      // If ad has finite duration, jump to end
      const dur = Number(video.duration);
      if (isFinite(dur) && dur > 0 && dur < 120) {
        const target = Math.max(0, dur - 0.05);
        if (video.currentTime < target) video.currentTime = target;
      }

      // Some ad types pause themselves; force play
      if (video.paused) video.play().catch(() => {});
    } catch (_) {}
    clickAllSkips(playerRoot);
  }

  function restoreFromAd(video) {
    try {
      if (!video || !video.dataset.eduSaved) return;
      video.muted = (video.dataset.eduPrevMuted === "true");
      const prevRate = Number(video.dataset.eduPrevRate || 1);
      const prevVol = Number(video.dataset.eduPrevVol || 1);
      if (!Number.isNaN(prevRate)) video.playbackRate = Math.max(0.25, Math.min(16, prevRate));
      if (!Number.isNaN(prevVol)) video.volume = Math.max(0, Math.min(1, prevVol));
      delete video.dataset.eduSaved;
      delete video.dataset.eduPrevMuted;
      delete video.dataset.eduPrevRate;
      delete video.dataset.eduPrevVol;
    } catch (_) {}
  }

  function tick() {
    injectCssOnce();
    hideAdNodes();

    const player = getPlayerRoot();
    if (!player) return;

    const video = getVideoEl(player);
    if (!video) return;

    if (isAdShowing(player)) {
      speedThroughAd(video, player);
    } else {
      restoreFromAd(video);
      clickAllSkips(player); // sometimes skip button lingers at boundary
    }
  }

  function observePlayerAndDom() {
    const player = getPlayerRoot();
    if (player && !player.dataset.eduObserved) {
      player.dataset.eduObserved = "1";
      const mo = new MutationObserver(tick);
      mo.observe(player, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
    }

    // Fallback: watch big app container for SPA navigations
    const app = $("ytd-app") || document.body;
    if (app && !app.dataset.eduObserved) {
      app.dataset.eduObserved = "1";
      const mo2 = new MutationObserver(tick);
      mo2.observe(app, { childList: true, subtree: true });
    }
  }

  function wireEvents() {
    // YT SPA events fire on window in modern builds
    ["yt-navigate-start", "yt-navigate-finish", "yt-page-data-updated"].forEach((ev) => {
      window.addEventListener(ev, () => {
        log("evt", ev);
        setTimeout(() => { tick(); observePlayerAndDom(); }, 50);
        setTimeout(tick, 300);
        setTimeout(tick, 1200);
      }, true);
    });

    // Initial periodic tick (super lightweight)
    setInterval(tick, 1000);
  }

  function boot() {
    if (booted) return;
    booted = true;
    injectCssOnce();
    wireEvents();
    // First passes
    setTimeout(tick, 100);
    setTimeout(tick, 700);
    setTimeout(() => { tick(); observePlayerAndDom(); }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
