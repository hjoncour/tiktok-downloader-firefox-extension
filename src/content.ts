import browser from 'webextension-polyfill';

console.log("Content script loaded.");

function scrollToBottom() {
  let lastHeight = document.documentElement.scrollHeight;
  let lastChangeTime = Date.now();
  let scrollCount = 0;

  function scrollStep() {
    const currentHeight = document.documentElement.scrollHeight;
    window.scrollTo(0, currentHeight);
    scrollCount++;

    if (currentHeight > lastHeight) {
      lastHeight = currentHeight;
      lastChangeTime = Date.now();
      console.log(`New content loaded. Updated height: ${currentHeight}`);
    } else {
      // If no new content loaded for 10 seconds, stop scrolling.
      if (Date.now() - lastChangeTime > 20000) {
        console.log("Scrolling stopped. No new content loaded in 10 seconds.");
        return;
      }
    }

    // Every 5 scrolls, wait 5 seconds before next scroll; otherwise wait 500ms.
    const delay = (scrollCount % 5 === 0) ? 10000 : 5000;
    setTimeout(scrollStep, delay);
  }

  scrollStep();
}

browser.runtime.onMessage.addListener((message: any) => {
  if (message.action === "scrollToBottom") {
    scrollToBottom();
    return Promise.resolve({ status: "Scrolling started" });
  }
});
