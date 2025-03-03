import * as React from 'react';
import * as ReactDOM from 'react-dom';
import browser from 'webextension-polyfill';
import './styles/popup.css';

// Regex to match TikTok video URLs
const tiktokUrlRegex = /^https:\/\/www\.tiktok\.com\/(@[^/]+)\/video\/(\d+)/;

const Popup: React.FC = () => {
  const [title, setTitle] = React.useState('Loading...');
  const [activeUrl, setActiveUrl] = React.useState('');
  const [bookmarks, setBookmarks] = React.useState<string[]>([]);
  const [scrollStatus, setScrollStatus] = React.useState<'idle' | 'scrolling' | 'paused'>('idle');
  const [timeRemaining, setTimeRemaining] = React.useState(0);

  React.useEffect(() => {
    // 1) Get active tab
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

    // 3) Listen for timeRemaining updates from content script
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

  // Start scrolling
  const handleStartScrolling = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs[0]?.id != null) {
          return browser.tabs.sendMessage(tabs[0].id, { action: "startScrolling" });
        }
      })
      .then(() => setScrollStatus('scrolling'))
      .catch(err => console.error("Error starting scroll:", err));
  };

  // Stop or Resume scrolling
  const handleStopResume = () => {
    if (scrollStatus === 'scrolling') {
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          if (tabs[0]?.id != null) {
            return browser.tabs.sendMessage(tabs[0].id, { action: "stopScrolling" });
          }
        })
        .then(() => setScrollStatus('paused'))
        .catch(err => console.error("Error stopping scroll:", err));
    } else if (scrollStatus === 'paused') {
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          if (tabs[0]?.id != null) {
            return browser.tabs.sendMessage(tabs[0].id, { action: "resumeScrolling" });
          }
        })
        .then(() => setScrollStatus('scrolling'))
        .catch(err => console.error("Error resuming scroll:", err));
    }
  };

  // Bookmark the current page if it matches the pattern
  const handleBookmarkClick = () => {
    const match = tiktokUrlRegex.exec(activeUrl);
    if (!match) {
      alert("This page URL does not match the TikTok video pattern.");
      return;
    }
    const [_, username, videoId] = match;
    const bookmarkName = `${username} - ${videoId}`;
    if (bookmarks.includes(bookmarkName)) {
      alert("This URL is already bookmarked.");
      return;
    }
    const updated = [...bookmarks, bookmarkName];
    browser.storage.local.set({ bookmarks: updated })
      .then(() => setBookmarks(updated))
      .catch(err => console.error("Error saving bookmark:", err));
  };

  // "Bookmark All Videos" approach
  const handleBookmarkAll = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs[0]?.id != null) {
          return browser.tabs.sendMessage(tabs[0].id, { action: "collectAllVideoLinks" });
        }
      })
      .then(response => {
        if (!response) return;
        const res = response as { links: string[] };
        if (!res.links) return;

        const newBookmarks: string[] = [];
        res.links.forEach(url => {
          const m = tiktokUrlRegex.exec(url);
          if (m) {
            const [_, username, videoId] = m;
            const bm = `${username} - ${videoId}`;
            if (!bookmarks.includes(bm) && !newBookmarks.includes(bm)) {
              newBookmarks.push(bm);
            }
          }
        });
        const updated = [...bookmarks, ...newBookmarks];
        browser.storage.local.set({ bookmarks: updated })
          .then(() => setBookmarks(updated))
          .catch(err => console.error("Error saving all bookmarks:", err));
      })
      .catch(err => console.error("Error collecting video links:", err));
  };

  // NEW: Start selection mode
  const handleSelectBookmarks = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs[0]?.id != null) {
          return browser.tabs.sendMessage(tabs[0].id, { action: "startSelectionMode" });
        }
      })
      .catch(err => console.error("Error starting selection mode:", err));
  };

  // NEW: Validate selection => get all selected links, add to bookmarks
  const handleValidateSelection = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs[0]?.id != null) {
          return browser.tabs.sendMessage(tabs[0].id, { action: "validateSelection" });
        }
      })
      .then(response => {
        if (!response) return;
        const res = response as { status: string; links: string[] };
        if (!res.links) return;

        const newBookmarks: string[] = [];
        res.links.forEach(url => {
          const m = tiktokUrlRegex.exec(url);
          if (m) {
            const [_, username, videoId] = m;
            const bm = `${username} - ${videoId}`;
            if (!bookmarks.includes(bm) && !newBookmarks.includes(bm)) {
              newBookmarks.push(bm);
            }
          }
        });
        const updated = [...bookmarks, ...newBookmarks];
        browser.storage.local.set({ bookmarks: updated })
          .then(() => setBookmarks(updated))
          .catch(err => console.error("Error saving selection:", err));
      })
      .catch(err => console.error("Error validating selection:", err));
  };

  // Delete a bookmark from the list
  const handleDelete = (bm: string) => {
    const updated = bookmarks.filter(b => b !== bm);
    browser.storage.local.set({ bookmarks: updated })
      .then(() => setBookmarks(updated))
      .catch(err => console.error("Error deleting bookmark:", err));
  };

  return (
    <div className="popup-content">
      <div><strong>Page:</strong> {title}</div>

      {/* Scrolling */}
      <div style={{ marginTop: '10px' }}>
        <button onClick={handleStartScrolling}>Start Scrolling</button>
        <button onClick={handleStopResume} style={{ marginLeft: '5px' }}>
          {scrollStatus === 'scrolling' ? 'Stop' 
            : scrollStatus === 'paused' ? 'Resume' 
            : 'Stop/Resume'}
        </button>
      </div>
      {scrollStatus !== 'idle' && (
        <div style={{ marginTop: '10px' }}>
          Time until next scroll: {timeRemaining} seconds
        </div>
      )}

      {/* Bookmarking */}
      <div style={{ marginTop: '15px' }}>
        <button onClick={handleBookmarkClick}>Bookmark this TikTok</button>
        <button onClick={handleBookmarkAll} style={{ marginLeft: '5px' }}>
          Bookmark All Videos
        </button>
      </div>

      {/* NEW: Selection Mode */}
      <div style={{ marginTop: '15px' }}>
        <button onClick={handleSelectBookmarks}>Select bookmarks</button>
        <button onClick={handleValidateSelection} style={{ marginLeft: '5px' }}>
          Validate selection
        </button>
      </div>

      {/* Bookmarks list */}
      <div style={{ marginTop: '15px' }}>
        <h3>Bookmarks</h3>
        {bookmarks.length === 0 && <div>No bookmarks yet.</div>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {bookmarks.map((bm, i) => (
            <li key={i} style={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
              <button onClick={() => handleDelete(bm)} style={{ marginRight: '8px' }}>
                X
              </button>
              <span>{bm}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
