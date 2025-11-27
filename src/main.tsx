import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import App from './App';
import { convexClient } from './lib/convex';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ConvexAuthProvider client={convexClient}>
      <App />
    </ConvexAuthProvider>
  </React.StrictMode>
);