// background.js — two modes + blocked counter badge
const DEFAULTS = { enabled: true, mode: "stealth", count: 0 };

async function getState() {
  const v = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...v };
}
async function setState(patch) {
  const cur = await getState();
  const next = { ...cur, ...patch };
  await chrome.storage.sync.set(next);
  return next;
}

async function updateBadge() {
  const { enabled, count, mode } = await getState();
  await chrome.action.setBadgeBackgroundColor({ color: "#3a7afe" });
  await chrome.action.setBadgeText({ text: enabled && count > 0 ? (count > 999 ? "999+" : String(count)) : "" });
  await chrome.action.setTitle({ title: enabled ? `Hne Ad Tools (${mode}) — Blocked: ${count}` : "Hne Ad Tools — Disabled" });
}

async function applyRuleset() {
  const { enabled, mode } = await getState();
  const enable = enabled && mode === "aggressive";
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enable ? ["ruleset_1"] : [],
      disableRulesetIds: enable ? [] : ["ruleset_1"]
    });
  } catch (e) { console.warn("[EAT] DNR toggle failed:", e); }
}

chrome.runtime.onInstalled.addListener(async () => {
  await setState({});
  await applyRuleset();
  await updateBadge();
});
chrome.runtime.onStartup?.addListener(async () => { await applyRuleset(); await updateBadge(); });
chrome.storage.onChanged.addListener(async (ch, area) => {
  if (area !== "sync") return;
  await applyRuleset(); await updateBadge();
});

// messages from content/popup
chrome.runtime.onMessage.addListener((msg) => {
  (async () => {
    if (msg?.type === "ad-ended" || msg?.type === "ad-blocked") {
      const { enabled } = await getState(); if (!enabled) return;
      const { count } = await getState();
      await setState({ count: count + 1 }); await updateBadge();
    }
    if (msg?.type === "reset-count") { await setState({ count: 0 }); await updateBadge(); }
    if (msg?.type === "set-mode" && (msg.mode === "stealth" || msg.mode === "aggressive")) {
      await setState({ mode: msg.mode }); await applyRuleset(); await updateBadge();
    }
    if (msg?.type === "toggle") {
      const { enabled } = await getState();
      await setState({ enabled: !enabled }); await applyRuleset(); await updateBadge();
    }
  })();
});

// just in case you had old dynamic rules
chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: Array.from({length: 5000}, (_,k)=>k+1) }).catch(()=>{});
