export type MailProviderID = "gmail" | "outlook" | "cpanel" | "speedmail" | "zimbra"
export type MailProviderTag = "gmail" | "outlook" | "speedmail" | "generic-imap"

type MailProviderLabelKey =
  | "settings.mcp.mail.provider.gmail"
  | "settings.mcp.mail.provider.outlook"
  | "settings.mcp.mail.provider.cpanel"
  | "settings.mcp.mail.provider.speedmail"
  | "settings.mcp.mail.provider.zimbra"

type MailProviderHintKey =
  | "settings.mcp.mail.gmail.title"
  | "settings.mcp.mail.hint.outlook"
  | "settings.mcp.mail.hint.cpanel"
  | "settings.mcp.mail.hint.speedmail"
  | "settings.mcp.mail.hint.zimbra"

type ServerSettings = { host: string; port: number; secure: boolean }

export type MailProviderPreset = {
  id: MailProviderID
  tag: MailProviderTag
  labelKey: MailProviderLabelKey
  hintKey: MailProviderHintKey
  imap?: ServerSettings
  smtp?: ServerSettings
}

export const MAIL_PROVIDERS: readonly MailProviderPreset[] = [
  {
    id: "gmail",
    tag: "gmail",
    labelKey: "settings.mcp.mail.provider.gmail",
    hintKey: "settings.mcp.mail.gmail.title",
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    smtp: { host: "smtp.gmail.com", port: 587, secure: false },
  },
  {
    id: "outlook",
    tag: "outlook",
    labelKey: "settings.mcp.mail.provider.outlook",
    hintKey: "settings.mcp.mail.hint.outlook",
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
  },
  {
    id: "cpanel",
    tag: "generic-imap",
    labelKey: "settings.mcp.mail.provider.cpanel",
    hintKey: "settings.mcp.mail.hint.cpanel",
  },
  {
    id: "speedmail",
    tag: "speedmail",
    labelKey: "settings.mcp.mail.provider.speedmail",
    hintKey: "settings.mcp.mail.hint.speedmail",
  },
  {
    id: "zimbra",
    tag: "generic-imap",
    labelKey: "settings.mcp.mail.provider.zimbra",
    hintKey: "settings.mcp.mail.hint.zimbra",
  },
]

export function providerPreset(id: MailProviderID | undefined) {
  return MAIL_PROVIDERS.find((provider) => provider.id === id)
}

export type MailAccountFields = {
  host: string
  port: string
  secure: boolean
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
}

export function providerFields(preset: MailProviderPreset): MailAccountFields {
  return {
    host: preset.imap?.host ?? "",
    port: String(preset.imap?.port ?? 993),
    secure: preset.imap?.secure ?? true,
    smtpEnabled: Boolean(preset.smtp),
    smtpHost: preset.smtp?.host ?? "",
    smtpPort: String(preset.smtp?.port ?? 587),
    smtpSecure: preset.smtp?.secure ?? false,
  }
}

export function inferProviderTag(host: string): MailProviderTag {
  const value = host.toLowerCase()
  if (value.includes("gmail") || value.includes("google")) return "gmail"
  if (value.includes("speedmail")) return "speedmail"
  if (value.includes("outlook") || value.includes("office365") || value.includes("hotmail") || value.includes("live.com"))
    return "outlook"
  return "generic-imap"
}

export function detectProviderPreset(account: { provider: string; host: string }) {
  const provider = account.provider.toLowerCase()
  if (provider === "gmail" || provider === "outlook" || provider === "speedmail") return provider
  if (provider !== "generic-imap" && provider !== "generic") return undefined
  const host = account.host.toLowerCase()
  if (host.includes("gmail") || host.includes("google")) return "gmail"
  if (host.includes("outlook") || host.includes("office365") || host.includes("hotmail") || host.includes("live.com"))
    return "outlook"
  if (host.includes("speedmail")) return "speedmail"
  return undefined
}
