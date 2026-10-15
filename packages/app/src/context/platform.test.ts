import { describe, expect, it } from "bun:test"
import { defaultPlatformCapabilities, type Platform, type PlatformCapabilities } from "./platform"

describe("PlatformCapabilities", () => {
  it("provides expected default capabilities for desktop", () => {
    const desktopPlatform: Platform = {
      platform: "desktop",
      os: "windows",
      version: "1.0.0",
      openExternal: () => {},
      restart: async () => {},
      notify: async () => {},
      openDirectoryPickerDialog: async () => null,
      capabilities: {
        canPickDirectoryNative: true,
        canOpenInLocalEditor: true,
        hasEmbeddedBrowser: true,
        hasWindowControls: true,
        supportsCustomThemes: true,
      },
    }

    expect(desktopPlatform.capabilities.canPickDirectoryNative).toBe(true)
    expect(desktopPlatform.capabilities.canOpenInLocalEditor).toBe(true)
    expect(desktopPlatform.capabilities.hasEmbeddedBrowser).toBe(true)
    expect(desktopPlatform.capabilities.hasWindowControls).toBe(true)
  })

  it("provides expected default capabilities for web", () => {
    const webPlatform: Platform = {
      platform: "web",
      version: "1.0.0",
      openExternal: () => {},
      restart: async () => {},
      notify: async () => {},
      capabilities: defaultPlatformCapabilities("web"),
    }

    expect(webPlatform.capabilities.canPickDirectoryNative).toBe(false)
    expect(webPlatform.capabilities.canOpenInLocalEditor).toBe(true)
    expect(webPlatform.capabilities.hasEmbeddedBrowser).toBe(false)
    expect(webPlatform.capabilities.hasWindowControls).toBe(false)
    expect(webPlatform.capabilities.supportsCustomThemes).toBe(true)
  })
})
