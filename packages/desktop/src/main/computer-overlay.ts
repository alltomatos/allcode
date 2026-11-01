import { BrowserWindow, screen } from "electron"

let overlayWindow: BrowserWindow | null = null

const OVERLAY_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: transparent;
      border: 4px solid #ef4444;
      box-shadow: inset 0 0 20px rgba(239, 68, 68, 0.55), 0 0 10px rgba(239, 68, 68, 0.4);
      pointer-events: none;
    }
    .status-badge {
      position: absolute;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(239, 68, 68, 0.92);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      padding: 5px 14px;
      border-radius: 9999px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25), 0 0 8px rgba(239, 68, 68, 0.6);
      display: flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      animation: pulse 2s infinite ease-in-out;
    }
    .dot {
      width: 6px;
      height: 6px;
      background-color: #ffffff;
      border-radius: 50%;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.95; transform: translateX(-50%) scale(1); }
      50% { opacity: 0.75; transform: translateX(-50%) scale(0.98); }
    }
    .target-highlight {
      position: absolute;
      pointer-events: none;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.16);
      box-shadow: 0 0 14px rgba(59, 130, 246, 0.85), inset 0 0 10px rgba(59, 130, 246, 0.45);
      border-radius: 4px;
      transition: opacity 0.2s ease-out;
      z-index: 10000;
      display: none;
    }
    .target-label {
      position: absolute;
      top: -22px;
      left: 0;
      background: #2563eb;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      display: none;
    }
  </style>
</head>
<body>
  <div class="status-badge">
    <div class="dot"></div>
    <span>Controle do Computador Ativo</span>
  </div>
  <div id="target-highlight" class="target-highlight">
    <span id="target-label" class="target-label"></span>
  </div>
  <script>
    window.overlayOffsetX = 0;
    window.overlayOffsetY = 0;
    let fadeTimer = null;
    window.setHighlight = function(rect, label) {
      const el = document.getElementById('target-highlight');
      const txt = document.getElementById('target-label');
      if (!el || !rect) return;
      if (fadeTimer) clearTimeout(fadeTimer);
      const offsetX = window.overlayOffsetX || 0;
      const offsetY = window.overlayOffsetY || 0;
      el.style.left = (rect.x - offsetX) + 'px';
      el.style.top = (rect.y - offsetY) + 'px';
      el.style.width = Math.max(8, rect.width) + 'px';
      el.style.height = Math.max(8, rect.height) + 'px';
      el.style.display = 'block';
      el.style.opacity = '1';
      if (txt) {
        if (label) {
          txt.textContent = label;
          txt.style.display = 'block';
        } else {
          txt.style.display = 'none';
        }
      }
      fadeTimer = setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => { el.style.display = 'none'; }, 250);
      }, 1600);
    };
    window.clearHighlight = function() {
      const el = document.getElementById('target-highlight');
      if (el) el.style.display = 'none';
    };
  </script>
</body>
</html>`

function getVirtualScreenBounds() {
  const displays = screen.getAllDisplays()
  if (displays.length === 0) return { x: 0, y: 0, width: 1920, height: 1080 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x)
    minY = Math.min(minY, d.bounds.y)
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width)
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function showComputerOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive()
    return
  }

  const bounds = getVirtualScreenBounds()

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Permite que cliques e eventos passem diretamente através da janela de overlay
  overlayWindow.setIgnoreMouseEvents(true)
  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(OVERLAY_HTML)}`)

  overlayWindow.once("ready-to-show", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    overlayWindow.webContents
      .executeJavaScript(`window.overlayOffsetX = ${bounds.x}; window.overlayOffsetY = ${bounds.y};`)
      .catch(() => undefined)
    overlayWindow.showInactive()
  })

  overlayWindow.on("closed", () => {
    overlayWindow = null
  })
}

export function highlightOverlayElement(
  rect: { x: number; y: number; width: number; height: number },
  label?: string,
) {
  showComputerOverlay()
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents
      .executeJavaScript(`window.setHighlight(${JSON.stringify(rect)}, ${JSON.stringify(label ?? "")})`)
      .catch(() => undefined)
  }
}

export function clearOverlayHighlight() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.executeJavaScript(`window.clearHighlight()`).catch(() => undefined)
  }
}

export function hideComputerOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
    overlayWindow = null
  }
}
