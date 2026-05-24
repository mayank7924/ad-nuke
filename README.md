# 🛡️ Ad Nuke — Instant Popup & Tab Killer for Aggressive Streaming Sites

> I got tired of clicking through 16 popup layers just to watch a video. So I reverse-engineered the ad network and built a two-file Chrome extension that nukes them in milliseconds.

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/size-%3C5KB-brightgreen?style=flat-square" />
  <img src="https://img.shields.io/badge/popups_blocked-instantly-red?style=flat-square" />
  <img src="https://img.shields.io/badge/no_dependencies-vanilla_JS-yellow?style=flat-square" />
</p>

---

## The Problem

You know exactly what this is.

You navigate to a streaming site. You click **Play**. A new tab opens. You close it. Click play again. Another window. You close that. Thirteen clicks later, your browser looks like a casino exploded — and you haven't watched a single second of video.

These aren't random ads. They're **engineered traps** — invisible `<div>` layers sitting on top of the video player, intercepting your real mouse clicks at the hardware level before your browser can react.

Standard popup blockers don't work. `window.open` overrides don't work. Even DOM-level mutation observers fail — the ad network runs a bot-detection service that detects the intervention, **wipes your DevTools console** to cover its tracks, and locks the player in an infinite loop.

This extension solves it at the only layer that actually works: **the browser's network engine**, before any malicious script ever loads.

---

## How It Works

After spending hours reverse-engineering the ad network's behavior through brief console windows (before they got wiped), I identified the exact routing domains used for tab hijacking and popup spawning.

The extension operates on two levels simultaneously:

```
Your Click
    │
    ├─► [Network Layer] declarativeNetRequest
    │       Blocks connections to known ad-routing domains
    │       before any script executes. The tab never loads.
    │
    └─► [Safety Net] tabs.onUpdated listener
            Catches anything that slips through.
            If a tab URL matches a known pattern → instant close.
            Latency: ~10ms.
```

No DOM manipulation. No script injection. No fingerprint surface for bot-detection to grab onto.

---

## Installation (2 minutes)

**1. Clone or download this repo**
```bash
git clone https://github.com/YOUR_USERNAME/ad-nuke.git
```

**2. Open Chrome's extension page**
```
chrome://extensions/
```

**3. Enable Developer Mode** (toggle in the top-right corner)

**4. Click "Load unpacked"** → select the `extension/` folder

Done. No build step. No npm. No config. It just works.

---

## The Files

This extension is intentionally minimal. Two files. Less than 60 lines of code.

```
extension/
├── manifest.json   # Requests declarativeNetRequest + tabs permissions
└── background.js   # Blocks domains + kills leaked tabs
```

### `manifest.json`
Requests the minimum permissions needed:
- `declarativeNetRequest` — engine-level network blocking
- `tabs` — to close any tabs that slip through

### `background.js`
```javascript
const BLOCKED_DOMAINS = [
    "encistcharr.cfd",
    "crn77.com",
    "xadsmart.com",
    "adsco.re"          // Adscore fingerprinting service
];

// Engine-layer block — domains never connect
const rules = BLOCKED_DOMAINS.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' },
    condition: {
        urlFilter: domain,
        resourceTypes: ['main_frame', 'sub_frame', 'script', 'xmlhttprequest']
    }
}));

chrome.runtime.onInstalled.addListener(() => {
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map(r => r.id),
        addRules: rules
    });
});

// Safety net — kill anything that gets through
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const url = changeInfo.url.toLowerCase();
        const shouldKill =
            BLOCKED_DOMAINS.some(d => url.includes(d)) ||
            url.includes('zoneid=') ||
            url.includes('afu.php');

        if (shouldKill) chrome.tabs.remove(tabId);
    }
});
```

---

## Adding Your Own Domains

Found a new ad domain on a site? Open `background.js` and add it to `BLOCKED_DOMAINS`:

```javascript
const BLOCKED_DOMAINS = [
    "encistcharr.cfd",
    "crn77.com",
    "xadsmart.com",
    "adsco.re",
    "your-new-domain.com"   // ← add here
];
```

Then go to `chrome://extensions/` and click the **refresh icon** on the extension.

To find new domains:
1. Open DevTools → Network tab
2. Click the video play button
3. Watch for the brief flash of network requests before the console gets cleared
4. Copy the domain, add it to the list

---

## What This Does NOT Do

- ❌ It does not block ads embedded within the video player itself
- ❌ It does not work on all streaming sites (only tested on specific aggressive ones)
- ❌ It will not bypass DRM or paywalls of any kind
- ❌ It is not a general-purpose ad blocker (use uBlock Origin for that)

This is a **surgical tool** for one specific attack pattern: click-hijacking popups and spawned tabs from aggressive streaming platforms.

---

## Technical Background

The ad network this was built against uses a layered defense:

| Layer | Their Attack | My Counter |
|---|---|---|
| DOM | Transparent `<div>` hijacks real mouse clicks | Irrelevant — never fight the DOM |
| Script | `window.open` called on trusted click events | Irrelevant — blocked at network layer |
| Detection | Adscore fingerprinting, console wiping | No footprint — background service worker |
| Fallback | New hijack layer spawned after each click | Safety net closes tab in ~10ms |

The key insight: **fighting inside the page is fighting on their turf**. The moment you touch the DOM or override JavaScript, you're detectable. Moving the fight to the browser's declarative network layer means your code never runs inside the page at all.

---

## Read the Full Story

I wrote a detailed breakdown of the entire reverse-engineering process — the three failed attempts, how Adscore's bot detection works, and how I finally cracked it.

📖 **[How I Reverse-Engineered an Aggressive Ad Network and Forced My Browser to Nuke It]** *(link to your blog post)*

---

## Contributing

Found a new ad domain? Open a PR and add it to `BLOCKED_DOMAINS` in `background.js`.

Found a streaming site where this doesn't work? Open an issue with the domain (not the full URL) and I'll investigate.

---

## License

MIT. Use it, fork it, improve it.

---

*Built out of pure frustration. If it saves you even one click-rage session, it was worth it.*
