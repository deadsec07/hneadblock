const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

async function refresh() {
  const man = chrome.runtime.getManifest();
  $("#ver").textContent = `v${man.version}`;

  const { enabled = true, mode = "stealth", count = 0 } = await chrome.storage.sync.get(["enabled","mode","count"]);
  $("#enabled").checked = !!enabled;
  $$('input[name="mode"]').forEach(r => r.checked = (r.value === mode));
  $("#count").textContent = String(count);

  // show whether the blocking ruleset is on
  const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets().catch(()=>[]);
  const rulesOn = rulesets && rulesets.includes("ruleset_1");
  $("#rules-status").textContent = `Network rules: ${rulesOn ? "ON (aggressive)" : "OFF (stealth)"}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  await refresh();

  $("#enabled").addEventListener("change", () => {
    chrome.runtime.sendMessage({ type: "toggle" });
    // refresh after the SW updates
    setTimeout(refresh, 150);
  });

  $$('input[name="mode"]').forEach(r => {
    r.addEventListener("change", () => {
      if (r.checked) {
        chrome.runtime.sendMessage({ type: "set-mode", mode: r.value });
        setTimeout(refresh, 150);
      }
    });
  });

  $("#reset").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "reset-count" });
    setTimeout(refresh, 100);
  });

  // live updates while popup is open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.count) $("#count").textContent = String(changes.count.newValue ?? 0);
    if (changes.enabled) $("#enabled").checked = !!changes.enabled.newValue;
    if (changes.mode) {
      $$('input[name="mode"]').forEach(r => r.checked = (r.value === changes.mode.newValue));
    }
  });
});
