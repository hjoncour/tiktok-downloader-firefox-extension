import browser from 'webextension-polyfill';

console.log("Content script loaded.");

/**
 * SCROLLING STATES (unchanged from your code)
 */
let scrolling = false;
let lastHeight = 0;
let lastChangeTime = 0;
let scrollCount = 0;
let timeRemaining = 0;
let checkIntervalId: number | null = null;

/**
 * SELECTION MODE STATES
 */
let selectionMode = false;
const selectedAnchors = new Set<HTMLAnchorElement>();

/**
 * Inject minimal CSS for a white overlay
 */
(function injectSelectionCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .my-ext-selected {
      position: relative;
      outline: 2px solid white;
    }
    .my-ext-selected::after {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.4);
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
})();

/**
 * On click, if selectionMode is ON, toggle anchor if it's a TikTok video link
 */
document.addEventListener('click', (e) => {
  if (!selectionMode) return;

  const target = e.target as HTMLElement;
  const anchor = target.closest('a') as HTMLAnchorElement | null;
  if (!anchor) return;

  // e.g. https://www.tiktok.com/@someone/video/123456
  const href = anchor.href;
  if (/^https:\/\/www\.tiktok\.com\/[^/]+\/video\/\d+/.test(href)) {
    e.preventDefault();
    e.stopPropagation();
    // Toggle
    if (selectedAnchors.has(anchor)) {
      selectedAnchors.delete(anchor);
      anchor.classList.remove('my-ext-selected');
    } else {
      selectedAnchors.add(anchor);
      anchor.classList.add('my-ext-selected');
    }
  }
});

/** SCROLLING LOGIC (same as your code) */
function initScrollVars() {
  lastHeight = document.documentElement.scrollHeight;
  lastChangeTime = Date.now();
  scrollCount = 0;
  timeRemaining = 0;
}
function startScrolling() {
  if (scrolling) return;
  scrolling = true;
  if (!checkIntervalId) {
    checkIntervalId = window.setInterval(onTick, 1000);
  }
}
function stopScrolling() {
  scrolling = false;
}
function onTick() {
  if (!scrolling) return;
  if (timeRemaining > 0) {
    timeRemaining--;
    sendTimeUpdate(timeRemaining);
  } else {
    doScrollStep();
  }
}
function doScrollStep() {
  const currentHeight = document.documentElement.scrollHeight;
  window.scrollTo(0, currentHeight);
  scrollCount++;
  if (currentHeight > lastHeight) {
    lastHeight = currentHeight;
    lastChangeTime = Date.now();
    console.log(`New content loaded. Updated height: ${currentHeight}`);
  } else {
    if (Date.now() - lastChangeTime > 20000) {
      console.log("Scrolling stopped. No new content loaded in 20 seconds.");
      stopScrolling();
      return;
    }
  }
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

/**
 * Single message listener
 */
browser.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message.action === "startScrolling") {
    initScrollVars();
    startScrolling();
    sendResponse({ status: "Scrolling started" });
  } 
  else if (message.action === "stopScrolling") {
    stopScrolling();
    sendResponse({ status: "Scrolling stopped" });
  }
  else if (message.action === "resumeScrolling") {
    startScrolling();
    sendResponse({ status: "Scrolling resumed" });
  }
  else if (message.action === "scrollToBottom") {
    scrollToBottom();
    sendResponse({ status: "Scrolling once" });
  }
  else if (message.action === "collectAllVideoLinks") {
    // "Bookmark All" approach
    const allLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"));
    const matched = allLinks
      .map(a => a.href)
      .filter(href => /^https:\/\/www\.tiktok\.com\/[^/]+\/video\/\d+/.test(href));
    sendResponse({ links: matched });
  }
  // NEW: selection mode
  else if (message.action === "startSelectionMode") {
    selectionMode = true;
    // clear old selection
    selectedAnchors.forEach(a => a.classList.remove('my-ext-selected'));
    selectedAnchors.clear();
    sendResponse({ status: "Selection mode started" });
  }
  else if (message.action === "validateSelection") {
    // gather href from selected anchors
    const links = Array.from(selectedAnchors).map(a => a.href);
    // remove overlays
    selectedAnchors.forEach(a => a.classList.remove('my-ext-selected'));
    selectedAnchors.clear();
    selectionMode = false;
    sendResponse({ status: "Selection validated", links });
  }
  else if (message.action === "cancelSelection") {
    // remove overlays
    selectedAnchors.forEach(a => a.classList.remove('my-ext-selected'));
    selectedAnchors.clear();
    selectionMode = false;
    sendResponse({ status: "Selection canceled" });
  }

  return true;
});

browser.runtime.onMessage.addListener((message: any, sender, sendResponse): true => {
  if (message.action === 'extensionData') {
    // Forward the data to the webpage
    window.postMessage({ source: 'myExtension', payload: message.payload }, '*');
  }
  return true;
});
