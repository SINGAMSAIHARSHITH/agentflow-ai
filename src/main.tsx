import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

function mountApplication() {
  let rootElement = document.getElementById('root');
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.appendChild(rootElement);
  }

  try {
    createRoot(rootElement).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF8F6;color:#302C29;font-family:Inter,system-ui,sans-serif;padding:24px;">
        <div style="max-width:480px;width:100%;background:#FFFFFF;border:1px solid #E8E3DF;border-radius:20px;padding:28px;box-shadow:0 10px 30px rgba(48,44,41,0.08);">
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;">H1-multilevel Startup Recovery</h2>
          <p style="margin:0 0 16px;font-size:13.5px;color:#79736E;line-height:1.5;">The application encountered a startup error. Click below to clear local cache and reload.</p>
          <pre style="background:#FAF8F6;border:1px solid #E8E3DF;border-radius:12px;padding:12px;font-size:12px;color:#C96D65;overflow-x:auto;margin-bottom:16px;">${message}</pre>
          <button onclick="localStorage.removeItem('h1_agentflow_state_v2');window.location.reload();" style="background:#FFD6C2;color:#302C29;border:none;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;">Reset &amp; Reload</button>
        </div>
      </div>
    `;
  }
}

mountApplication();

