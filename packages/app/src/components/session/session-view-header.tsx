import { createMemo, For, Show } from "solid-js"
import { Icon } from "@allcode/ui/icon"
import { getFilename } from "@allcode/core/util/path"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useSessionLayout } from "@/pages/session/session-layout"
import { sessionTitle } from "@/utils/session-title"
import { createSessionContextFormatter } from "./session-context-format"
import { sessionTokenMetrics } from "./session-view-metrics"

type Metric = { label: string; value: string; exact: string }

/**
 * Cabeçalho do painel da sessão: identifica título e projeto (essencial com
 * várias abas abertas) e resume o uso de tokens da sessão. Todas as métricas
 * vêm de `computeStats` sobre a própria `Session` do store — o backend já
 * fornece `tokens`/`time`/`cost`, não há estimativa nem recálculo local.
 */
export function SessionViewHeader() {
  const language = useLanguage()
  const sync = useSync()
  const { params } = useSessionLayout()

  const info = createMemo(() => (params.id ? sync().session.get(params.id) : undefined))
  const title = createMemo(() => sessionTitle(info()?.title) ?? language.t("command.session.new"))
  const directory = createMemo(() => info()?.directory ?? "")
  const projectName = createMemo(() => (directory() ? getFilename(directory()) : ""))

  const usage = createMemo(() => sessionTokenMetrics(info()))

  const formatter = createMemo(() => createSessionContextFormatter(language.intl()))
  const compact = createMemo(
    () => new Intl.NumberFormat(language.intl(), { notation: "compact", maximumFractionDigits: 1 }),
  )
  const decimal = createMemo(
    () => new Intl.NumberFormat(language.intl(), { maximumFractionDigits: 1 }),
  )

  // `—` é o estado explícito "sem dado": sessão nova, sem uso registrado ou
  // valor não finito. Nunca divide por zero nem formata NaN/Infinity.
  const blank = () => formatter().number(null)
  const safe = (value: number | undefined, format: (value: number) => string) =>
    value !== undefined && Number.isFinite(value) && value >= 0 ? format(value) : blank()

  const metrics = createMemo<Metric[]>(() => {
    const u = usage()
    const shown = (value: number | undefined, formatValue: (value: number) => string, exactValue?: (value: number) => string) => ({
      value: safe(value, formatValue),
      exact: value !== undefined && Number.isFinite(value) && value >= 0 ? (exactValue ?? formatValue)(value) : blank(),
    })
    return [
      { label: language.t("session.view.header.input"), ...shown(u.input, (v) => compact().format(v), (v) => formatter().number(v)) },
      { label: language.t("session.view.header.output"), ...shown(u.output, (v) => compact().format(v), (v) => formatter().number(v)) },
      { label: language.t("session.view.header.tps"), ...shown(u.tps, (v) => decimal().format(v)) },
      { label: language.t("session.view.header.total"), ...shown(u.total, (v) => compact().format(v), (v) => formatter().number(v)) },
    ]
  })

  return (
    <header
      data-component="session-view-header"
      class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-v2-border-border-base bg-v2-background-bg-base px-4 py-2"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
        <bdi dir="auto" class="block min-w-0 truncate text-13-semibold text-v2-text-text-base" title={title()}>
          {title()}
        </bdi>
        <div class="flex min-w-0 items-center gap-1.5 text-11-regular text-v2-text-text-muted">
          <Icon name="folder" size="small" class="shrink-0" />
          <span class="shrink-0">{language.t("session.view.header.project")}</span>
          <bdi dir="ltr" class="block min-w-0 truncate font-mono text-v2-text-text-faint" title={directory()}>
            {projectName() || blank()}
          </bdi>
        </div>
      </div>

      <div class="flex min-w-0 flex-wrap items-center gap-1.5" aria-label={language.t("session.view.header.usage")}>
        <Show
          when={usage().hasUsage}
          fallback={<span class="text-11-regular text-v2-text-text-faint">{language.t("session.view.header.noUsage")}</span>}
        >
          <For each={metrics()}>
            {(metric) => (
              <span
                class="flex shrink-0 items-center gap-1 rounded-[6px] bg-v2-background-bg-layer-01 px-2 py-0.5 text-11-regular"
                title={metric.exact}
              >
                <span class="text-v2-text-text-muted">{metric.label}</span>
                <span class="font-medium text-v2-text-text-base">{metric.value}</span>
              </span>
            )}
          </For>
        </Show>
      </div>
    </header>
  )
}
