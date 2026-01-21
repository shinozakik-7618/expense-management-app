import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

document.body.insertAdjacentHTML(
  "afterbegin",
  "<div style=\"position:fixed;top:8px;left:8px;z-index:99999;background:#fffb;padding:6px 10px;border:1px solid #333;font:14px/1.3 monospace\">BOOT OK</div>"
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
