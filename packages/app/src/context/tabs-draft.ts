type TabLike =
  | { type: "draft"; draftID: string; server: string; directory: string }
  | { type: "session"; server: string; sessionId: string }

/**
 * Um projeto pode ter no máximo **um** rascunho aberto. Clicar em "Nova sessão"
 * repetidamente deve reabrir o rascunho existente, não empilhar abas — cada
 * clique antes criava um draft novo, que só aparecia quando a navegação
 * resolvia, e o usuário via várias abas surgirem de uma vez.
 *
 * Módulo puro (sem router) para poder ser testado sem montar a aplicação.
 */
export function findDraftFor<T extends TabLike>(tabs: readonly T[], server: string, directory: string) {
  return tabs.find(
    (tab): tab is Extract<T, { type: "draft" }> =>
      tab.type === "draft" && tab.server === server && tab.directory === directory,
  )
}

export const draftCreationKey = (server: string, directory: string) => `${server}\n${directory}`

/**
 * Dedupe de criações de rascunho **em voo**, por projeto. `findDraftFor` cobre
 * cliques depois que o draft já existe; este guard cobre a janela entre o
 * primeiro clique e a resolução da navegação — inclusive quando o acionamento
 * vem de um atalho de teclado ou da command palette, que não passam pelo
 * botão. A chave é liberada no `finally`, então uma falha nunca deixa o botão
 * ou o atalho permanentemente travado.
 *
 * Módulo puro (sem router nem Solid) para poder ser testado isoladamente.
 */
export function createDraftCreationGuard<T>() {
  const pending = new Map<string, Promise<T>>()
  return (key: string, create: () => Promise<T>): Promise<T> => {
    const existing = pending.get(key)
    if (existing) return existing
    const created = create().finally(() => pending.delete(key))
    pending.set(key, created)
    return created
  }
}
