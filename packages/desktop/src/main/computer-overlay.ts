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
  </style>
</head>
<body>
  <div class="status-badge">
    <div class="dot"></div>
    <span>Controle do Computador Ativo</span>
  </div>
</body>
</html>`

export function showComputerOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive()
    return
  }

  const primary = screen.getPrimaryDisplay()
  const { x, y, width, height } = primary.bounds

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
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
    overlayWindow?.showInactive()
  })

  overlayWindow.on("closed", () => {
    overlayWindow = null
  })
}

export function hideComputerOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
    overlayWindow = null
  }
}
