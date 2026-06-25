import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { safeLocalStorage, safeSessionStorage } from "./lib/safeStorage";

// Detect if localStorage/sessionStorage is blocked and polyfill globally
let storageBlocked = false;
try {
  const testKey = "__storage_check_main__";
  window.localStorage.setItem(testKey, "1");
  window.localStorage.removeItem(testKey);
} catch (e) {
  storageBlocked = true;
}

if (storageBlocked) {
  console.warn("Standard storage is blocked in this environment (likely due to iframe sandbox restrictions). Polyfilling globally...");
  try {
    Object.defineProperty(window, "localStorage", {
      value: safeLocalStorage,
      writable: true,
      configurable: true
    });
  } catch (err) {
    console.error("Failed to redefine window.localStorage via Object.defineProperty", err);
    // Alternate fallback: Assign directly (some engines/browsers allow it on some window objects)
    try {
      (window as any).localStorage = safeLocalStorage;
    } catch (err2) {
      console.error("Failed direct assignment of window.localStorage", err2);
    }
  }

  try {
    Object.defineProperty(window, "sessionStorage", {
      value: safeSessionStorage,
      writable: true,
      configurable: true
    });
  } catch (err) {
    console.error("Failed to redefine window.sessionStorage via Object.defineProperty", err);
    try {
      (window as any).sessionStorage = safeSessionStorage;
    } catch (err2) {
      console.error("Failed direct assignment of window.sessionStorage", err2);
    }
  }
}

// Global cross-origin and third-party error suppressions for the iframe sandbox
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const msgLower = String(event.message || "").toLowerCase();
    const urlLower = String(event.filename || "").toLowerCase();
    const isScriptError = msgLower.includes("script error") || 
                          msgLower.includes("cross-origin") || 
                          !event.filename;
    const isExternalSource = urlLower && (
      urlLower.includes("youtube.com") || 
      urlLower.includes("ytimg.com") || 
      urlLower.includes("doubleclick.net") || 
      urlLower.includes("google") ||
      urlLower.includes("ggpht.com") ||
      urlLower.includes("gstatic.com")
    );
    if (isScriptError || isExternalSource) {
      console.warn("[Safe Sandbox] Suppressed cross-origin or third-party error:", event.message, "at", event.filename);
      try {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      } catch (e) {}
    }
  }, true);

  const originalOnerror = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const msgStr = String(message || "").toLowerCase();
    const srcStr = String(source || "").toLowerCase();
    const isScriptError = msgStr.includes("script error") || msgStr.includes("cross-origin") || !source;
    const isExternalSource = srcStr.includes("youtube.com") || 
                             srcStr.includes("ytimg.com") || 
                             srcStr.includes("doubleclick.net") || 
                             srcStr.includes("google") ||
                             srcStr.includes("ggpht.com") ||
                             srcStr.includes("gstatic.com");
    if (isScriptError || isExternalSource) {
      console.warn("[Safe Sandbox] Suppressed window.onerror script error:", message, "from", source);
      return true; // Handle and suppress the error
    }
    if (originalOnerror) {
      return originalOnerror(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener("unhandledrejection", (event) => {
    const reasonStr = event.reason ? String(event.reason.message || event.reason).toLowerCase() : "";
    if (reasonStr.includes("youtube") || 
        reasonStr.includes("yt") || 
        reasonStr.includes("script error") || 
        reasonStr.includes("google") ||
        reasonStr.includes("cross-origin")) {
      console.warn("[Safe Sandbox] Suppressed unhandled promise rejection:", reasonStr);
      try {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      } catch (e) {}
    }
  }, true);
}

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
