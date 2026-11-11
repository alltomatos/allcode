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
