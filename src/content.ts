import browser from 'webextension-polyfill';

console.log("Content script loaded.");

/**
 * We keep a global state to manage scrolling. 
 * - scrolling: whether we are actively scrolling or not
 * - lastHeight: last recorded scroll height
 * - lastChangeTime: timestamp of the last time the height changed
 * - scrollCount: how many scroll steps have happened
 * - timeRemaining: how many seconds until the next scroll step
 * - checkIntervalId: the ID of the setInterval that ticks every second
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
  if (scrolling) return; // already scrolling
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
    // Decrement and broadcast
    timeRemaining--;
    sendTimeUpdate(timeRemaining);
  } else {
    // Time for the next scroll step
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

/** Send a message to the popup with the updated countdown. */
function sendTimeUpdate(sec: number) {
  browser.runtime.sendMessage({ type: 'scrollTimeUpdate', timeRemaining: sec })
    .catch(() => {
      // If the popup is closed, this can fail. Safe to ignore.
    });
}

/** Listen for messages from the popup to start/stop/resume scrolling. */
browser.runtime.onMessage.addListener((message: any) => {
  if (message.action === "startScrolling") {
    initScrollVars();
    startScrolling();
    return Promise.resolve({ status: "Scrolling started" });
  }
  if (message.action === "stopScrolling") {
    stopScrolling();
    return Promise.resolve({ status: "Scrolling stopped" });
  }
  if (message.action === "resumeScrolling") {
    startScrolling();
    return Promise.resolve({ status: "Scrolling resumed" });
  }
});
