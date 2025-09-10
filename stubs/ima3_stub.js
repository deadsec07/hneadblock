(function(){
  const NOOP = function(){};
  const g = (window.google = window.google || {});
  const ima = (g.ima = g.ima || {});
  function AdsLoader(){ this.contentComplete = NOOP; this.addEventListener = NOOP; this.getSettings = () => ({ setLocale: NOOP }); }
  AdsLoader.prototype.requestAds = NOOP;
  function AdsManager(){}
  AdsManager.prototype.init = NOOP; AdsManager.prototype.start = NOOP; AdsManager.prototype.destroy = NOOP;
  AdsManager.prototype.setVolume = NOOP; AdsManager.prototype.addEventListener = NOOP;
  ima.VERSION = "stub"; ima.AdsLoader = AdsLoader; ima.AdsManager = AdsManager;

  try { window.dispatchEvent(new CustomEvent("EDU_ADBLOCK_HIT", { detail: { kind: "ima-stub" } })); } catch {}
})();
