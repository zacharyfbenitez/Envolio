import React from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import './native.css';

// Native-only replacement selected by vite.native.config.js.
// No PWA install prompts or service worker: the UI ships inside the application.
export default function NativeShell({ children, go }) {
  return <div className="native-shell">
    <aside className="native-preview" role="status">Envolio development preview · flight connectivity is not configured</aside>
    {children}
    <nav className="native-dock" aria-label="App navigation">
      <button onClick={()=>history.length>1?history.back():go('/')}><ArrowLeft size={20}/>Back</button>
      <button onClick={()=>go('/')}><Search size={20}/>Find a flight</button>
    </nav>
  </div>;
}
