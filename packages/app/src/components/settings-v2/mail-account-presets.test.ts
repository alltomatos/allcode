import { describe, expect, test } from "bun:test"
import {
  detectProviderPreset,
  inferProviderTag,
  MAIL_PROVIDERS,
  providerFields,
  providerPreset,
} from "./mail-account-presets"

describe("mail provider presets", () => {
  test("exposes the five supported providers", () => {
    expect(MAIL_PROVIDERS.map((provider) => provider.id)).toEqual([
      "gmail",
      "outlook",
      "cpanel",
      "speedmail",
      "zimbra",
    ])
  })

  test("fills the known servers for gmail and outlook", () => {
    expect(providerFields(providerPreset("gmail")!)).toEqual({
      host: "imap.gmail.com",
      port: "993",
      secure: true,
      smtpEnabled: true,
      smtpHost: "smtp.gmail.com",
      smtpPort: "587",
      smtpSecure: false,
    })
    expect(providerFields(providerPreset("outlook")!)).toEqual({
      host: "outlook.office365.com",
      port: "993",
      secure: true,
      smtpEnabled: true,
      smtpHost: "smtp.office365.com",
      smtpPort: "587",
      smtpSecure: false,
    })
  })

  test("keeps the fields editable for custom servers", () => {
    for (const id of ["cpanel", "speedmail", "zimbra"] as const) {
      expect(providerFields(providerPreset(id)!)).toEqual({
        host: "",
        port: "993",
        secure: true,
        smtpEnabled: false,
        smtpHost: "",
        smtpPort: "587",
        smtpSecure: false,
      })
    }
  })

  test("maps custom servers to the provider tag expected by mcpmail", () => {
    expect(providerPreset("cpanel")!.tag).toBe("generic-imap")
    expect(providerPreset("zimbra")!.tag).toBe("generic-imap")
    expect(providerPreset("speedmail")!.tag).toBe("speedmail")
    expect(providerPreset("gmail")!.tag).toBe("gmail")
    expect(providerPreset("outlook")!.tag).toBe("outlook")
  })
})

describe("provider detection", () => {
  test("infers the provider tag from the host", () => {
    expect(inferProviderTag("imap.gmail.com")).toBe("gmail")
    expect(inferProviderTag("imap-mail.outlook.com")).toBe("outlook")
    expect(inferProviderTag("smtp.speedmail.com.br")).toBe("speedmail")
    expect(inferProviderTag("mail.exemplo.com.br")).toBe("generic-imap")
  })

  test("detects the preset of a stored account", () => {
    expect(detectProviderPreset({ provider: "gmail", host: "imap.gmail.com" })).toBe("gmail")
    expect(detectProviderPreset({ provider: "outlook", host: "outlook.office365.com" })).toBe("outlook")
    expect(detectProviderPreset({ provider: "speedmail", host: "imap.speedmail.com.br" })).toBe("speedmail")
    expect(detectProviderPreset({ provider: "generic-imap", host: "mail.exemplo.com.br" })).toBeUndefined()
    expect(detectProviderPreset({ provider: "generic-imap", host: "imap.gmail.com" })).toBe("gmail")
  })
})
