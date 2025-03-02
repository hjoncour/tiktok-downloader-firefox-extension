import * as React from 'react';
import * as ReactDOM from 'react-dom';
import browser from 'webextension-polyfill';
import './styles/popup.css';

const Popup: React.FC = () => {
  const [title, setTitle] = React.useState('Loading...');

  React.useEffect(() => {
    browser.tabs
      .query({ active: true, currentWindow: true })
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

  return (
    <div className="popup-content">
      <strong>Page:</strong> {title}
    </div>
  );
};

ReactDOM.render(<Popup />, document.getElementById('root'));
