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

`resolverVagasEstaduais` chegou a ter um branch de sorteio aleatório para
`temporada <= 1`, pensado para evitar transição abrupta em vagas nacionais
no geral — mas isso conflitava com a regra acima (Série D na temporada 1 usa
elenco fixo, sem sorteio nenhum). O branch foi removido: a função hoje só
resolve vagas por classificação estadual (usada a partir da temporada 2). Se
alguma competição nacional diferente da Série D precisar de um mecanismo de
preenchimento na temporada 1, deve ser modelada separadamente com o mesmo
princípio — elenco fixo real sempre que existir, sem sorteio.

### Status

- [ ] Não implementado — depende do motor de simulação de temporadas (Fase 2)
  para gerar a classificação final dos estaduais e da própria Série D, e da
  lógica de subida/permanência entre temporadas.
