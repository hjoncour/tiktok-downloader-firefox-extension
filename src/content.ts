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
 * Initialize scroll-related variables.
 * Called whenever we "startScrolling" fresh.
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
    .catch(() => { /* safe to ignore if popup is closed */ });
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
    sendResponse({ status: "Scrolling started" });
  } else if (message.action === "collectAllVideoLinks") {
    const allLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"));
    const matchedLinks = allLinks
      .map(a => a.href)
      .filter(href => /^https:\/\/www\.tiktok\.com\/[^/]+\/video\/\d+/.test(href));
    sendResponse({ links: matchedLinks });
  }
  // Always return true to indicate that sendResponse will be called asynchronously.
  return true;
});
