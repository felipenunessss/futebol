# Regras de competições — pendências de implementação (Fase 2)

Diferente de `dados-a-verificar.md` (que rastreia confiança dos *dados*), este
arquivo rastreia decisões de *regra de jogo* sobre como as competições se
comportam entre temporadas — coisas que já decidimos mas que só fazem sentido
implementar quando o motor de simulação de temporadas (Fase 2) existir.
Enquanto isso, ficam documentadas aqui para não se perder.

## Promoção/rebaixamento entre divisões (implementado, escopo parcial)

Antes, toda temporada nova recarregava sempre a MESMA lista estática de
`times` de cada competição (`src/data/estaduais/*.json`/`campeonatos-nacionais/
*.json`) — nenhum clube subia/descia de verdade entre temporadas simuladas
da mesma carreira, mesmo com `Premiacao.acesso_proxima_divisao`/
`rebaixamento_proxima_divisao` cadastrados nos dados (bug relatado pelo
usuário: "não estou vendo os rebaixamentos/promoções/premiações
funcionarem"). Implementado em `src/career/mundo-persistente.ts`
(`calcularMudancasDeDivisao`/`aplicarMudancasDeDivisao`) + `simulation/
incremental.ts` (`ContextoDePrograma.tabelaFinal`, `CompeticaoIncremental.tabelaFinal`)
+ `web/src/features/temporada/useTemporada.ts` (aplica a sobreposição salva
em `EstadoDeCarreira.composicaoDasCompeticoes` antes de montar a temporada, e
recalcula/persiste a sobreposição depois que ela termina).

**Escopo confirmado funcionando**: promoção/rebaixamento entre 2 divisões da
MESMA hierarquia (mesmo estado, pro Brasil, ou mesmo país) quando AS DUAS só
usam `formato.pontos_corridos` puro (sem mata-mata/fase suíça/turno-retorno
anexado) — é o único tipo de formato que hoje expõe uma classificação final
extraível (`tabelaFinal`). Confirmado com dado real: Brasileirão Série A ↔ B
(20 times cada, 4 sobem/4 descem, testado com `avancarSemana` até o fim das
duas competições).

**Ainda não coberto** (fica como pendência, não implementado):
- A maioria dos estaduais (a maior parte usa `fase_suica`/`fase_grupos`/
  `turno`+`returno`, nenhum expõe `tabelaFinal` ainda).
- Brasileirão Série B↔C e C↔D (Série C usa `fase_grupos`+`fase_quadrangular`+
  `final_estadual`; Série D usa `fase_grupos`+`mata_mata` — nenhuma das duas
  tem `tabelaFinal`). Por design, uma troca só acontece quando AS DUAS
  divisões do par suportam `tabelaFinal` (ver comentário em
  `mundo-persistente.ts`) — evita drenar/inchar uma divisão sem nunca
  devolver do outro lado.
- Vagas de Copa do Brasil/Série D concedidas a um estadual
  (`Premiacao.vaga_copa_do_brasil`/`vaga_serie_d`) — inserções cross-competição
  em competições já com fases escalonadas/sorteio de grupos (a própria Série D
  — ver seção abaixo), fora de escopo por ora.
- Título/campeão de competições sem `tabelaFinal` continua funcionando
  normalmente (não depende de `tabelaFinal`) — só a composição de times pra
  temporada seguinte é que não muda pra essas.

Extensão natural pra quando alguém for aumentar a cobertura: expor
`tabelaFinal` nas demais receitas de `incremental.ts` que já têm uma
classificação por trás (`fase_grupos` sem mata-mata teria uma tabela por
grupo, não uma única — precisaria decidir o que "classificação final" quer
dizer nesse caso antes de estender `calcularMudancasDeDivisao` pra formatos
multi-grupo).

## Vagas de Libertadores/Sul-Americana (implementado, escopo parcial)

Mecanismo separado do de promoção/rebaixamento acima (não é entre níveis de
uma hierarquia, é uma competição NACIONAL alimentando uma das 2 competições
continentais fixas) — antes, `Premiacao.vaga_libertadores`/`vaga_sulamericana`
só serviam pra destacar linha na tabela de classificação, sem NENHUM efeito
na composição de Libertadores/Sul-Americana da temporada seguinte (bug
relatado pelo usuário: "validar se as premiações [de Libertadores/Sul-
Americana] estão funcionando"). Implementado em `src/career/
mundo-persistente.ts` (`calcularMudancasContinentais`), chamado de
`web/src/features/temporada/useTemporada.ts` junto com
`calcularMudancasDeDivisao` (os `MudancaDeDivisao[]` das duas fontes são
concatenados antes de `aplicarMudancasDeDivisao`, que já é genérico o
bastante pra aplicar qualquer lista, venha de onde vier).

**Escopo confirmado funcionando**: quando a soma das vagas RESOLVIDAS de um
país nesta temporada bate EXATAMENTE com o tamanho atual da fatia dele na
competição continental — condição de segurança que evita encolher a
representação de um país quando só PARTE das competições que dão vaga pra
ele estão modeladas (ver `docs/dados-a-verificar.md`). Cobre: `tabelaFinal`
disponível → N primeiros colocados pra Libertadores, M seguintes pra
Sul-Americana (Chile e Bolívia, ambos `pontos_corridos` puro); mata-mata sem
`tabelaFinal` com `vaga_libertadores === 1` → campeão leva a vaga (Copa do
Brasil).

**Ainda não coberto** (fica como pendência, não implementado):
- Brasil — Série A não tem `vaga_libertadores`/`vaga_sulamericana`
  cadastrados (pendência de DADO, não de código — ver
  `docs/dados-a-verificar.md`: "o número varia ano a ano pelo ranking CBF,
  não é posição fixa simples"). Enquanto isso, o Brasil nunca é tocado por
  este mecanismo (só a Copa do Brasil tem 1 vaga modelada, que sozinha nunca
  bate com o tamanho atual da fatia brasileira — ver condição de segurança
  acima) — a composição brasileira de Libertadores/Sul-Americana continua
  sempre a estática do ano de referência, exatamente como antes desta
  mudança (sem regressão, só sem cobertura ainda).
- `vaga_sulamericana` de uma competição sem `tabelaFinal` (mata-mata) nunca é
  resolvida — não tem como saber quem é o "vice"/2º colocado num chaveamento
  eliminatório sem uma tabela por trás.
- Formatos `turno`+`returno`/`tabela_acumulada`/`fase_quadrangular` (a
  maioria dos outros países CONMEBOL — Argentina, Colômbia, Uruguai,
  Paraguai, Peru, Equador, Venezuela) não expõem `tabelaFinal` ainda — mesma
  pendência de `calcularMudancasDeDivisao` acima, extensão natural quando
  alguém for aumentar a cobertura.

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

- [ ] Não implementado. O motor de simulação de temporadas (Fase 2) já existe,
  e a lógica de subida/permanência entre temporadas para o caso simples já
  foi implementada (ver seção "Promoção/rebaixamento entre divisões" acima,
  `career/mundo-persistente.ts`) — mas o mecanismo específico deste item
  (`vaga_serie_d` vindo de um estadual, resolvido por `resolverVagasEstaduais`)
  ainda não foi ligado a ela: exigiria inserir clubes numa competição que
  ainda não roda `tabelaFinal` (Série D usa `fase_grupos`+`mata_mata`) a
  partir de uma classificação estadual que, na maioria dos casos, TAMBÉM não
  tem `tabelaFinal` ainda. Fica pendente até que pelo menos um dos dois lados
  ganhe suporte.
