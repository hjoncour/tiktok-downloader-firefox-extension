import browser from 'webextension-polyfill';

console.log("Content script loaded.");

/**
 * Global state for scrolling:
 * - scrolling: whether scrolling is active
 * - lastHeight: last recorded scroll height
 * - lastChangeTime: timestamp when height last changed
 * - scrollCount: number of scroll steps
 * - timeRemaining: seconds until the next scroll step
 * - checkIntervalId: ID for the interval that ticks every second
 */
let scrolling = false;
let lastHeight = 0;
let lastChangeTime = 0;
let scrollCount = 0;
let timeRemaining = 0;
let checkIntervalId: number | null = null;

/** 
 * Global states for "select bookmarks" mode 
 */
let selectionMode = false;
const selectedAnchors = new Set<HTMLAnchorElement>();

/**
 * Insert custom CSS for a white overlay on selected anchors
 * We'll do this once when the script loads.
 */
(function injectSelectionCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .my-ext-selected {
      position: relative;
      outline: 2px solid white; /* optional visible border */
    }
    .my-ext-selected::after {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.5);
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
})();

/**
 * On any click, if selectionMode is ON, toggle selection for anchors that
 * match the TikTok video pattern: https://www.tiktok.com/@.../video/...
 */
document.addEventListener('click', (e) => {
  if (!selectionMode) return;

  const target = e.target as HTMLElement;
  const anchor = target.closest('a') as HTMLAnchorElement | null;
  if (!anchor) return;

  // Check if anchor is a TikTok video link
  const href = anchor.href;
  if (/^https:\/\/www\.tiktok\.com\/[^/]+\/video\/\d+/.test(href)) {
    e.preventDefault(); // don't navigate
    e.stopPropagation(); 
    // Toggle selection
    if (selectedAnchors.has(anchor)) {
      selectedAnchors.delete(anchor);
      anchor.classList.remove('my-ext-selected');
    } else {
      selectedAnchors.add(anchor);
      anchor.classList.add('my-ext-selected');
    }
  }
});

/** 
 * SCROLLING LOGIC (unchanged from your code, just consolidated)
 */
function initScrollVars() {
  lastHeight = document.documentElement.scrollHeight;
  lastChangeTime = Date.now();
  scrollCount = 0;
  timeRemaining = 0;
}

/**
 * Start scrolling if we aren't already.
 * We set up a 1-second interval that checks:
 *   - if timeRemaining > 0, we decrement and broadcast
 *   - if timeRemaining = 0, we do the next scroll step
 */
function startScrolling() {
  if (scrolling) return;
  scrolling = true;

  // If there's no interval yet, create one
  if (!checkIntervalId) {
    checkIntervalId = window.setInterval(onTick, 1000);
  }
}

/** Stop scrolling but don't reset variables (so we can resume). */
function stopScrolling() {
  scrolling = false;
}

/** Called once per second while scrolling is active. */
function onTick() {
  if (!scrolling) return;
  if (timeRemaining > 0) {
    timeRemaining--;
    sendTimeUpdate(timeRemaining);
  } else {
    doScrollStep();
  }
}

/** Perform one scroll step, then schedule the next delay. */
function doScrollStep() {
  const currentHeight = document.documentElement.scrollHeight;
  window.scrollTo(0, currentHeight);
  scrollCount++;

  // Check if new content has loaded
  if (currentHeight > lastHeight) {
    lastHeight = currentHeight;
    lastChangeTime = Date.now();
    console.log(`New content loaded. Updated height: ${currentHeight}`);
  } else {
    // If no new content for 20 seconds, stop
    if (Date.now() - lastChangeTime > 20000) {
      console.log("Scrolling stopped. No new content loaded in 20 seconds.");
      stopScrolling();
      return;
    }
  }

  // Every 5 scrolls, wait 10s; otherwise wait 5s
  const nextDelayMs = (scrollCount % 5 === 0) ? 10000 : 5000;
  timeRemaining = nextDelayMs / 1000;
  sendTimeUpdate(timeRemaining);
}

function scrollToBottom() {
  const currentHeight = document.documentElement.scrollHeight;
  window.scrollTo(0, currentHeight);
}

function sendTimeUpdate(sec: number) {
  browser.runtime.sendMessage({ type: 'scrollTimeUpdate', timeRemaining: sec })
    .catch(() => {});
}

// Single consolidated message listener that always returns true.
browser.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message.action === "startScrolling") {
    initScrollVars();
    startScrolling();
    sendResponse({ status: "Scrolling started" });
  } else if (message.action === "stopScrolling") {
    stopScrolling();
    sendResponse({ status: "Scrolling stopped" });
  } else if (message.action === "resumeScrolling") {
    startScrolling();
    sendResponse({ status: "Scrolling resumed" });
  } else if (message.action === "scrollToBottom") {
    scrollToBottom();
    sendResponse({ status: "Scrolling once" });
  } 
  // "Bookmark all" approach from before
  else if (message.action === "collectAllVideoLinks") {
    const allLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"));
    const matchedLinks = allLinks
      .map(a => a.href)
      .filter(href => /^https:\/\/www\.tiktok\.com\/[^/]+\/video\/\d+/.test(href));
    sendResponse({ links: matchedLinks });
  }
  // NEW: "Select bookmarks" mode
  else if (message.action === "startSelectionMode") {
    selectionMode = true;
    selectedAnchors.clear();
    sendResponse({ status: "Selection mode started" });
  } 
  else if (message.action === "validateSelection") {
    // Gather the href from all selected anchors
    const links = Array.from(selectedAnchors).map(a => a.href);
    // Remove the overlay class
    selectedAnchors.forEach(a => a.classList.remove('my-ext-selected'));
    selectedAnchors.clear();
    selectionMode = false;
    sendResponse({ status: "Selection validated", links });
  }

  return true; // always return true for async responses
});
