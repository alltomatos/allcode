import { createSignal, onMount, For, Show, type Component } from "solid-js"
import { useTenantAuth } from "@/context/tenant-auth"
import { Icon } from "@allcode/ui/icon"
import type { IconProps } from "@allcode/ui/icon"
import { Icon as IconV2 } from "@allcode/ui/v2/icon"
import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { IconButtonV2 } from "@allcode/ui/v2/icon-button-v2"
import { Tag } from "@allcode/ui/v2/badge-v2"
import { useLanguage } from "@/context/language"

const ONBOARDING_STORAGE_KEY = "allcode.onboarding.dismissed"

export const OnboardingGuide: Component<{
  onStartSession?: () => void
  onExploreRoutines?: () => void
  onOpenSettings?: () => void
}> = (props) => {
  const language = useLanguage()
  const tenantAuth = useTenantAuth()
  const [dismissed, setDismissed] = createSignal(true)
  const [collapsed, setCollapsed] = createSignal(false)
  const [activeStep, setActiveStep] = createSignal(0)

  onMount(() => {
    try {
      const val = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      setDismissed(val === "true")
    } catch {
      setDismissed(false)
    }
  })

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true")
    } catch {}
  }

  const resetGuide = () => {
    setDismissed(false)
    setCollapsed(false)
    setActiveStep(0)
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    } catch {}
  }

  const steps: Array<{
    id: string
    icon: IconProps["name"]
    badge: string
    title: string
    desc: string
    actionText: string
    action: () => void
  }> = [
    {
      id: "sessions",
      icon: "bubble-5",
      badge: "Passo 1",
      title: "1. Sessões & Chat com IA",
      desc: "Trabalhe em código com múltiplos modelos (Claude, Gemini, GPT, DeepSeek). Suporte a comandos, diffs inteligentes, revisão inline e aprovação de permissões.",
      actionText: "Iniciar Sessão",
      action: () => props.onStartSession?.(),
    },
    {
      id: "agentui",
      icon: "subagent",
      badge: "Passo 2",
      title: "2. Agentes & Integrações",
      desc: "Conecte seus agentes ao WhatsApp, Telegram e inboxes de email para atendimento automatizado, suporte e triagem em tempo real com guardrails seguros.",
      actionText: "Ver Agentes",
      action: () => props.onExploreRoutines?.(),
    },
    {
      id: "routines",
      icon: "task",
      badge: "Passo 3",
      title: "3. Rotinas & Agendador",
      desc: "Automatize tarefas recorrentes via cron ou intervalos (varredura de repositórios, resumos diários, relatórios e alertas de monitoramento com SuperKuma).",
      actionText: "Configurar Rotinas",
      action: () => props.onExploreRoutines?.(),
    },
    {
      id: "tools",
      icon: "sliders",
      badge: "Passo 4",
      title: "4. Ferramentas, MCP & Terminal",
      desc: "Terminal PTY nativo, ferramentas Model Context Protocol (MCP), controle de navegador e permissões refinadas de segurança por workspace.",
      actionText: "Ajustar Configurações",
      action: () => props.onOpenSettings?.(),
    },
  ]

  return (
    <Show
      when={!dismissed()}
      fallback={
        <div class="flex items-center justify-between rounded-lg border border-v2-border-border-base bg-v2-background-bg-layer-01 px-3.5 py-2 text-12-regular text-v2-text-text-muted">
          <div class="flex items-center gap-2">
            <span class="flex size-2 rounded-full bg-v2-state-fg-success" />
            <span>Guia de Iniciação Rápida dispensado.</span>
          </div>
          <ButtonV2 variant="neutral" size="small" onClick={resetGuide}>
            <IconV2 name="help" size="small" />
            Reabrir Guia de Início
          </ButtonV2>
        </div>
      }
    >
      <div class="flex flex-col gap-3.5 rounded-xl border border-v2-border-border-strong bg-gradient-to-b from-v2-background-bg-layer-02 to-v2-background-bg-layer-01 p-4 shadow-md transition-all">
        {/* Header do Guia */}
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <Show
              when={tenantAuth.store.tenant?.logoUrl}
              fallback={
                <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-v2-background-bg-raised border border-v2-border-border-base text-v2-text-text-accent shadow-xs">
                  <Icon name="code" size="normal" />
                </div>
              }
            >
              <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white p-1 border border-v2-border-border-base shadow-xs overflow-hidden">
                <img
                  src={
                    tenantAuth.store.tenant!.logoUrl!.startsWith("http")
                      ? tenantAuth.store.tenant!.logoUrl!
                      : `https://allcode.alltomatos.dev.br${tenantAuth.store.tenant!.logoUrl!}`
                  }
                  alt={tenantAuth.store.tenant?.name}
                  class="max-h-full max-w-full object-contain"
                />
              </div>
            </Show>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-15-semibold text-v2-text-text-base">
                  {tenantAuth.store.tenant?.name ? `Bem-vindo à ${tenantAuth.store.tenant.name}` : "Bem-vindo ao AllCode Desktop"}
                </span>
                <Tag variant="accent">
                  {tenantAuth.store.tenant?.name ? "Workspace Corporativo" : "Guia de Boas-vindas"}
                </Tag>
              </div>
              <p class="text-12-regular text-v2-text-text-muted">
                {tenantAuth.store.tenant?.welcomeMessage ||
                  "Conheça os pilares principais da plataforma corporativa de engenharia de software e automações com IA."}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <IconButtonV2
              variant="ghost-muted"
              size="small"
              icon={<Icon name="chevron-down" class={collapsed() ? "rotate-180 transition-transform" : "transition-transform"} />}
              aria-label={collapsed() ? "Expandir" : "Recolher"}
              onClick={() => setCollapsed(!collapsed())}
            />
            <ButtonV2 variant="neutral" size="small" onClick={dismiss} title="Dispensar guia">
              <IconV2 name="close" size="small" />
              Dispensar
            </ButtonV2>
          </div>
        </div>

        {/* Conteúdo Expansível em Passos */}
        <Show when={!collapsed()}>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <For each={steps}>
              {(step, idx) => {
                const isSelected = () => activeStep() === idx()
                return (
                  <div
                    class={`
                      flex flex-col justify-between gap-3 rounded-lg border p-3.5 transition-all cursor-pointer
                      ${
                        isSelected()
                          ? "border-v2-state-border-focused bg-v2-background-bg-layer-02 shadow-xs"
                          : "border-v2-border-border-base bg-v2-background-bg-base hover:border-v2-border-border-strong hover:bg-v2-background-bg-layer-01"
                      }
                    `}
                    onClick={() => setActiveStep(idx())}
                  >
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center justify-between">
                        <Tag variant={isSelected() ? "accent" : "neutral"}>{step.badge}</Tag>
                        <div class="text-v2-text-text-muted">
                          <Icon name={step.icon} size="small" />
                        </div>
                      </div>
                      <span class="text-13-semibold text-v2-text-text-base">{step.title}</span>
                      <p class="text-11-regular text-v2-text-text-muted leading-relaxed line-clamp-3">
                        {step.desc}
                      </p>
                    </div>

                    <div class="pt-2 border-t border-v2-border-border-base flex justify-end">
                      <ButtonV2
                        variant={isSelected() ? "contrast" : "outline"}
                        size="small"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation()
                          step.action()
                        }}
                      >
                        {step.actionText}
                      </ButtonV2>
                    </div>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  )
}
