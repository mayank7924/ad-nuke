# I Reverse-Engineered an Aggressive Ad Network and Forced My Browser to Nuke It

There's a special kind of rage reserved for certain websites.

You navigate to a streaming site. You click **Play**. A new tab opens. You close it, jaw clenched. Click Play again. Another window detonates across your screen. You close that one too. By click number twelve, you're not watching anything — you're playing whack-a-mole with a machine that's had twelve years to perfect its craft and has absolutely no interest in losing.

I'm a developer. I refused to accept this.

What started as idle frustration turned into a three-phase reverse-engineering project, a collision with an enterprise bot-detection system, and eventually, a two-file Chrome extension that nukes these popups in under ten milliseconds. Here's the full story.

---

## Phase 1: The Naive Override (Gone in 60 Seconds)

My first instinct was elegant in its simplicity. Open DevTools, override `window.open` so it returns nothing, and starve the popup spawner at the source.

```javascript
window.open = function() { return null; };
```

I hit enter feeling like a genius. Then I clicked Play.

New tab. Immediately.

The site didn't even flinch. My elegant one-liner had done precisely nothing. The popup appeared so fast it felt like a personal insult.

---

## Phase 2: The Invisible Layer

I dug into the HTML. What I found was genuinely clever — and genuinely infuriating.

The last `<div>` in the player container was *alive*. Not static. Constantly regenerating. A transparent, absolutely-positioned overlay that sat perfectly on top of the video player, invisible to the eye but perfectly positioned to intercept my mouse cursor.

Here's the trick: browsers have a concept of a "trusted click" — a real, hardware-level mouse event from an actual human. Ad scripts can't synthetically generate these. But they *can* steal them.

When I clicked "Play," I wasn't clicking the video player. I was clicking their invisible div. My real, trusted click got hijacked, fired off an un-blockable popup, and then — *and this is the elegant part* — the div **deleted itself** and a fresh one spawned for the next click. The whole operation took milliseconds. Clean, stateless, repeatable.

I built a `MutationObserver` to watch the DOM and strip these ghost layers in real time. I felt good about this. I should not have felt good about this.

---

## Phase 3: The System Fights Back

The extension loaded. I clicked Play. No popup — *victory*.

Except nothing else worked either.

The ad network wasn't running alone. It was bundled with **Adscore**, an enterprise-grade bot-detection service. The moment my observer started touching the DOM, Adscore's fingerprinting system fired: checking WebGL contexts, measuring screen geometry, probing hardware capabilities. It decided I was a bot.

Then it did something I'd never seen before.

It *wiped my console.*

Not a refresh. Not a page reload. Adscore runs an internal cleanup routine that actively clears DevTools output — destroying any evidence of what it had just done. The player locked into an infinite loop. My logs were gone. I was flying blind.

This is when I realized: I had been fighting in the wrong arena entirely.

---

## The Real Battlefield: The Network Layer

The DOM is their home turf. Anything you do inside the page — script overrides, DOM manipulation, observer tricks — happens inside a sandbox they've already secured. They can see you, detect you, and neutralize you.

But there's a layer above the page. A layer the site's JavaScript has no visibility into whatsoever.

**The browser's network engine.**

Before I gave up and let the console get wiped, I watched the Network tab. In those brief windows, I caught what I was looking for: the routing domains. The specific servers these popup tabs were phoning home to. A handful of domains with names like `encistcharr.cfd` and `crn77.com` — ugly, disposable, unmistakable.

With those in hand, I stopped trying to fight the popups *after they appeared*. I built something that made sure they could never start.

---

## The Solution: A Two-File Extension

Chrome's `declarativeNetRequest` API lets you define blocking rules at the browser engine level — before HTTP connections are even established, before any script executes, before Adscore can see anything. Your extension code doesn't run inside the page. It runs in a background service worker. Invisible. Unfingerprintable.

**`manifest.json`** — requests the two permissions we need:

```json
{
  "manifest_version": 3,
  "name": "Ad Nuke",
  "version": "1.0",
  "permissions": ["declarativeNetRequest", "tabs"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" }
}
```

**`background.js`** — two mechanisms, one job:

```javascript
const BLOCKED_DOMAINS = [
    "encistcharr.cfd",
    "crn77.com",
    "xadsmart.com",
    "adsco.re"
];

// Mechanism 1: Engine-layer block
// These domains never connect. Scripts never load. Adscore never wakes up.
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

// Mechanism 2: The instant-kill safety net
// If anything slips through (cached scripts, alternate domains),
// this closes the tab the moment its URL becomes visible. ~10ms.
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

That's the entire thing. Under 60 lines. No build step. No dependencies. No npm.

---

## The Result

I loaded the unpacked extension, navigated to the site, and clicked Play.

The underlying click-hijacking code still ran — I could tell because my cursor was still being briefly stolen by the ghost div. But the popup tabs now snapped shut in under a frame. What used to be a 16-click, browser-trashing ordeal became a couple of slightly-delayed clicks before the real player activated.

The web is an arms race. Ad engineers are extremely good at what they do, and they've had years to build these systems. But there's one layer they can't touch: the browser's own infrastructure. Once you step outside the page and into the network engine, you're playing by different rules.

Their rules don't apply there.

---

*The full extension is on GitHub. If you find new domains from other sites, PRs are open.*
