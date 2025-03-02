console.log("Content script loaded.");

function scrollToBottom() {
  let lastHeight = 0;
  let lastChangeTime = Date.now();

  const intervalId = setInterval(() => {
    const currentHeight = document.documentElement.scrollHeight;
    window.scrollTo(0, currentHeight);

    // If the page height increases, update the last change time
    if (currentHeight > lastHeight) {
      lastHeight = currentHeight;
      lastChangeTime = Date.now();
      console.log("New content loaded. Updated height:", currentHeight);
    } else {
      // If no new content for 10 seconds, stop scrolling
      if (Date.now() - lastChangeTime > 10000) {
        clearInterval(intervalId);
        console.log("Scrolling stopped. No new content loaded in 10 seconds.");
      }
    }
  }, 500);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scrollToBottom") {
    scrollToBottom();
    sendResponse({ status: "Scrolling started" });
  }
});
