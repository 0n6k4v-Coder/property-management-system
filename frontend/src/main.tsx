// File: src/main.tsx
// Application entry point — mounts the React root with the provider chain.
// Provider chain: BrowserRouter → QueryClientProvider → ToastProvider → AuthProvider → AppRoutes
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);