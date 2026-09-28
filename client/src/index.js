import { Buffer } from 'buffer';
import process from 'process';

window.Buffer = Buffer;
window.process = process;
window.global = window;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';

/* Register the push service worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('✅ Service worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err.message);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);