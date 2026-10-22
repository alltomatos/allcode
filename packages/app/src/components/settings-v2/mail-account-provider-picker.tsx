import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { Icon } from "@allcode/ui/icon"
import { For, Show, type Component } from "solid-js"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { MAIL_PROVIDERS, providerPreset, type MailProviderID } from "./mail-account-presets"

export const MailAccountProviderPicker: Component<{
  selected: MailProviderID | undefined
  onSelect: (id: MailProviderID) => void
}> = (props) => {
  const language = useLanguage()
  const platform = usePlatform()

  return (
    <div class="flex w-full min-w-0 flex-col gap-2">
      <label class="settings-v2-server-dialog-label">{language.t("settings.mcp.mail.provider.label")}</label>
      <div class="flex w-full min-w-0 flex-wrap gap-2">
        <For each={MAIL_PROVIDERS}>
          {(provider) => (
            <ButtonV2
              type="button"
              size="normal"
              variant={props.selected === provider.id ? "contrast" : "neutral"}
              class="!min-w-[88px] !flex-1 !justify-center"
              aria-pressed={props.selected === provider.id}
              onClick={() => props.onSelect(provider.id)}
            >
              {language.t(provider.labelKey)}
            </ButtonV2>
          )}
        </For>
      </div>
      <Show when={providerPreset(props.selected)}>
        {(preset) => (
          <div class="flex flex-col gap-2 rounded-md border border-v2-border-border-muted bg-v2-background-bg-layer-02 p-3 text-12-regular text-text-weak">
            <Show
              when={preset().id === "gmail"}
              fallback={<span>{language.t(preset().hintKey)}</span>}
            >
              <span class="font-medium text-text-base">{language.t("settings.mcp.mail.gmail.title")}</span>
              <ol class="flex list-decimal flex-col gap-1 pl-4">
                <li>{language.t("settings.mcp.mail.gmail.step1")}</li>
                <li>{language.t("settings.mcp.mail.gmail.step2")}</li>
                <li>{language.t("settings.mcp.mail.gmail.step3")}</li>
              </ol>
              <button
                type="button"
                class="flex w-fit cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-11-medium text-text-interactive hover:underline"
                onClick={() => platform.openExternal("https://myaccount.google.com/apppasswords")}
              >
                <span>{language.t("settings.mcp.mail.gmail.link")}</span>
                <Icon name="link" size="small" />
              </button>
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
