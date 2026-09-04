# Regras de competições — pendências de implementação (Fase 2)

Diferente de `dados-a-verificar.md` (que rastreia confiança dos *dados*), este
arquivo rastreia decisões de *regra de jogo* sobre como as competições se
comportam entre temporadas — coisas que já decidimos mas que só fazem sentido
implementar quando o motor de simulação de temporadas (Fase 2) existir.
Enquanto isso, ficam documentadas aqui para não se perder.

## Série D — preenchimento de vagas por temporada

Fonte: `src/data/campeonatos-nacionais/brasileirao_serie_d.json` (elenco) e
`src/data/loaders/vagas-nacionais.ts` (lógica de resolução de vagas
estaduais, já implementada mas ainda não citada por nenhum motor de
temporada).

### Temporada 1 da carreira

Usa **exatamente os clubes reais de 2026** já modelados em
`times[]` de `brasileirao_serie_d.json` — hoje 76 dos 96 reais (ver pendência
de elenco incompleto em `dados-a-verificar.md`). Nenhum sorteio, nenhuma
resolução via `vagas-nacionais.ts`: é a lista fixa do arquivo.

### Temporada 2 em diante

As vagas passam a ser preenchidas dinamicamente por dois mecanismos
combinados:

1. **Permanência** — clubes que ficaram na Série D na temporada anterior
   (não subiram à Série C via `premiacao.acesso_proxima_divisao`; a Série D
   não tem rebaixamento por ser a divisão mais baixa do sistema modelado).
2. **Vagas vindas dos estaduais** — clubes indicados pelo campo
   `premiacao.vaga_serie_d` de cada campeonato estadual, resolvidos pela
   classificação final daquele estadual usando `resolverVagasEstaduais`
   (`src/data/loaders/vagas-nacionais.ts`).

Os dois grupos somados devem preencher o tamanho total da divisão na
temporada em questão.

### Atenção para quem for implementar

`resolverVagasEstaduais` já tem um branch para `temporada <= 1` que faz
**sorteio aleatório** entre clubes elegíveis quando ainda não há classificação
histórica — pensado para evitar transição abrupta em vagas nacionais no geral.
Esse comportamento **conflita com a regra acima para a Série D
especificamente**: na temporada 1, a Série D não deve passar por sorteio
nenhum, deve usar a lista fixa dos clubes reais. Ao implementar, avaliar se
o sorteio da temporada 1 continua fazendo sentido para outras vagas nacionais
(ex: Copa do Brasil, que também usa vagas por estadual) ou se deve ser
descontinuado também para manter a temporada 1 sempre fiel ao elenco real
2026 onde ele existir.

### Status

- [ ] Não implementado — depende do motor de simulação de temporadas (Fase 2)
  para gerar a classificação final dos estaduais e da própria Série D, e da
  lógica de subida/permanência entre temporadas.
