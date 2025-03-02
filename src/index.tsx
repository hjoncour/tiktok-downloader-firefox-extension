import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';

// Create a container element and style it as a banner.
const container = document.createElement('div');
container.id = 'page-name-extension-container';
container.style.position = 'fixed';
container.style.bottom = '0';
container.style.left = '0';
container.style.right = '0';
container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
container.style.color = 'white';
container.style.fontSize = '16px';
container.style.padding = '10px';
container.style.zIndex = '10000';

document.body.appendChild(container);

// Render the React App into the container.
ReactDOM.render(<App />, container);
