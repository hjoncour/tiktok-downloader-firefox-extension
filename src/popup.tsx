import * as React from 'react';
import * as ReactDOM from 'react-dom';
import browser from 'webextension-polyfill';
import './styles/popup.css';

// Regex to match TikTok video URLs, capturing @username and video ID.
const tiktokUrlRegex = /^https:\/\/www\.tiktok\.com\/(@[^/]+)\/video\/(\d+)/;

const Popup: React.FC = () => {
  const [title, setTitle] = React.useState('Loading...');
  const [activeUrl, setActiveUrl] = React.useState('');
  const [bookmarks, setBookmarks] = React.useState<string[]>([]);
  const [scrollStatus, setScrollStatus] = React.useState<'idle' | 'scrolling' | 'paused'>('idle');
  const [timeRemaining, setTimeRemaining] = React.useState(0);

  // On mount: get active tab info, load bookmarks, listen for content-script updates
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

    // 2) Load bookmarks from storage
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

    // Cleanup listener on unmount
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Start scrolling fresh
  const handleStartScrolling = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs.length > 0 && tabs[0].id) {
          return browser.tabs.sendMessage(tabs[0].id, { action: "startScrolling" });
        }
      })
      .then(() => {
        setScrollStatus('scrolling');
      })
      .catch(err => console.error("Error starting scroll:", err));
  };

  // Stop/Resume scrolling
  const handleStopResume = () => {
    if (scrollStatus === 'scrolling') {
      // Stop
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          if (tabs.length > 0 && tabs[0].id) {
            return browser.tabs.sendMessage(tabs[0].id, { action: "stopScrolling" });
          }
        })
        .then(() => {
          setScrollStatus('paused');
        })
        .catch(err => console.error("Error stopping scroll:", err));
    } else if (scrollStatus === 'paused') {
      // Resume
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          if (tabs.length > 0 && tabs[0].id) {
            return browser.tabs.sendMessage(tabs[0].id, { action: "resumeScrolling" });
          }
        })
        .then(() => {
          setScrollStatus('scrolling');
        })
        .catch(err => console.error("Error resuming scroll:", err));
    }
  };

  // Bookmark the current TikTok URL
  const handleBookmarkClick = () => {
    const match = tiktokUrlRegex.exec(activeUrl);
    if (!match) {
      alert("This page URL does not match the TikTok video pattern.");
      return;
    }
    const username = match[1];  // e.g. @oldschoolrevengance
    const videoId = match[2];   // e.g. 7455409795361803542
    const bookmarkName = `${username} - ${videoId}`;

    if (bookmarks.includes(bookmarkName)) {
      alert("This URL is already bookmarked.");
      return;
    }
    const updatedBookmarks = [...bookmarks, bookmarkName];
    browser.storage.local.set({ bookmarks: updatedBookmarks })
      .then(() => {
        setBookmarks(updatedBookmarks);
      })
      .catch(err => {
        console.error("Error saving bookmark:", err);
      });
  };

  // Delete a bookmark from the list
  const handleDeleteBookmark = (bookmark: string) => {
    const updatedBookmarks = bookmarks.filter(b => b !== bookmark);
    browser.storage.local.set({ bookmarks: updatedBookmarks })
      .then(() => {
        setBookmarks(updatedBookmarks);
      })
      .catch(err => console.error("Error deleting bookmark:", err));
  };

  return (
    <div className="popup-content">
      <div>
        <strong>Page:</strong> {title}
      </div>

      {/* Scrolling controls */}
      <div style={{ marginTop: '10px' }}>
        <button onClick={handleStartScrolling}>Start Scrolling</button>
        <button onClick={handleStopResume} style={{ marginLeft: '5px' }}>
          {scrollStatus === 'scrolling'
            ? 'Stop'
            : scrollStatus === 'paused'
            ? 'Resume'
            : 'Stop/Resume'
          }
        </button>
      </div>

      {/* Countdown display */}
      {scrollStatus !== 'idle' && (
        <div style={{ marginTop: '10px' }}>
          Time until next scroll: {timeRemaining} seconds
        </div>
      )}

      {/* Bookmarking */}
      <div style={{ marginTop: '15px' }}>
        <button onClick={handleBookmarkClick}>
          Bookmark this TikTok
        </button>
      </div>

      {/* Bookmark list */}
      <div className="bookmark-list" style={{ marginTop: '15px' }}>
        <h3>Bookmarks</h3>
        {bookmarks.length === 0 && <div>No bookmarks yet.</div>}
        <ul style={{ padding: 0, margin: 0 }}>
          {bookmarks.map((bookmark, index) => (
            <li key={index} style={{ marginBottom: '5px', listStyle: 'none', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => handleDeleteBookmark(bookmark)}
                title="Delete bookmark"
                style={{ marginRight: '5px', cursor: 'pointer' }}
              >
                X
              </button>
              <span>{bookmark}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
