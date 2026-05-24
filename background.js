const BLOCKED_DOMAINS = ["xadsmart.com", "adsco.re"];

// Engine-layer block
// Intercepts connections before any script executes.
// The tab never loads, the script never runs, the ad site never sees us.
const rules = BLOCKED_DOMAINS.map((domain, index) => ({
  id: index + 1,
  priority: 1,
  action: { type: "block" },
  condition: {
    urlFilter: domain,
    resourceTypes: ["main_frame", "sub_frame", "script", "xmlhttprequest"],
  },
}));

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map((r) => r.id),
    addRules: rules,
  });
});

// Safety net — instant tab termination
// If a script tricks the browser into opening a tab before the block fires,
// this listener catches the URL on first navigation and closes it in ~10ms.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const url = changeInfo.url.toLowerCase();

    const shouldKill =
      BLOCKED_DOMAINS.some((domain) => url.includes(domain)) ||
      url.includes("zoneid=") || // common ad-routing parameter
      url.includes("afu.php"); // known popup redirect endpoint

    if (shouldKill) {
      chrome.tabs.remove(tabId);
    }
  }
});
