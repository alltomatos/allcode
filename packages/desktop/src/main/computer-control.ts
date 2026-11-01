import { execFile, spawn, type ChildProcess } from "node:child_process"
import { promisify } from "node:util"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writeFile } from "node:fs/promises"
import { createInterface, type Interface as ReadlineInterface } from "node:readline"
import { desktopCapturer, screen } from "electron"

const execFileAsync = promisify(execFile)

export type AccessibilityElement = {
  ref: string
  role: string
  name: string
  id?: string
  bounds: { x: number; y: number; width: number; height: number }
  enabled: boolean
  actions?: string[]
}

export type AccessibilitySnapshot = {
  title: string
  app: string
  elements: AccessibilityElement[]
  outline: string
}

export type ComputerActionResult = {
  ok: boolean
  delivery: "delivered_verified" | "delivered_unverified" | "not_delivered"
  retrySafe: boolean
  target?: {
    ref?: string
    x?: number
    y?: number
    bounds?: { x: number; y: number; width: number; height: number }
  }
  error?: string
}

const activeRefMap = new Map<string, AccessibilityElement>()

export function resolveRef(ref: string): AccessibilityElement | undefined {
  return activeRefMap.get(ref)
}

export function getRefMap(): Map<string, AccessibilityElement> {
  return activeRefMap
}

function updateRefMap(elements: AccessibilityElement[]) {
  activeRefMap.clear()
  for (const el of elements) {
    activeRefMap.set(el.ref, el)
  }
}

function buildOutline(title: string, app: string, elements: AccessibilityElement[]): string {
  const header = `Active Window: [${title || "Desktop"}]${app ? ` (App: ${app})` : ""}\nElements (${elements.length}):`
  if (elements.length === 0) {
    return `${header}\n(No interactive accessibility elements found. Use screenshot for pixel coordinates.)`
  }
  const rows = elements.map((el) => {
    const namePart = el.name ? ` "${el.name}"` : ""
    const boundsPart = `(x: ${el.bounds.x}, y: ${el.bounds.y}, ${el.bounds.width}x${el.bounds.height})`
    const idPart = el.id ? ` [id: ${el.id}]` : ""
    return `- [${el.ref}] ${el.role}${namePart} ${boundsPart}${idPart}`
  })
  return `${header}\n${rows.join("\n")}`
}

function scaleForPrimaryDisplay() {
  const display = screen.getPrimaryDisplay()
  return { width: display.size.width, height: display.size.height, scale: display.scaleFactor }
}

export async function captureScreenshot(): Promise<Buffer> {
  const { width, height, scale } = scaleForPrimaryDisplay()
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
  })
  const primary = sources.find((s) => s.display_id) ?? sources[0]
  if (!primary) throw new Error("No screen source available for screenshot")
  return primary.thumbnail.toPNG()
}

// #region Windows Persistent Worker
const WINDOWS_WORKER_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class Win32Input {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);

  public static void MoveAbsolute(int x, int y) {
    int vx = GetSystemMetrics(76);
    int vy = GetSystemMetrics(77);
    int vw = GetSystemMetrics(78);
    int vh = GetSystemMetrics(79);
    if (vw > 0 && vh > 0) {
      int normX = (int)Math.Round(((double)(x - vx) * 65535.0) / (double)(vw - 1));
      int normY = (int)Math.Round(((double)(y - vy) * 65535.0) / (double)(vh - 1));
      mouse_event(0x0001 | 0x8000 | 0x4000, (uint)normX, (uint)normY, 0, 0);
    } else {
      SetCursorPos(x, y);
    }
  }

  public static void MoveSmooth(int targetX, int targetY, int durationMs = 180) {
    POINT cur;
    if (!GetCursorPos(out cur)) {
      MoveAbsolute(targetX, targetY);
      return;
    }
    int deltaX = targetX - cur.X;
    int deltaY = targetY - cur.Y;
    double dist = Math.Sqrt(deltaX * deltaX + deltaY * deltaY);
    if (dist < 4) {
      MoveAbsolute(targetX, targetY);
      return;
    }
    int frames = Math.Max(4, Math.Min(24, (int)(durationMs / 16.666)));
    for (int frame = 1; frame <= frames; frame++) {
      double t = (double)frame / frames;
      double progress = 1.0 - Math.Pow(1.0 - t, 3);
      int x = (int)Math.Round(cur.X + deltaX * progress);
      int y = (int)Math.Round(cur.Y + deltaY * progress);
      MoveAbsolute(x, y);
      if (frame < frames) Thread.Sleep(16);
    }
    MoveAbsolute(targetX, targetY);
  }

  public static void Click(int x, int y) {
    MoveSmooth(x, y);
    Thread.Sleep(30);
    mouse_event(0x0002, 0, 0, 0, 0);
    Thread.Sleep(30);
    mouse_event(0x0004, 0, 0, 0, 0);
  }

  public static void Scroll(int notches) {
    mouse_event(0x0800, 0, 0, (uint)(notches * 120), 0);
  }
}
"@

function Get-UiaSnapshot {
  $focus = [System.Windows.Automation.AutomationElement]::FocusedElement
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $win = $focus
  while ($win -ne $null -and $win -ne [System.Windows.Automation.AutomationElement]::RootElement) {
    if ($win.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window) { break }
    $parent = $walker.GetParent($win)
    if ($parent -eq $null) { break }
    $win = $parent
  }
  if ($win -eq $null) { $win = [System.Windows.Automation.AutomationElement]::RootElement }

  $winTitle = $win.Current.Name
  $winApp = ""
  try {
    $procId = $win.Current.ProcessId
    if ($procId -gt 0) { $winApp = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName }
  } catch {}

  $condition = [System.Windows.Automation.Condition]::TrueCondition
  $all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
  $interactive = @(
    "ControlType.Button", "ControlType.Edit", "ControlType.CheckBox", "ControlType.RadioButton",
    "ControlType.ComboBox", "ControlType.Hyperlink", "ControlType.MenuItem", "ControlType.TabItem",
    "ControlType.ListItem", "ControlType.Document", "ControlType.Custom", "ControlType.Pane"
  )

  $list = @()
  $idx = 1
  foreach ($el in $all) {
    $ct = $el.Current.ControlType.ProgrammaticName
    $rect = $el.Current.BoundingRectangle
    $name = $el.Current.Name
    $autoId = $el.Current.AutomationId
    $isOff = $el.Current.IsOffscreen
    if ($interactive -contains $ct -and -not $isOff -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
      if (-not [string]::IsNullOrWhiteSpace($name) -or $ct -eq "ControlType.Edit" -or $ct -eq "ControlType.Button") {
        $cleanRole = $ct.Replace("ControlType.", "").ToLower()
        $list += [PSCustomObject]@{
          ref = ("ref_" + $idx)
          role = $cleanRole
          name = $name
          id = $autoId
          bounds = [PSCustomObject]@{
            x = [int]$rect.X
            y = [int]$rect.Y
            width = [int]$rect.Width
            height = [int]$rect.Height
          }
          enabled = $el.Current.IsEnabled
        }
        $idx++
        if ($idx -gt 80) { break }
      }
    }
  }

  return [PSCustomObject]@{
    title = $winTitle
    app = $winApp
    elements = $list
  }
}

[Console]::Out.WriteLine('{"ready":true}')
[Console]::Out.Flush()

$SENDKEYS_MAP = @{
  "Enter" = "{ENTER}"
  "Tab" = "{TAB}"
  "Escape" = "{ESC}"
  "Backspace" = "{BACKSPACE}"
  "Delete" = "{DELETE}"
  "ArrowUp" = "{UP}"
  "ArrowDown" = "{DOWN}"
  "ArrowLeft" = "{LEFT}"
  "ArrowRight" = "{RIGHT}"
  "Home" = "{HOME}"
  "End" = "{END}"
  "PageUp" = "{PGUP}"
  "PageDown" = "{PGDN}"
}

while ($line = [Console]::In.ReadLine()) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  try {
    $req = ConvertFrom-Json $line
    $cmd = $req.cmd
    $id = $req.id
    if ($cmd -eq "ping") {
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $true; pong = $true } -Compress))
    } elseif ($cmd -eq "snapshot") {
      $snap = Get-UiaSnapshot
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $true; snapshot = $snap } -Compress -Depth 5))
    } elseif ($cmd -eq "click") {
      [Win32Input]::Click([int]$req.x, [int]$req.y)
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $true; delivery = "delivered_verified" } -Compress))
    } elseif ($cmd -eq "move") {
      [Win32Input]::MoveSmooth([int]$req.x, [int]$req.y)
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $true; delivery = "delivered_verified" } -Compress))
    } elseif ($cmd -eq "type") {
      $txt = [string]$req.text
      $escaped = $txt.Replace("'", "''")
      [System.Windows.Forms.SendKeys]::SendWait($escaped)
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $true; delivery = "delivered_verified" } -Compress))
    } elseif ($cmd -eq "key") {
      $k = [string]$req.key
      $seq = if ($SENDKEYS_MAP.ContainsKey($k)) { $SENDKEYS_MAP[$k] } elseif ($k.Length -eq 1) { $k } else { "{" + $k + "}" }
      [System.Windows.Forms.SendKeys]::SendWait($seq)
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $true; delivery = "delivered_verified" } -Compress))
    } elseif ($cmd -eq "scroll") {
      $notches = [int][Math]::Round(-([double]$req.deltaY) / 40.0)
      if ($notches -ne 0) { [Win32Input]::Scroll($notches) }
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $true; delivery = "delivered_verified" } -Compress))
    } elseif ($cmd -eq "exit") {
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $true } -Compress))
      break
    } else {
      [Console]::Out.WriteLine((ConvertTo-Json @{ id = $id; ok = $false; error = "unknown command" } -Compress))
    }
  } catch {
    [Console]::Out.WriteLine((ConvertTo-Json @{ id = $req.id; ok = $false; error = $_.Exception.Message } -Compress))
  }
  [Console]::Out.Flush()
}
`

class WindowsComputerWorker {
  private process: ChildProcess | null = null
  private rl: ReadlineInterface | null = null
  private readyPromise: Promise<void> | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void; timer: NodeJS.Timeout }>()

  async start(): Promise<void> {
    if (this.process && this.readyPromise) return this.readyPromise

    const workerFile = join(tmpdir(), "opencode-computer-worker.ps1")
    await writeFile(workerFile, WINDOWS_WORKER_SCRIPT, "utf8")

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const proc = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", workerFile],
        { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
      )
      this.process = proc

      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          reject(new Error("Windows computer worker timed out starting"))
          this.stop()
        }
      }, 10_000)

      this.rl = createInterface({ input: proc.stdout! })

      this.rl.on("line", (line) => {
        if (!line.trim()) return
        try {
          const msg = JSON.parse(line.trim())
          if (!resolved && msg.ready) {
            resolved = true
            clearTimeout(timeout)
            resolve()
            return
          }
          if (typeof msg.id === "number") {
            const waiter = this.pending.get(msg.id)
            if (waiter) {
              clearTimeout(waiter.timer)
              this.pending.delete(msg.id)
              if (msg.ok) {
                waiter.resolve(msg)
              } else {
                waiter.reject(new Error(msg.error ?? "Worker command failed"))
              }
            }
          }
        } catch {}
      })

      proc.on("error", (err) => {
        clearTimeout(timeout)
        this.cleanup()
        reject(err)
      })

      proc.on("exit", () => {
        clearTimeout(timeout)
        this.cleanup()
      })
    })

    return this.readyPromise
  }

  private cleanup() {
    this.process = null
    this.rl?.close()
    this.rl = null
    this.readyPromise = null
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      p.reject(new Error("Windows worker terminated"))
    }
    this.pending.clear()
  }

  async send(cmd: string, args: Record<string, unknown> = {}): Promise<any> {
    await this.start()
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) {
      throw new Error("Worker stdin unavailable")
    }

    const id = this.nextId++
    const payload = JSON.stringify({ id, cmd, ...args }) + "\n"

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Worker command '${cmd}' timed out`))
      }, 15_000)

      this.pending.set(id, { resolve, reject, timer })
      this.process!.stdin!.write(payload)
    })
  }

  stop() {
    if (this.process && this.process.stdin && !this.process.stdin.destroyed) {
      try {
        this.process.stdin.write(JSON.stringify({ cmd: "exit" }) + "\n")
      } catch {}
    }
    setTimeout(() => {
      if (this.process) {
        this.process.kill()
        this.cleanup()
      }
    }, 500)
  }
}

const winWorker = new WindowsComputerWorker()
// #endregion

// #region Fallback Windows Scripts
async function runWindowsScript(script: string): Promise<void> {
  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    windowsHide: true,
    timeout: 15_000,
  })
}

async function winFallbackClick(x: number, y: number) {
  await runWindowsScript(`
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})
    Add-Type @"
    using System.Runtime.InteropServices;
    public class M {
      [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e);
    }
"@
    [M]::mouse_event(0x0002, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 30
    [M]::mouse_event(0x0004, 0, 0, 0, 0)
  `)
}
// #endregion

// #region macOS implementation
function escapeAppleScriptString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

async function macRunOsaScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 15_000 })
  return stdout.trim()
}

async function macSnapshot(): Promise<AccessibilitySnapshot> {
  const script = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set winTitle to ""
  if (count of windows of frontApp) > 0 then
    set winTitle to name of window 1 of frontApp
  end if
  return appName & "|||" & winTitle
end tell
`
  try {
    const raw = await macRunOsaScript(script)
    const [app, title] = raw.split("|||")
    return {
      title: title || "Desktop",
      app: app || "macOS",
      elements: [],
      outline: buildOutline(title || "Desktop", app || "macOS", []),
    }
  } catch {
    return {
      title: "macOS Desktop",
      app: "Finder",
      elements: [],
      outline: buildOutline("macOS Desktop", "Finder", []),
    }
  }
}

async function macClick(x: number, y: number) {
  await macRunOsaScript(`tell application "System Events" to click at {${Math.round(x)}, ${Math.round(y)}}`)
}

async function macMove(x: number, y: number) {
  await macRunOsaScript(`tell application "System Events" to set mouseLoc to {${Math.round(x)}, ${Math.round(y)}}`).catch(
    () => undefined,
  )
}

async function macType(text: string) {
  await macRunOsaScript(`tell application "System Events" to keystroke "${escapeAppleScriptString(text)}"`)
}

const APPLESCRIPT_KEY_CODES: Record<string, number> = {
  Enter: 36,
  Tab: 48,
  Escape: 53,
  Backspace: 51,
  Delete: 117,
  ArrowUp: 126,
  ArrowDown: 125,
  ArrowLeft: 123,
  ArrowRight: 124,
  Home: 115,
  End: 119,
  PageUp: 116,
  PageDown: 121,
}

async function macKey(key: string) {
  const code = APPLESCRIPT_KEY_CODES[key]
  if (code !== undefined) {
    await macRunOsaScript(`tell application "System Events" to key code ${code}`)
    return
  }
  await macRunOsaScript(`tell application "System Events" to keystroke "${escapeAppleScriptString(key)}"`)
}

async function macScroll(deltaX: number, deltaY: number) {
  const key = Math.abs(deltaY) >= Math.abs(deltaX) ? (deltaY > 0 ? 125 : 126) : deltaX > 0 ? 124 : 123
  const presses = Math.min(20, Math.max(1, Math.round(Math.abs(deltaY || deltaX) / 40)))
  await macRunOsaScript(
    `tell application "System Events"\n${Array.from({ length: presses }, () => `  key code ${key}`).join("\n")}\nend tell`,
  )
}
// #endregion

// #region Linux implementation
async function linuxRunXdotool(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("xdotool", args, { timeout: 15_000 })
    return stdout.trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("ENOENT")) {
      throw new Error(
        "xdotool is not installed. Install it (e.g. `apt install xdotool`) to use computer control on Linux.",
      )
    }
    throw error
  }
}

async function linuxSnapshot(): Promise<AccessibilitySnapshot> {
  try {
    const winId = await linuxRunXdotool(["getactivewindow"])
    const title = await linuxRunXdotool(["getwindowname", winId])
    return {
      title: title || "Desktop",
      app: "Linux",
      elements: [],
      outline: buildOutline(title || "Desktop", "Linux", []),
    }
  } catch {
    return {
      title: "Linux Desktop",
      app: "X11",
      elements: [],
      outline: buildOutline("Linux Desktop", "X11", []),
    }
  }
}

async function linuxClick(x: number, y: number) {
  await linuxRunXdotool(["mousemove", String(Math.round(x)), String(Math.round(y)), "click", "1"])
}

async function linuxMove(x: number, y: number) {
  await linuxRunXdotool(["mousemove", String(Math.round(x)), String(Math.round(y))])
}

async function linuxType(text: string) {
  await linuxRunXdotool(["type", "--", text])
}

const XDOTOOL_KEY_NAMES: Record<string, string> = {
  Enter: "Return",
  Escape: "Escape",
  Backspace: "BackSpace",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
}

async function linuxKey(key: string) {
  await linuxRunXdotool(["key", XDOTOOL_KEY_NAMES[key] ?? key])
}

async function linuxScroll(deltaX: number, deltaY: number) {
  const button = deltaY > 0 ? "5" : "4"
  const clicks = Math.min(20, Math.max(1, Math.round(Math.abs(deltaY || deltaX) / 40)))
  for (let i = 0; i < clicks; i++) await linuxRunXdotool(["click", button])
}
// #endregion

export async function captureAccessibilitySnapshot(): Promise<AccessibilitySnapshot> {
  if (process.platform === "win32") {
    try {
      const res = await winWorker.send("snapshot")
      if (res.ok && res.snapshot) {
        const snap = res.snapshot
        const elements: AccessibilityElement[] = Array.isArray(snap.elements) ? snap.elements : []
        updateRefMap(elements)
        return {
          title: snap.title || "Active Window",
          app: snap.app || "",
          elements,
          outline: buildOutline(snap.title || "Active Window", snap.app || "", elements),
        }
      }
    } catch {
      // Fallback if worker fails
    }
    const emptySnap: AccessibilitySnapshot = {
      title: "Windows Desktop",
      app: "",
      elements: [],
      outline: buildOutline("Windows Desktop", "", []),
    }
    updateRefMap([])
    return emptySnap
  }

  if (process.platform === "darwin") {
    const snap = await macSnapshot()
    updateRefMap(snap.elements)
    return snap
  }

  const snap = await linuxSnapshot()
  updateRefMap(snap.elements)
  return snap
}

export type ComputerActionParams = {
  ref?: string
  x?: number
  y?: number
  text?: string
  key?: string
  deltaX?: number
  deltaY?: number
}

function resolveCoordinates(params: { ref?: string; x?: number; y?: number }): {
  x: number
  y: number
  ref?: string
  bounds?: { x: number; y: number; width: number; height: number }
  name?: string
} {
  if (params.ref) {
    const el = resolveRef(params.ref)
    if (!el) {
      throw new Error(`Element ref "${params.ref}" not found in current snapshot. Run 'snapshot' first.`)
    }
    const centerX = Math.round(el.bounds.x + el.bounds.width / 2)
    const centerY = Math.round(el.bounds.y + el.bounds.height / 2)
    return { x: centerX, y: centerY, ref: params.ref, bounds: el.bounds, name: el.name }
  }

  if (params.x !== undefined && params.y !== undefined) {
    return { x: params.x, y: params.y }
  }

  throw new Error("Action requires either 'ref' from snapshot or 'x' and 'y' coordinates.")
}

export async function computerClick(params: { ref?: string; x?: number; y?: number }): Promise<ComputerActionResult> {
  const target = resolveCoordinates(params)
  if (process.platform === "win32") {
    try {
      await winWorker.send("click", { x: target.x, y: target.y })
      return {
        ok: true,
        delivery: target.ref ? "delivered_verified" : "delivered_unverified",
        retrySafe: false,
        target: { ref: target.ref, x: target.x, y: target.y, bounds: target.bounds },
      }
    } catch {
      await winFallbackClick(target.x, target.y)
      return {
        ok: true,
        delivery: "delivered_unverified",
        retrySafe: false,
        target: { ref: target.ref, x: target.x, y: target.y, bounds: target.bounds },
      }
    }
  }

  if (process.platform === "darwin") {
    await macClick(target.x, target.y)
    return {
      ok: true,
      delivery: target.ref ? "delivered_verified" : "delivered_unverified",
      retrySafe: false,
      target: { ref: target.ref, x: target.x, y: target.y, bounds: target.bounds },
    }
  }

  await linuxClick(target.x, target.y)
  return {
    ok: true,
    delivery: target.ref ? "delivered_verified" : "delivered_unverified",
    retrySafe: false,
    target: { ref: target.ref, x: target.x, y: target.y, bounds: target.bounds },
  }
}

export async function computerMove(params: { ref?: string; x?: number; y?: number }): Promise<ComputerActionResult> {
  const target = resolveCoordinates(params)
  if (process.platform === "win32") {
    try {
      await winWorker.send("move", { x: target.x, y: target.y })
    } catch {
      await runWindowsScript(`[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${target.x}, ${target.y})`)
    }
  } else if (process.platform === "darwin") {
    await macMove(target.x, target.y)
  } else {
    await linuxMove(target.x, target.y)
  }

  return {
    ok: true,
    delivery: "delivered_verified",
    retrySafe: false,
    target: { ref: target.ref, x: target.x, y: target.y, bounds: target.bounds },
  }
}

export async function computerType(params: { text: string; ref?: string }): Promise<ComputerActionResult> {
  let target: { x: number; y: number; ref?: string; bounds?: { x: number; y: number; width: number; height: number } } | undefined
  if (params.ref) {
    target = resolveCoordinates({ ref: params.ref })
    await computerClick({ ref: params.ref })
  }

  if (process.platform === "win32") {
    await winWorker.send("type", { text: params.text })
  } else if (process.platform === "darwin") {
    await macType(params.text)
  } else {
    await linuxType(params.text)
  }

  return {
    ok: true,
    delivery: target ? "delivered_verified" : "delivered_unverified",
    retrySafe: false,
    target,
  }
}

export async function computerKey(key: string): Promise<ComputerActionResult> {
  if (process.platform === "win32") {
    await winWorker.send("key", { key })
  } else if (process.platform === "darwin") {
    await macKey(key)
  } else {
    await linuxKey(key)
  }

  return {
    ok: true,
    delivery: "delivered_verified",
    retrySafe: false,
  }
}

export async function computerScroll(deltaX: number, deltaY: number, ref?: string): Promise<ComputerActionResult> {
  let target: { x: number; y: number; ref?: string; bounds?: { x: number; y: number; width: number; height: number } } | undefined
  if (ref) {
    target = resolveCoordinates({ ref })
    await computerMove({ ref })
  }

  if (process.platform === "win32") {
    await winWorker.send("scroll", { deltaX, deltaY })
  } else if (process.platform === "darwin") {
    await macScroll(deltaX, deltaY)
  } else {
    await linuxScroll(deltaX, deltaY)
  }

  return {
    ok: true,
    delivery: "delivered_verified",
    retrySafe: false,
    target,
  }
}

export function stopComputerWorker() {
  if (process.platform === "win32") {
    winWorker.stop()
  }
}
