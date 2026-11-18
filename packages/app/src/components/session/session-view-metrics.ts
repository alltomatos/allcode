import type { Session } from "@allcode/sdk/v2/client"
import { computeStats } from "@/pages/stats/stats-controller"

export type SessionTokenMetrics = {
  hasUsage: boolean
  input: number
  output: number
  total: number
  /** undefined quando não há tempo ativo: velocidade indefinida, não zero. */
  tps: number | undefined
}

const empty: SessionTokenMetrics = { hasUsage: false, input: 0, output: 0, total: 0, tps: undefined }

/**
 * Métricas de uso da sessão para o cabeçalho. Lê `computeStats` sobre a própria
 * `Session` do backend (tokens/tempo/cost já acumulados), sem estimar nada. O
 * store é reativo, então novas mensagens/uso reavaliam este valor.
 *
 * Saneia entradas não finitas e evita divisão por zero: sem tempo ativo a
 * velocidade é `undefined` (mostrada como "—"), nunca NaN/Infinity.
 */
export function sessionTokenMetrics(session: Session | undefined): SessionTokenMetrics {
  if (!session) return empty

  const stats = computeStats([session], { range: "all" })
  const finite = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0)
  const total = finite(stats.totalTokens)

  return {
    hasUsage: total > 0,
    input: finite(stats.inputTokens),
    output: finite(stats.outputTokens),
    total,
    tps: Number.isFinite(stats.tokensPerSecond) && stats.tokensPerSecond > 0 ? stats.tokensPerSecond : undefined,
  }
}
