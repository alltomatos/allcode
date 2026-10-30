import { createContext, createSignal, useContext, type Accessor, type ParentProps } from "solid-js"
import { dict as ptBR } from "./pt-BR"
import { dict as ptPT } from "./pt-PT"
import { dict as en } from "./en"
import { dict as es } from "./es"

export type Locale = "pt-BR" | "pt-PT" | "en" | "es"
export type Key = keyof typeof ptBR

export const locales: Locale[] = ["pt-BR", "pt-PT", "en", "es"]

const dictionaries: Record<Locale, Record<Key, string>> = {
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  en,
  es,
}

export function localeFromDocument(): Locale {
  if (typeof document === "undefined") return "pt-BR"
  const cookieMatch = document.cookie.match(/(?:^|;\s*)panel_locale=([^;]+)/)
  if (cookieMatch) {
    const val = cookieMatch[1]
    if (val === "en" || val === "es" || val === "pt-BR" || val === "pt-PT") return val
  }
  const value = document.documentElement.lang
  if (value === "en" || value === "es" || value === "pt-BR" || value === "pt-PT") return value
  return "pt-BR"
}

function interpolate(text: string, params?: Record<string, string | number>) {
  if (!params) return text
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, raw) => {
    const value = params[String(raw)]
    return value === undefined ? "" : String(value)
  })
}

type I18n = {
  locale: Accessor<Locale>
  setLocale: (next: Locale) => void
  t: (key: Key, params?: Record<string, string | number>) => string
}

const Context = createContext<I18n>()

export function I18nProvider(props: ParentProps & { locale?: Locale }) {
  const [currentLocale, setCurrentLocale] = createSignal<Locale>(props.locale ?? localeFromDocument())

  const setLocale = (next: Locale) => {
    setCurrentLocale(next)
    if (typeof document !== "undefined") {
      document.cookie = `panel_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
      document.documentElement.lang = next
    }
  }

  const value: I18n = {
    locale: currentLocale,
    setLocale,
    t: (key, params) => interpolate(dictionaries[currentLocale()][key] ?? ptBR[key], params),
  }
  return <Context.Provider value={value}>{props.children}</Context.Provider>
}

export function useI18n() {
  const value = useContext(Context)
  if (!value) throw new Error("I18nProvider missing")
  return value
}
