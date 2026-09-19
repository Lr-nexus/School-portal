import { Buffer } from 'buffer';
import process from 'process';

window.Buffer = Buffer;
window.process = process;
window.global = window;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);