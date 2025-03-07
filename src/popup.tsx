import * as React from 'react';
import * as ReactDOM from 'react-dom';
import browser from 'webextension-polyfill';
import './styles/popup.css';

/**
 * Matches a TikTok video URL:
 *   https://www.tiktok.com/anyUserId/anySegment/videoId
 */
const tiktokVideoRegex = /^https:\/\/www\.tiktok\.com\/[^/]+\/[^/]+\/\d+/;

const Popup: React.FC = () => {
  const [title, setTitle] = React.useState('Loading...');
  const [activeUrl, setActiveUrl] = React.useState('');
  const [bookmarks, setBookmarks] = React.useState<string[]>([]);
  const [scrollStatus, setScrollStatus] = React.useState<'idle' | 'scrolling' | 'paused'>('idle');
  const [timeRemaining, setTimeRemaining] = React.useState(0);
  const [isSelecting, setIsSelecting] = React.useState(false);

  React.useEffect(() => {
    // 1) Get active tab info
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs.length > 0) {
          const tab = tabs[0];
          if (tab.title) setTitle(tab.title);
          if (tab.url) setActiveUrl(tab.url);
        }
      })
      .catch(err => console.error('Error fetching tab info:', err));

    // 2) Load existing bookmarks
    browser.storage.local.get("bookmarks")
      .then(data => {
        if (data.bookmarks && Array.isArray(data.bookmarks)) {
          setBookmarks(data.bookmarks);
        }
      })
      .catch(err => console.error("Error loading bookmarks:", err));

    // 3) Listen for scroll updates from content script
    const handleMessage = (message: any) => {
      if (message.type === 'scrollTimeUpdate') {
        setTimeRemaining(message.timeRemaining);
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Evaluate conditions once
  const isTikTokDomain = activeUrl.startsWith("https://www.tiktok.com");
  const isVideoPage = tiktokVideoRegex.test(activeUrl);

  // Scrolling logic
  const handleStartScrolling = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        const tabId = tabs[0]?.id;
        if (tabId != null) {
          return browser.tabs.sendMessage(tabId, { action: "startScrolling" });
        }
      })
      .then(() => setScrollStatus('scrolling'))
      .catch(err => console.error("Error starting scroll:", err));
  };

  const handleStopResume = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        const tabId = tabs[0]?.id;
        if (tabId == null) return;
        if (scrollStatus === 'scrolling') {
          return browser.tabs.sendMessage(tabId, { action: "stopScrolling" })
            .then(() => setScrollStatus('paused'));
        } else if (scrollStatus === 'paused') {
          return browser.tabs.sendMessage(tabId, { action: "resumeScrolling" })
            .then(() => setScrollStatus('scrolling'));
        }
      })
      .catch(err => console.error("Error in stop/resume:", err));
  };

  // Bookmark current video page (only for single video pages)
  const handleBookmarkClick = () => {
    if (!isVideoPage) {
      alert("Not a valid TikTok video page.");
      return;
    }
    if (bookmarks.includes(activeUrl)) {
      alert("This URL is already bookmarked.");
      return;
    }
    const updated = [...bookmarks, activeUrl];
    browser.storage.local.set({ bookmarks: updated })
      .then(() => setBookmarks(updated))
      .catch(err => console.error("Error saving bookmark:", err));
  };

  // "Bookmark All Videos" for non-video pages
  const handleBookmarkAll = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        const tabId = tabs[0]?.id;
        if (tabId != null) {
          return browser.tabs.sendMessage(tabId, { action: "collectAllVideoLinks" });
        }
      })
      .then(response => {
        if (!response) return;
        const res = response as { links: string[] };
        if (!res.links) return;

        const newBookmarks: string[] = [];
        res.links.forEach(url => {
          if (!bookmarks.includes(url) && !newBookmarks.includes(url)) {
            newBookmarks.push(url);
          }
        });
        const updated = [...bookmarks, ...newBookmarks];
        browser.storage.local.set({ bookmarks: updated })
          .then(() => setBookmarks(updated))
          .catch(err => console.error("Error saving all bookmarks:", err));
      })
      .catch(err => console.error("Error collecting video links:", err));
  };

  // Clear all bookmarks
  const handleClearSelection = () => {
    browser.storage.local.set({ bookmarks: [] })
      .then(() => setBookmarks([]))
      .catch(err => console.error("Error clearing bookmarks:", err));
  };

  // Remove an individual bookmark
  const handleRemoveBookmark = (bm: string) => {
    const updated = bookmarks.filter(item => item !== bm);
    browser.storage.local.set({ bookmarks: updated })
      .then(() => setBookmarks(updated))
      .catch(err => console.error("Error removing bookmark:", err));
  };

  // "Select mode" logic
  const handleSelectModeToggle = () => {
    if (!isSelecting) {
      // Start selection mode
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          const tabId = tabs[0]?.id;
          if (tabId != null) {
            return browser.tabs.sendMessage(tabId, { action: "startSelectionMode" });
          }
        })
        .then(() => setIsSelecting(true))
        .catch(err => console.error("Error starting selection mode:", err));
    } else {
      // Validate selection: get selected video links from content script
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          const tabId = tabs[0]?.id;
          if (tabId != null) {
            return browser.tabs.sendMessage(tabId, { action: "validateSelection" });
          }
        })
        .then(response => {
          if (!response) return;
          const res = response as { status: string; links: string[] };
          if (!res.links) return;
          const newBookmarks: string[] = [];
          res.links.forEach(url => {
            if (!bookmarks.includes(url) && !newBookmarks.includes(url)) {
              newBookmarks.push(url);
            }
          });
          const updated = [...bookmarks, ...newBookmarks];
          browser.storage.local.set({ bookmarks: updated })
            .then(() => setBookmarks(updated))
            .catch(err => console.error("Error saving selection:", err));
        })
        .catch(err => console.error("Error validating selection:", err))
        .finally(() => setIsSelecting(false));
    }
  };

  // Cancel selection mode without adding bookmarks
  const handleCancelSelection = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        const tabId = tabs[0]?.id;
        if (tabId != null) {
          return browser.tabs.sendMessage(tabId, { action: "cancelSelection" });
        }
      })
      .then(() => setIsSelecting(false))
      .catch(err => console.error("Error canceling selection:", err));
  };

  return (
    <div className="popup-content">
      {/* Clear selection button at the top */}
      <button onClick={handleClearSelection} style={{ marginBottom: '10px' }}>
        Clear selection
      </button>

      <div>
        <strong>Page Status:</strong> {scrollStatus} | {activeUrl}
      </div>

      {/* Scrolling buttons: only for non-video pages and when not in select mode */}
      {isTikTokDomain && !isVideoPage && !isSelecting && scrollStatus === 'idle' && (
        <button onClick={handleStartScrolling} style={{ marginTop: '10px' }}>
          Start Scrolling
        </button>
      )}
      {isTikTokDomain && !isVideoPage && !isSelecting && scrollStatus !== 'idle' && (
        <button onClick={handleStopResume} style={{ marginTop: '10px' }}>
          {scrollStatus === 'scrolling' ? 'Stop Scrolling' : 'Resume Scrolling'}
        </button>
      )}
      {scrollStatus !== 'idle' && (
        <div style={{ marginTop: '10px' }}>
          Time until next scroll: {timeRemaining} seconds
        </div>
      )}

      {/* Bookmark buttons */}
      {isTikTokDomain && isVideoPage && !isSelecting && (
        <button onClick={handleBookmarkClick} style={{ marginTop: '10px', marginRight: '5px' }}>
          Bookmark this Tiktok
        </button>
      )}
      {isTikTokDomain && !isVideoPage && !isSelecting && (
        <>
          <button onClick={handleBookmarkAll} style={{ marginTop: '10px' }}>
            Bookmark All Videos
          </button>
          <button onClick={handleSelectModeToggle} style={{ marginTop: '10px', marginLeft: '5px' }}>
            Select mode
          </button>
        </>
      )}

      {/* When in selection mode */}
      {isSelecting && (
        <div style={{ marginTop: '10px' }}>
          <button onClick={handleSelectModeToggle} style={{ marginRight: '5px' }}>
            Validate Selection
          </button>
          <button onClick={handleCancelSelection}>
            Cancel selection
          </button>
        </div>
      )}

      <h3 style={{ marginTop: '15px' }}>Bookmarks</h3>
      {bookmarks.length === 0 && <div>No bookmarks yet.</div>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {bookmarks.map((bm, idx) => (
          <li key={idx} style={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
            <button onClick={() => handleRemoveBookmark(bm)} style={{ marginRight: '8px' }}>
              X
            </button>
            <span>{bm}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
