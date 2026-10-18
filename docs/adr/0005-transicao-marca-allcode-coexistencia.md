# ADR 0005: Transição de Identidade de Marca para AllCode e Coexistência com OpenCode

- **Status:** Aceito
- **Data:** 2026-10-17
- **Autor:** Equipe de Arquitetura & Engenharia Alltomatos

## Contexto

O fork `alltomatos/opencode` evoluiu substancialmente além da base original `anomalyco/opencode`. Entre as extensões exclusivas implementadas estão:
1. Agente e orquestrador de raciocínio profundo Breniac;
2. Suporte avançado a desktop Electron unificado;
3. Integração com mobile, roteamento de modelos resilientes e suporte ampliado a tooling local;
4. Gestão aprimorada de contexto, compressão RTK e persistência.

A denominação *"OpenCode by Alltomatos"* gerou confusão frequente de suporte e expectativas de compatibilidade direta: usuários tentavam usar configurações do upstream no fork ou vice-versa, e relatavam falhas operacionais decorrentes das divergências de arquitetura.

Adicionalmente, os desenvolvedores necessitam utilizar simultaneamente o OpenCode e o novo produto na mesma estação de trabalho sem colisões de processos, portas de rede, bloqueios em arquivos SQLite ou contaminação mútua de configurações locais.

## Decisão

1. **Renomeação do Produto:** O fork adota formalmente o nome **AllCode** (`allcode`), com repositório oficial dedicado em `https://github.com/alltomatos/allcode`.
2. **Coexistência Completa (Side-by-Side):**
   - **Comando CLI:** `allcode`.
   - **Porta Padrão do Servidor:** `1953` (em contraste com a porta 4096 do OpenCode).
   - **Diretório Global de Configuração e Estado:** `~/.config/allcode` e `~/.local/share/allcode` (no Windows: `%LOCALAPPDATA%\allcode` e `%USERPROFILE%\.config\allcode`).
   - **Banco SQLite Isolado:** `allcode.db` (evitando contenção de locks de escrita WAL com `opencode.db`).
   - **Configuração no Projeto:** `.allcode/` e `allcode.json` / `allcode.jsonc`.
3. **Estratégia de Compatibilidade e Importação:**
   - Criação do comando `allcode import`, possibilitando migração controlada e não-destrutiva de sessões e projetos legados do OpenCode para o AllCode.
   - Detecção cooperativa de diretórios `.opencode/` existentes com sugestão de importação.
4. **Isolamento de Marca vs. Compatibilidade de Upstream:**
   - A camada de constantes de plataforma (`Branding` / `Platform`) centraliza identificadores do sistema operacional, portas e caminhos de arquivo, mantendo o motor do Effect v4 e abstrações de Runner sincronizáveis com o upstream.

## Consequências

### Positivas
- Eliminação completa de ambiguidades de suporte entre OpenCode e AllCode.
- Possibilidade de executar ambos os daemons e interfaces TUI/Desktop simultaneamente na mesma máquina sem colisão de porta `EADDRINUSE` ou lock do SQLite.
- Identidade visual e de marca proprietária alinhada ao ecossistema Alltomatos.

### Negativas / Mitigações
- Necessidade de atualizar referências de pacotes e scripts de build (`@opencode-ai/*` para namespaces equivalentes).
- *Mitigação:* Realização de refatoração por camadas atômicas com verificação rigorosa de testes e `bun typecheck`.
