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
MESMA hierarquia (mesmo estado, pro Brasil, ou mesmo país) quando AS DUAS
conseguem expor um sinal de "quem sobe/desce" — `tabelaFinal` (`pontos_corridos`
puro, OU `fase_grupos` de 1 grupo só, ex: Brasileirão Série C) ou
`semifinalistas` (mata-mata com uma etapa chamada "semifinal", só serve pra
ACESSO — sem ordem dentro do conjunto, não dá pra tirar "os piores
colocados" dele pra rebaixamento). Confirmado com dado real:
- Brasileirão Série A ↔ B (20 times cada, 4 sobem/4 descem).
- Brasileirão Série B ↔ C ↔ D em CADEIA (bug relatado pelo usuário: "na
  série D os semifinalistas deveriam subir pra série C e não funcionou") —
  Série D (fase_grupos de 16 grupos + mata_mata) não tem `tabelaFinal`, mas
  expõe `semifinalistas` (os 4 que jogaram a etapa "semifinal", vencedores
  e perdedores); Série C (fase_grupos de 1 grupo + fase_quadrangular +
  final_estadual) ganhou `tabelaFinal` da sua fase de grupos, habilitando
  tanto o acesso dela pra B quanto o rebaixamento dela pra D. Ajuste de
  dado necessário pra fechar a simetria (ver `docs/dados-a-verificar.md`):
  `brasileirao_serie_d.json` `acesso_proxima_divisao` 6→4 (não batia com
  nenhuma etapa nomeada do mata-mata) e `brasileirao_serie_c.json`
  `rebaixamento_proxima_divisao` 2→4 (precisa casar com os 4 semifinalistas
  da D pra não drenar a Série D ao longo de várias temporadas — sem isso, a
  Série D perderia 4 times/temporada sem receber nenhum de volta, quebrando
  a contagem de 96 times exigida por `dividirEmGruposValidado` já na 2ª
  temporada simulada). Confirmado com dado real: B/C mantêm 20 times cada,
  D mantém 96, nenhum clube duplicado ou perdido, em todas as direções
  simultaneamente (A↔B, C→B, B→C, D→C, C→D).

**Ainda não coberto** (fica como pendência, não implementado):
- A maioria dos estaduais (a maior parte usa `fase_suica`/`turno`+`returno`,
  nenhum expõe `tabelaFinal`/`semifinalistas` ainda).
- Vagas de Copa do Brasil/Série D concedidas a um estadual
  (`Premiacao.vaga_copa_do_brasil`/`vaga_serie_d`) — inserções cross-competição
  em competições já com fases escalonadas/sorteio de grupos (a própria Série D
  — ver seção abaixo), fora de escopo por ora.
- Título/campeão de competições sem `tabelaFinal` continua funcionando
  normalmente (não depende de `tabelaFinal`) — só a composição de times pra
  temporada seguinte é que não muda pra essas.

Extensão natural pra quando alguém for aumentar a cobertura: expor
`tabelaFinal` nas demais receitas de `incremental.ts` que já têm uma
classificação por trás (`fase_grupos` com MAIS de 1 grupo teria uma tabela
por grupo, não uma única — precisaria decidir o que "classificação final"
quer dizer nesse caso antes de estender `calcularMudancasDeDivisao` pra
formatos multi-grupo de verdade); ou expor `semifinalistas`-like em outros
mata-matas com etapa nomeada relevante.

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

**Brasil agora coberto** (pedido do usuário: "quero que de fato temporada a
temporada as vagas componham os times que participam das competições", não
só Chile/Bolívia) — `brasileirao_serie_a.json` ganhou `vaga_libertadores: 7`/
`vaga_sulamericana: 6` (aproximação posicional, mesmo espírito de todo país
com critério real complexo/não pesquisado — ver `docs/dados-a-verificar.md`),
calibrados pra bater com o total de clubes brasileiros na composição
estática 2026 MENOS 1 vaga de Sul-Americana (Botafogo, protegido — ver
"clube com papel fixo de pré-classificatória" abaixo). Também corrigido:
`vaga_libertadores` removida de Carioca A e Paulistão A1 — clubes NÃO se
classificam pra Libertadores via campeonato estadual na era moderna (bug
relatado pelo usuário, dado estava errado).

**Bug crítico corrigido: clube com papel fixo de pré-classificatória
sendo trocado por engano, derrubando Libertadores+Sul-Americana inteiras**
(bug urgente relatado pelo usuário: clube se classificou pra Sul-Americana
mas ela sumiu da lista de competições na temporada seguinte). Causa: alguns
clubes (`botafogo` no Brasil, `ohiggins` no Chile, `bolivar` na Bolívia)
estão cadastrados TANTO na fatia direta de Sul-Americana quanto numa etapa
pré-classificatória de Libertadores (`formato.mata_mata.etapas[].entrantes`,
`simulation/incremental.ts`) — a troca de vaga por país podia remover
justamente esse clube, quebrando o equilíbrio "diretos vs pré-
classificatórios" que o motor incremental depende pra achar o corte entre
as duas fases, e a competição inteira virava erro (some da temporada de
QUALQUER jogador, não só de quem ganhou a vaga). `calcularMudancasContinentais`
ganhou `clubesProtegidos` — esses clubes nunca são trocados nem contam na
fatia "atual" de um país; `vaga_sulamericana` de Chile/Bolívia voltou de 5
pra 4 (a fonte pesquisada já dizia 4 — o "5" só existia por causa do bug) e
a do Brasil foi ajustada de 7 pra 6 (só as vagas de fato controladas pela
posição na tabela). Ver `docs/motor-de-partida.md` seção 5.30 pro
detalhamento completo e validação com dado real.

**Deduplicação entre vias** (bug real encontrado com dado de verdade: o
campeão da Copa do Brasil também terminando entre os 7 primeiros do
Brasileirão gerava o MESMO clube 2x na lista de Libertadores) —
`calcularMudancasContinentais` deduplica antes de comparar com o tamanho
atual da fatia; se a deduplicação fizer a contagem não bater mais, a troca
é pulada nessa rodada (mesma rede de segurança, não tenta promover o
"próximo da fila" pro lugar que sobrou — fazer isso direito dependeria de
saber a ordem de prioridade entre os critérios de cada via, fora de escopo).

**Ainda não coberto** (fica como pendência, não implementado):
- `vaga_sulamericana` de uma competição sem `tabelaFinal` (mata-mata) nunca é
  resolvida — não tem como saber quem é o "vice"/2º colocado num chaveamento
  eliminatório sem uma tabela por trás (por isso a Série A também assume os
  7 de Sul-Americana por inteiro — a vaga da Copa do Brasil não conta na
  prática).
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
