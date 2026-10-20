import { createMemo, createResource, createSignal, For, Show, type Component } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { ScrollView } from "@allcode/ui/scroll-view"
import { Icon as IconV2 } from "@allcode/ui/v2/icon"
import { Icon } from "@allcode/ui/icon"
import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { Tag } from "@allcode/ui/v2/badge-v2"
import { ProviderIcon } from "@allcode/ui/provider-icon"
import { GlobalLoading } from "@/components/global-loading"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { ServerConnection, useServer } from "@/context/server"
import { useTabs } from "@/context/tabs"
import { createHomeController } from "@/pages/home/home-controller"
import { sessionHref } from "@/utils/session-route"
import { loadHomeSessionIndex } from "@/context/global-sync/home-session-index"
import { computeStats, formatDuration } from "@/pages/stats/stats-controller"
import { useRoutinesQuery } from "@/pages/routines/routines-cache"
import { triggerSummary } from "@/pages/routines/summary"
import { OnboardingGuide } from "@/components/onboarding-guide"

export const DashboardPage: Component = () => {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const server = useServer()
  const tabs = useTabs()
  const home = createHomeController()
  const routines = useRoutinesQuery()
  const navigate = useNavigate()

  // Sessões para métricas gerais
  const [sessionsData] = createResource(async () => {
    const sdk = serverSDK()
    if (!sdk) return []
    try {
      const result = await loadHomeSessionIndex((input, options) => sdk.client.v2.session.list(input, options))
      return result.sessions
    } catch {
      return []
    }
  })

  const sessions = createMemo(() => sessionsData() ?? [])
  const stats = createMemo(() => computeStats(sessions(), { range: "all" }))

  const numFmt = createMemo(() => new Intl.NumberFormat(language.intl()))
  const compactFmt = createMemo(
    () => new Intl.NumberFormat(language.intl(), { notation: "compact", maximumFractionDigits: 1 }),
  )

  const activeRoutines = createMemo(() => routines.schedules().filter((s) => s.enabled))
  const failedRoutines = createMemo(() => routines.schedules().filter((s) => s.lastStatus === "error"))

  const startNewSession = async () => {
    const project = home.project.selected() ?? home.project.list()[0]
    if (!project) {
      navigate("/new-session")
      return
    }
    server.projects.open(project.worktree)
    server.projects.touch(project.worktree)
    const tab = await tabs.newDraft({ server: server.key, directory: project.worktree })
    tabs.select(tab)
  }

  return (
    <div
      class={`
        m-2 min-h-0 flex-1 self-stretch overflow-hidden rounded-[10px]
        bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]
      `}
    >
      <ScrollView class="h-full">
        <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 lg:px-8">
          {/* Header Superior com Boas-Vindas e Ação Principal */}
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-v2-border-border-base pb-4">
            <div class="flex items-center gap-3.5">
              <div class="flex size-13 shrink-0 items-center justify-center rounded-[12px] bg-v2-background-bg-raised text-v2-text-text-accent border border-v2-border-border-base shadow-sm">
                <Icon name="code" size="large" class="size-7" />
              </div>
              <div class="flex min-w-0 flex-col gap-0.5">
                <h1 class="text-xl font-bold text-v2-text-text-base">AllCode Dashboard</h1>
                <p class="text-12-regular text-v2-text-text-muted">
                  Painel de controle executivo de automações, projetos e métricas de inteligência artificial.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <ButtonV2 variant="neutral" size="normal" onClick={() => navigate("/sessions")}>
                <Icon name="bubble-5" size="small" class="mr-1.5" />
                Ver Todas as Sessões
              </ButtonV2>
              <ButtonV2 variant="contrast" size="normal" onClick={startNewSession}>
                <IconV2 name="plus" size="small" class="mr-1.5" />
                Nova Sessão
              </ButtonV2>
            </div>
          </div>

          {/* Guia Interativo de Onboarding */}
          <OnboardingGuide
            onStartSession={startNewSession}
            onExploreRoutines={() => navigate("/rotinas")}
            onOpenSettings={() => navigate("/settings")}
          />

          {/* Grid de KPIs Gerais */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div class="flex flex-col gap-1.5 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-02 p-4 shadow-sm">
              <span class="text-11-medium text-v2-text-text-muted">Total de Sessões</span>
              <div class="flex items-baseline gap-2">
                <span class="text-24-semibold text-v2-text-text-base font-bold">{sessions().length}</span>
                <span class="text-11-regular text-v2-text-text-muted">conversas</span>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-02 p-4 shadow-sm">
              <span class="text-11-medium text-v2-text-text-muted">Tokens Consumidos</span>
              <div class="flex items-baseline gap-2">
                <span class="text-24-semibold text-v2-text-text-base font-bold" title={`${numFmt().format(stats().totalTokens)} tokens`}>
                  {compactFmt().format(stats().totalTokens)}
                </span>
                <span class="text-11-regular text-v2-text-text-muted">tokens</span>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-02 p-4 shadow-sm">
              <span class="text-11-medium text-v2-text-text-muted">Tempo de Trabalho Total</span>
              <div class="flex items-baseline gap-2">
                <span class="text-24-semibold text-v2-text-text-base font-bold">
                  {formatDuration(stats().totalDurationMs)}
                </span>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-02 p-4 shadow-sm">
              <span class="text-11-medium text-v2-text-text-muted">Rotinas Automatizadas</span>
              <div class="flex items-baseline gap-2">
                <span class="text-24-semibold text-v2-state-fg-success font-bold">
                  {activeRoutines().length}
                </span>
                <span class="text-11-regular text-v2-text-text-muted">/ {routines.schedules().length} ativas</span>
              </div>
            </div>
          </div>

          {/* Seção Dupla: Atividades Recentes e Painel do Agendador */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Sessões Recentes */}
            <div class="flex flex-col gap-3 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-02 p-4 shadow-sm">
              <div class="flex items-center justify-between border-b border-v2-border-border-base pb-2.5">
                <div class="flex items-center gap-2">
                  <Icon name="bubble-5" size="small" class="text-v2-text-text-accent" />
                  <span class="text-14-medium font-semibold text-v2-text-text-base">Sessões Recentes</span>
                </div>
                <ButtonV2 variant="neutral" size="small" onClick={() => navigate("/sessions")}>
                  Ver histórico completo
                </ButtonV2>
              </div>

              <Show
                when={sessions().length > 0}
                fallback={
                  <div class="py-8 text-center text-12-regular text-v2-text-text-muted">
                    Nenhuma sessão iniciada recentemente.
                  </div>
                }
              >
                <div class="flex flex-col gap-2">
                  <For each={sessions().slice(0, 5)}>
                    {(s) => (
                      <div
                        class={`
                          flex cursor-pointer items-center justify-between gap-3 rounded-md border border-v2-border-border-base
                          bg-v2-background-bg-layer-01 p-2.5 transition-all hover:border-v2-border-border-strong hover:bg-v2-background-bg-layer-02
                        `}
                        onClick={() => navigate(sessionHref(server.key, s.id))}
                      >
                        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span class="truncate text-13-medium font-medium text-v2-text-text-base">
                            {s.title || s.id}
                          </span>
                          <span class="truncate text-11-regular text-v2-text-text-faint font-mono">
                            {s.directory}
                          </span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0 text-11-regular text-v2-text-text-muted">
                          <span class="rounded bg-v2-background-bg-layer-03 px-1.5 py-0.5 text-10-medium">
                            {compactFmt().format((s.tokens?.input ?? 0) + (s.tokens?.output ?? 0))} tok
                          </span>
                          <span>{new Date(s.time.updated ?? s.time.created).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Rotinas e Agendamentos */}
            <div class="flex flex-col gap-3 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-02 p-4 shadow-sm">
              <div class="flex items-center justify-between border-b border-v2-border-border-base pb-2.5">
                <div class="flex items-center gap-2">
                  <Icon name="task" size="small" class="text-v2-text-text-accent" />
                  <span class="text-14-medium font-semibold text-v2-text-text-base">Rotinas Ativas & Agendamentos</span>
                </div>
                <ButtonV2 variant="neutral" size="small" onClick={() => navigate("/rotinas")}>
                  Gerenciar rotinas
                </ButtonV2>
              </div>

              <Show
                when={routines.schedules().length > 0}
                fallback={
                  <div class="py-8 text-center text-12-regular text-v2-text-text-muted">
                    Nenhuma rotina configurada ainda.
                  </div>
                }
              >
                <div class="flex flex-col gap-2">
                  <For each={routines.schedules().slice(0, 5)}>
                    {(r) => (
                      <div class="flex items-center justify-between gap-3 rounded-md border border-v2-border-border-base bg-v2-background-bg-layer-01 p-2.5">
                        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div class="flex items-center gap-2 truncate">
                            <span class="truncate text-13-medium font-medium text-v2-text-text-base">
                              {r.name || triggerSummary(r.trigger)}
                            </span>
                            <Show when={r.enabled}>
                              <span class="size-1.5 rounded-full bg-v2-state-fg-success" />
                            </Show>
                          </div>
                          <span class="text-11-regular text-v2-text-text-muted truncate">
                            {triggerSummary(r.trigger)}
                          </span>
                        </div>
                        <Tag
                          variant={r.lastStatus === "success" ? "neutral" : r.lastStatus === "error" ? "accent" : "neutral"}
                          class={r.lastStatus === "success" ? "text-v2-state-fg-success" : r.lastStatus === "error" ? "text-v2-state-fg-danger" : ""}
                        >
                          {r.lastStatus === "success" ? "Concluído" : r.lastStatus === "error" ? "Falhou" : "Aguardando"}
                        </Tag>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          {/* Modelos e Recursos Mais Usados */}
          <div class="flex flex-col gap-3 rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-02 p-4 shadow-sm">
            <div class="flex items-center justify-between border-b border-v2-border-border-base pb-2.5">
              <span class="text-14-medium font-semibold text-v2-text-text-base">Modelos & Provedores Conectados</span>
              <ButtonV2 variant="neutral" size="small" onClick={() => navigate("/stats")}>
                Estatísticas Detalhadas
              </ButtonV2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <For each={stats().breakdownByModel.slice(0, 4)}>
                {(m) => (
                  <div class="flex items-center gap-3 rounded-md border border-v2-border-border-base bg-v2-background-bg-layer-01 p-3">
                    <ProviderIcon id={m.providerID} class="size-6 shrink-0" />
                    <div class="flex min-w-0 flex-col">
                      <span class="truncate text-12-semibold text-v2-text-text-base">{m.name}</span>
                      <span class="text-11-regular text-v2-text-text-muted">
                        {compactFmt().format(m.tokens)} tokens ({m.sessions} sessões)
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </ScrollView>
    </div>
  )
}
