import * as React from 'react';
import * as ReactDOM from 'react-dom';
import browser from 'webextension-polyfill';
import './styles/popup.css';

const Popup: React.FC = () => {
  const [title, setTitle] = React.useState('Loading...');
  const [scrollStatus, setScrollStatus] = React.useState('');

  React.useEffect(() => {
    // Get the active tab and set its title
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs.length > 0 && tabs[0].title) {
          setTitle(tabs[0].title);
        }
      })
      .catch(err => {
        console.error('Error fetching tab title:', err);
        setTitle('Error fetching title');
      });
  }, []);

  const handleScrollClick = () => {
    // Query for the active tab and send a message to scroll to the bottom
    browser.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs.length > 0 && tabs[0].id) {
          return browser.tabs.sendMessage(tabs[0].id, { action: 'scrollToBottom' });
        }
      })
      .then(response => {
        console.log(response);
        setScrollStatus('Scrolling started!');
      })
      .catch(err => {
        console.error('Error sending message:', err);
        setScrollStatus('Error sending scroll command.');
      });
  };

  return (
    <div className="popup-content">
      <div>
        <strong>Page:</strong> {title}
      </div>
      <button onClick={handleScrollClick}>Scroll to Bottom</button>
      {scrollStatus && <div>{scrollStatus}</div>}
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
