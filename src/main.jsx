import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.scss';
import App from './App.jsx';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
