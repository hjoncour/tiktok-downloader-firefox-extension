import * as React from 'react';
import * as ReactDOM from 'react-dom';
import browser from 'webextension-polyfill';
import './styles/popup.css';

// Regex to match TikTok video URLs.
const tiktokUrlRegex = /^https:\/\/www\.tiktok\.com\/.+\/video\/\d+/;

const Popup: React.FC = () => {
  const [title, setTitle] = React.useState('Loading...');
  const [scrollStatus, setScrollStatus] = React.useState('');
  const [activeUrl, setActiveUrl] = React.useState('');
  const [bookmarks, setBookmarks] = React.useState<string[]>([]);

  // On mount: get active tab info and load bookmarks from storage.
  React.useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs.length > 0) {
          const tab = tabs[0];
          if (tab.title) {
            setTitle(tab.title);
          }
          if (tab.url) {
            setActiveUrl(tab.url);
          }
        }
      })
      .catch(err => {
        console.error('Error fetching tab info:', err);
        setTitle('Error fetching title');
      });

    browser.storage.local.get("bookmarks")
      .then(data => {
        if (data.bookmarks && Array.isArray(data.bookmarks)) {
          setBookmarks(data.bookmarks);
        }
      })
      .catch(err => {
        console.error("Error loading bookmarks:", err);
      });
  }, []);

  // Handler for scrolling
  const handleScrollClick = () => {
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs.length > 0 && tabs[0].id) {
          return browser.tabs.sendMessage(tabs[0].id, { action: "scrollToBottom" });
        }
      })
      .then(response => {
        console.log("Response from content script:", response);
        setScrollStatus("Scrolling started!");
      })
      .catch(err => {
        console.error("Error sending scroll command:", err);
        setScrollStatus("Error sending scroll command.");
      });
  };

  // Handler for bookmarking the active URL if it matches the TikTok video pattern.
  const handleBookmarkClick = () => {
    if (!activeUrl.match(tiktokUrlRegex)) {
      alert("This page URL does not match the TikTok video pattern.");
      return;
    }
    if (bookmarks.includes(activeUrl)) {
      alert("This URL is already bookmarked.");
      return;
    }
    const updatedBookmarks = [...bookmarks, activeUrl];
    browser.storage.local.set({ bookmarks: updatedBookmarks })
      .then(() => {
        setBookmarks(updatedBookmarks);
      })
      .catch(err => {
        console.error("Error saving bookmark:", err);
      });
  };

  // Handler for deleting a bookmark.
  const handleDeleteBookmark = (urlToDelete: string) => {
    const updatedBookmarks = bookmarks.filter(url => url !== urlToDelete);
    browser.storage.local.set({ bookmarks: updatedBookmarks })
      .then(() => {
        setBookmarks(updatedBookmarks);
      })
      .catch(err => {
        console.error("Error deleting bookmark:", err);
      });
  };

  return (
    <div className="popup-content">
      <div>
        <strong>Page:</strong> {title}
      </div>
      <div className="buttons">
        <button onClick={handleScrollClick}>Scroll to Bottom</button>
        <button onClick={handleBookmarkClick} title="Bookmark this video" className="bookmark-button">
          {/* Bookmark Icon SVG */}
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M6 2a2 2 0 0 0-2 2v18l8-5.333L20 22V4a2 2 0 0 0-2-2z" fill="currentColor"></path>
          </svg>
        </button>
      </div>
      {scrollStatus && <div>{scrollStatus}</div>}
      <div className="bookmark-list">
        <h3>Bookmarks</h3>
        {bookmarks.length === 0 && <div>No bookmarks yet.</div>}
        <ul>
          {bookmarks.map((url, index) => (
            <li key={index}>
              <button onClick={() => handleDeleteBookmark(url)} className="delete-button" title="Delete bookmark">
                {/* Cross Icon SVG */}
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2"/>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
