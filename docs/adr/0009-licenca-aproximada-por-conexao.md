# ADR 0009: Licença de provider aproximada por conexão

## Status
Aceito (2026-11-11)

## Contexto

Não existe no código — nem em API conhecida — uma verificação de assinatura do plano
OpenCode Go. O que existe é conexão/credencial por provider, resolvida no escopo de
localização atual (`packages/core/src/integration.ts`). Exibir modelos pagos do
`opencode-go` para quem não tem credencial produz o pior tipo de falha: um modelo
selecionável que não executa.

## Decisão

Adotar a heurística **licença ≈ conexão**: um provider pago está licenciado quando
existe conexão ou credencial válida no escopo de localização atual. A regra vive num
único ponto do core — o mesmo que hoje desabilita modelos pagos sem chave em
`packages/core/src/plugin/provider/opencode.ts` — para que seletor, projeção v1 e
telas herdem o comportamento sem duplicação. Sem conexão, **todos** os modelos do
`opencode-go`, inclusive os `-free` de custo zero, ficam `enabled = false`, e o
provider aparece apenas como tile de conexão. Não consultamos Console, endpoint de
assinatura nem entitlement.

## Considered Options

- **Probe dedicado de entitlement.** Rejeitado: não há endpoint conhecido e ampliaria
  o escopo para uma dependência externa nova.
- **Confiar no catálogo remoto do Console.** Rejeitado: hoje ele só é buscado para o
  provider `opencode`; estender exigiria mexer no fetch e depender de token/rede.
- **Manter `-free` visível sem conexão.** Rejeitado: um modelo gratuito sem credencial
  é selecionável e não executável, o que viola a promessa de nunca exibir modelo que
  não funciona.

## Consequences

- A regra é uma aproximação: quem tem credencial sem assinatura ativa ainda pode ver
  modelos pagos e falhar na chamada. Isso é aceito e documentado.
- Se surgir verificação real de assinatura, a mudança fica restrita a um ponto no core.
- O delta correspondente se chama **“pago sem conexão”**, e não “pago sem assinatura”,
  para não sugerir uma verificação que não existe.
