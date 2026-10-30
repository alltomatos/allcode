import { createAsync, revalidate, useAction } from "@solidjs/router"
import { Show, createSignal } from "solid-js"
import { Button, Card, Field, PageHeader, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getSettings, requireMe, updateSettings } from "~/lib/actions"

export default function SettingsPage() {
  const i18n = useI18n()
  const actor = createAsync(() => requireMe())
  const settings = createAsync(() => getSettings())
  const update = useAction(updateSettings)
  const [error, setError] = createSignal<string | null>(null)
  const [saved, setSaved] = createSignal(false)
  const [pending, setPending] = createSignal(false)
  const [uploading, setUploading] = createSignal(false)
  const [logoUrl, setLogoUrl] = createSignal("")

  async function onUploadFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload-logo", {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string }
      if (data.ok && data.url) {
        setLogoUrl(data.url)
      } else {
        setError(data.error || "Falha ao enviar arquivo")
      }
    } catch (err: any) {
      setError(err?.message || "Erro de rede no upload")
    } finally {
      setUploading(false)
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    setPending(true)
    setSaved(false)
    const result = await update(new FormData(form))
    setPending(false)
    if (result?.error) {
      setError(i18n.t(result.error))
      return
    }
    setError(null)
    setSaved(true)
    revalidate("panel.settings")
    revalidate("panel.audit")
  }

  return (
    <div>
      <PageHeader title={i18n.t("settings.title")} subtitle={i18n.t("settings.subtitle")} />

      <Show when={settings()} fallback={<p class="text-sm text-slate-500">{i18n.t("common.loading")}</p>}>
        {(current) => {
          if (!logoUrl() && current().logoUrl) {
            setLogoUrl(current().logoUrl!)
          }
          return (
            <Card class="max-w-3xl">
              <Show when={actor()?.role !== "owner"}>
                <div class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                  {i18n.t("settings.ownerOnly")}
                </div>
              </Show>

              <form onSubmit={submit} class="space-y-6">
                {/* Seção 1: Dados Gerais */}
                <div>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    {i18n.t("settings.org")}
                  </h3>
                  <div class="space-y-4">
                    <Field
                      label={i18n.t("settings.name")}
                      name="name"
                      value={current().name}
                      disabled={actor()?.role !== "owner"}
                      required
                    />
                    <div class="grid gap-4 sm:grid-cols-2">
                      <Field
                        label={i18n.t("settings.offlineGrace")}
                        name="offlineGraceHours"
                        type="number"
                        value={String(current().offlineGraceHours)}
                        disabled={actor()?.role !== "owner"}
                      />
                      <Field
                        label={i18n.t("settings.sessionMaxAge")}
                        name="sessionMaxAgeHours"
                        type="number"
                        value={String(current().sessionMaxAgeHours)}
                        disabled={actor()?.role !== "owner"}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 2: Identidade Visual e AllCode Desktop Banner */}
                <div class="border-t border-slate-100 pt-5">
                  <div class="flex items-center justify-between mb-1">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">
                      🎨 {i18n.t("settings.branding")}
                    </h3>
                    <span class="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      Desktop Sync
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mb-4">
                    Personalize como os seus colaboradores verão o banner ao iniciar sessão no AllCode Desktop.
                  </p>

                  <div class="space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div>
                      <Field
                        label={i18n.t("settings.logoUrl")}
                        name="logoUrl"
                        value={logoUrl()}
                        onInput={(e) => setLogoUrl(e.currentTarget.value)}
                        placeholder="https://.../logo.png ou carregue abaixo"
                        disabled={actor()?.role !== "owner"}
                      />
                      <div class="mt-2 flex items-center gap-3">
                        <label class="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 cursor-pointer shadow-2xs">
                          <span>📁 {uploading() ? i18n.t("common.loading") : i18n.t("settings.logoUpload")}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            class="hidden"
                            disabled={uploading() || actor()?.role !== "owner"}
                            onChange={onUploadFile}
                          />
                        </label>
                        <span class="text-[11px] text-slate-400">{i18n.t("settings.logoUploadHint")}</span>
                      </div>
                    </div>

                    {/* Pré-visualização da Logo */}
                    <Show when={logoUrl()}>
                      <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div class="grid size-12 place-items-center rounded-lg border border-slate-100 bg-slate-50 p-1">
                          <img src={logoUrl()} alt="Logo Preview" class="max-h-full max-w-full object-contain" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="text-xs font-medium text-slate-900">Pré-visualização da Logo da Empresa</div>
                          <div class="truncate font-mono text-[11px] text-slate-400">{logoUrl()}</div>
                        </div>
                      </div>
                    </Show>

                    <div>
                      <Field
                        label={i18n.t("settings.welcomeMessage")}
                        name="welcomeMessage"
                        value={current().welcomeMessage || ""}
                        placeholder="Ex: Olá equipa! Usem as vossas contas da empresa para aceder aos modelos homologados."
                        hint={i18n.t("settings.welcomeMessageHint")}
                        disabled={actor()?.role !== "owner"}
                      />
                    </div>

                    <div>
                      <Field
                        label={i18n.t("settings.brandColor")}
                        name="brandColor"
                        type="text"
                        value={current().brandColor || "#10b981"}
                        placeholder="#10b981"
                        disabled={actor()?.role !== "owner"}
                      />
                    </div>
                  </div>
                </div>

                <Show when={error()}>
                  <div class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                    {error()}
                  </div>
                </Show>
                <Show when={saved()}>
                  <div class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
                    {i18n.t("settings.saved")}
                  </div>
                </Show>

                <Show when={actor()?.role === "owner"}>
                  <Button type="submit" disabled={pending()}>
                    {pending() ? i18n.t("common.loading") : i18n.t("common.save")}
                  </Button>
                </Show>
              </form>
            </Card>
          )
        }}
      </Show>
    </div>
  )
}
