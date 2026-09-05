# Motor de partida e progressão do jogador — design (Fase 2/3)

Este doc registra decisões de design tomadas numa sessão dedicada a pensar a
lógica das partidas, depois que a base de dados da Fase 1 (estaduais,
nacionais, CONMEBOL) já estava bem avançada. **Substitui** as partes de
`game-design.md` seção 3 (Sistema de Evolução) que descreviam perks e
slots de nível — aquela abordagem foi abandonada em favor do desenho abaixo.
`game-design.md` continua valendo pra tudo que não é contradito aqui
(calendário, mercado, pilares de imersão, ciclo de jogo).

Nada aqui está implementado ainda — é desenho conceitual pra guiar a
implementação da Fase 2/3. Fórmulas exatas (constantes, pesos) ficam em
aberto até a implementação real permitir calibrar por teste.

## 1. Força dos times — rating histórico, não só financeiro

**Decisão**: força esportiva de um clube (usada pra decidir resultado de
partida) não deve vir só de `forca_financeira` (que mede poder de mercado,
não desempenho competitivo real). Time tradicionalmente forte mas com
finanças médias precisa ser competitivo na simulação.

- Novo campo em `Club`: `rating_inicial` — número numa escala tipo Elo
  (ex: 1000-2000), semeado a partir de um **rating histórico real já
  publicado** (ex: World Football Elo Ratings ou fonte equivalente),
  calculado a partir de resultado histórico de verdade (títulos, campanhas
  continentais, resultados contra outros times).
- **Cobertura parcial esperada**: fontes desse tipo devem cobrir bem Série
  A, primeiras divisões CONMEBOL, talvez Série B — não vão ter nada pra
  clube pequeno de estadual. Pra esses, um **fallback calibrado** a partir
  de `nivel` da divisão + `forca_financeira` como desempate — calibrado pra
  não criar descontinuidade contra os clubes que têm rating real vizinhos
  na mesma divisão.
- `forca_financeira` continua existindo separadamente, pra Fase 4 (mercado/
  salários) — força esportiva e força financeira não são a mesma coisa.
- **Depois de semeado, o rating evolui sozinho pelos resultados simulados**
  da própria carreira: fórmula clássica de Elo — `novo = antigo + K ×
  (resultado_real − resultado_esperado)`, `resultado_esperado` vindo da
  diferença de rating entre os times (função logística padrão de Elo). `K`
  varia por importância da competição/partida (maior em final/clássico,
  menor em fase de grupos) — assim vencer um favorito vale mais que vencer
  um lanterna.
- **Pendência de dados** (não é pra fazer agora): popular `rating_inicial`
  real pros clubes com cobertura e calibrar a fórmula de fallback pros
  demais — frente de pesquisa separada, tamanho parecido com o que já
  fizemos pra elenco/formato dos campeonatos.
- **Status: parcialmente resolvida** — ver seção 1.1 abaixo pro relatório
  da rodada de pesquisa que populou `rating_inicial` real pro Brasileirão
  Série A e pras 9 primeiras divisões CONMEBOL.

### 1.1. Pendência de dados — resolvida parcialmente (Série A + CONMEBOL)

**Fonte usada**: [clubelo.com](https://clubelo.com) (Club Elo), snapshot do
dia **2026-09-04**. A API dedicada (`api.clubelo.com`, CSV) não ficou
acessível pro ambiente de pesquisa (timeout de rede); em vez disso, os
ratings foram extraídos de uma tabela por país **embutida no HTML** da
página `clubelo.com/Brazil` (o site carrega, na mesma resposta, um
accordion de navegação com a tabela completa — clube, sigla, Elo — de
90 países, incluindo os 10 alvo desta rodada). Escala usada é a nativa do
Club Elo (mesma convenção de Elo de clube de futebol, tipicamente
1000-2100 pra times de elite mundial) — os valores foram só arredondados
pro inteiro mais próximo, sem normalização ou reescala.

**Cobertura por competição** (clubes com `rating_inicial` populado / total
de clubes na competição):

| Competição | Confirmados |
|---|---|
| Brasileirão Série A | 20/20 |
| Argentina — Liga Profesional | 30/30 |
| Bolívia — Primera División | 16/16 |
| Chile — Primera División | 16/16 |
| Colômbia — Liga BetPlay (Primera A) | 19/20 |
| Equador — LigaPro | 16/16 |
| Paraguai — Primera División | 12/12 |
| Peru — Liga 1 | 17/18 |
| Uruguai — Primera División | 16/16 |
| Venezuela — Liga FUTVE | 14/14 |
| **Total** | **176/178** |

**Casos de baixa confiança / ambiguidade ao casar nome da fonte com `id` da
base** (documentados nos commits de cada país também):

- **`internacional_de_bogota` (Colômbia)**: sem `rating_inicial` — não achei
  entrada correspondente na fonte (clube pequeno/recém-promovido, sem
  histórico suficiente pro Club Elo calcular rating).
- **`juan_pablo_ii` (Peru)**: sem `rating_inicial` — a fonte lista **duas**
  entradas com o nome truncado idêntico "Juan Pablo II Co" (1358 e 1349),
  sem forma de saber qual delas é o clube certo. Não inventei qual usar.
- **`alianza_valledupar` (Colômbia)**: casado com a entrada "Alianza
  Petrolera" da fonte (rating 1482) — confirmado por busca que é o mesmo
  clube (mesmo dono/CNPJ), que só se mudou de Barrancabermeja pra
  Valledupar e trocou de nome/escudo em 2024. O Club Elo mantém o
  histórico sob o nome antigo.
- **`cusco_fc` e `deportivo_moquegua` (Peru)**: casados com entradas antigas
  da fonte ("Real Garcilaso" 1510 e "UCV Moquegua" 1361) — confirmado por
  busca que são o mesmo clube antes de renomear: Real Garcilaso virou
  Cusco FC em 2019; UCV Moquegua (clube-satélite de Universidad César
  Vallejo) virou Deportivo Moquegua em 2024.
- **Nomes truncados a 16 caracteres** na tabela-fonte (ex: "Estudiantes (RC)"
  aparece como "Río Cuarto" na fonte, "Ath Paranaense", "Argentinos Junio")
  exigiram casar por sigla (TLC) e slug da URL do clube, não só pelo nome —
  risco residual de erro nesses casos é baixo (sigla + contexto batem), mas
  vale reconferir se algum resultado de simulação parecer estranho pra um
  desses clubes específicos.

**Cobertura fora do escopo desta rodada** (não mexi, fica pra próxima
pesquisa se algum dia for necessário): 2ª divisões de todos os países,
Copa do Brasil, Libertadores/Sul-Americana, e qualquer campeonato estadual
brasileiro — todos continuam usando só o fallback de `calcularRatingFallback`.

### 1.2. Pendência de dados — resolvida parcialmente (Série B, C e D)

**Fonte usada**: mesma da seção 1.1 — [clubelo.com](https://clubelo.com)
(Club Elo), tabela por país embutida no HTML de `clubelo.com/Brazil`,
desta vez com snapshot do dia **2026-09-05**. Escala nativa do Club Elo,
sem reescala. Nesta rodada a extração foi feita via fetch de página
processado por modelo (não parsing bruto do HTML como na 1.1); pra
mitigar risco de erro de transcrição de número, cada valor "de risco"
(nomes truncados, clubes com rating idêntico ao vizinho, nomes
ambíguos) foi reconferido com uma consulta separada à página do clube
individual (`clubelo.com/<slug>`), conferindo o link/slug bruto (ex:
`/athletic-mg`, `/cr-brasil-al`, `/operario-ferroviario-pr`) pra
confirmar identidade, não só o nome de exibição.

Nota: os valores de Série A obtidos neste mesmo snapshot (2026-09-05)
vieram visivelmente diferentes dos da seção 1.1 (ex: Flamengo 1860 vs
1839) — Elo muda a cada partida jogada, e há rodadas do Brasileirão
entre os dois snapshots (2026-09-04 → 2026-09-05); isso é esperado e
**não foi usado pra sobrescrever nada da Série A**, já coberta e fora
do escopo desta rodada.

**Cobertura por competição** (clubes com `rating_inicial` populado /
total de clubes na competição):

| Competição | Confirmados |
|---|---|
| Brasileirão Série B | 20/20 |
| Brasileirão Série C | 20/20 |
| Brasileirão Série D | 4/96 |
| **Total desta rodada** | **44/136** |

**Cobertura da Série D é baixa por limitação real da fonte, não por
falta de busca**: a tabela por país do Club Elo pra Brasil só lista
Level 1 (20, Série A), Level 2 (20, Série B), Level 3 (20, Série C) e
uma categoria "Lower" com só um punhado de clubes adicionais que a
fonte ainda rastreia por terem caído recentemente de divisão mais alta
— nesta rodada, exatamente 4: **CSA**, **Retrô**, **ABC** (RN) e
**Tombense**. Os outros 92 clubes da Série D (a maioria nunca disputou
Série C ou fez pouca campanha continental/nacional relevante) não têm
nenhuma entrada na fonte — confirmado testando reconsultas exaustivas
à mesma página pedindo "todo clube brasileiro além dos 60 primeiros".
Ficam sem `rating_inicial`, usando o fallback.

**Casos de ambiguidade resolvidos**:

- **`mac` (Maranhão Atlético Clube, Série C)**: casado com a entrada
  "Maranhao" (código `MAR`) da fonte, rating 1522 — nome de exibição
  da fonte bate com o nome oficial completo do clube ("Maranhão"), e é
  o único clube do estado do Maranhão presente na Série C (os outros
  clubes maranhenses da base — Moto Club, IAPE, Sampaio Corrêa-MA,
  Imperatriz — estão na Série D e não aparecem na tabela da fonte, sem
  risco de confundir um com o outro).
- **`abc_rn` (Série D)**: casado com a entrada "ABC" da fonte (sem
  sufixo de estado) — único clube "ABC" na base, tradicional o
  suficiente pra Club Elo não precisar de sufixo.
- **Ratings coincidentes entre clubes diferentes** (ex: `brusque_fc`,
  `inter_de_limeira` e `maringa_fc` todos em 1534; `athletic_club_mg` e
  `avai` ambos em 1591): reconferido individualmente que não é erro de
  transcrição — são apenas empates genuínos de Elo arredondado entre
  clubes de força parecida, cada um confirmado por slug/código próprio
  na fonte.

**Nota estrutural encontrada durante a pesquisa** (não é bug, só
documentando pra quem for mexer de novo): nem todo clube de Série
B/C/D mora em `src/data/clubes/brasil.json` — vários (ex:
`botafogo_sp`, `sao_bernardo`, `ferroviaria`, `abc_rn`, `csa`, `retro`,
e boa parte dos clubes de Série D) ainda estão cadastrados só no
`<uf>_estadual.json` do seu estado, apesar de já jogarem competição
nacional. O campo `rating_inicial` foi adicionado no arquivo onde o
clube efetivamente mora hoje (`brasil.json` ou o `_estadual.json`
correspondente) — migrar esses clubes pra `brasil.json` fica de fora
do escopo desta tarefa (é reorganização de dado, não pesquisa de
rating).

### 1.3. Pendência de dados — resolvida parcialmente (2ª divisões CONMEBOL)

**Fonte usada**: mesma da seção 1.1/1.2 — [clubelo.com](https://clubelo.com)
(Club Elo), tabela por país embutida no HTML (fetch de `clubelo.com/<País>`,
processado por modelo), snapshot do dia **2026-09-05**. Escala nativa,
sem reescala. Casos de risco (nomes truncados, entradas duplicadas)
reconferidos com consulta separada à página do clube individual (slug
`clubelo.com/<slug>`), da mesma forma que nas rodadas anteriores.

**Cobertura por competição** (clubes com `rating_inicial` populado / total
de clubes na competição):

| Competição | Confirmados |
|---|---|
| Argentina — Primera Nacional | 36/36 |
| Chile — Liga de Ascenso | 2/16 |
| Colômbia — Primera B | 2/16 |
| Equador — Serie B | 2/12 |
| Paraguai — División Intermedia | 2/16 |
| Peru — Liga 2 | 0/18 |
| Uruguai — Segunda División Profesional | 3/14 |
| Venezuela — Segunda División | 0/17 |
| **Total** | **47/145** |

**Argentina foi a exceção positiva**: a Primera Nacional tem cobertura
completa (36/36) porque o Club Elo trata as duas zonas da Primera
Nacional como parte da mesma pirâmide nacional que já rastreia em
detalhe (mesma fonte que deu 30/30 pra Liga Profesional na seção 1.1;
o número mudou pra 30 no snapshot desta rodada por atualização normal
de Elo, não é regressão). As outras 7 competições têm cobertura bem
mais baixa — o Club Elo só continua rastreando individualmente clubes
de 2ª divisão que caíram recentemente de 1ª ou têm relevância histórica
(mesmo padrão da categoria "Lower" documentado na seção 1.2 pro
Brasileirão Série D); a maioria dos clubes "de baixo" de cada país
simplesmente não tem entrada na fonte.

**Casos de ambiguidade e não-cobertura documentados**:

- **`san_martin_sj` e `san_martin_tucuman` (Argentina)**: a tabela por
  país mostra o primeiro truncado como "San Juan" (sem o prefixo "San
  Martín") — casado por slug (`/san-martin-de-san-juan`) confirmado via
  página individual do clube. `san_martin_tucuman` casado por slug
  `/san-martin-de-tucuman`. Sem risco de troca entre os dois: slugs e
  cidades batem exatamente.
- **Peru — Liga 2, 0/18 confirmado**: a fonte lista `Binacional`,
  `Ayacucho FC` e `Alianza Universi[dad]` **cada um duas vezes**, com
  ratings diferentes (ex: Binacional aparece como 1380 e como "1436p"),
  sem nenhuma indicação de qual entrada corresponde a qual contexto (a
  mesma ambiguidade documentada na seção 1.1 pro caso `juan_pablo_ii`,
  que também aparece na tabela peruana). Não deu pra confirmar via
  página individual do clube (as tentativas de acessar `/Binacional` e
  variações caíram na home genérica do site, não numa página dedicada).
  Sem forma segura de saber qual valor usar — os 3 clubes ficaram sem
  `rating_inicial`. Os outros 15 clubes da Liga 2 (`academia_cantolao`,
  `ada_jaen`, `bentin_tacna_heroica`, `carlos_a_mannucci`,
  `comerciantes_fc`, `deportivo_llacuabamba`, `estudiantil_cni`,
  `fc_san_marcos`, `pirata_fc`, `santos_fc_pe`, `sport_huancayo_b`,
  `union_comercio_pe`, `union_minas`, `universidad_cesar_vallejo`,
  `universidad_san_martin`) simplesmente não têm nenhuma entrada na
  fonte — `comerciantes_fc` (Comerciantes FC, Iquitos) foi checado
  contra "Comerciantes Uni" da fonte (Nível 1) e confirmado ser clube
  diferente (Comerciantes Unidos), não usado. `sport_huancayo_b` (time
  reserva) não tem entrada própria — só o time principal (Nível 1)
  aparece na fonte, então nada foi atribuído (regra do time B/reserva
  só usar rating se a fonte tiver entrada específica pra ele).
- **Venezuela — Segunda División, 0/17 confirmado — fonte inacessível
  nesta rodada**: diferente da seção 1.1 (onde a Liga FUTVE saiu 14/14
  no snapshot de 2026-09-04), desta vez o fetch de `clubelo.com/Venezuela`
  consistentemente devolveu a página geral do site truncada **antes**
  de chegar na seção da Venezuela (a ordenação de países na página
  parece ser por força/Elo agregado, não alfabética, e o conteúdo
  processado corta sempre depois de "Sweden", bem antes de "Venezuela"
  — confirmado pedindo explicitamente a lista de todos os países
  presentes no conteúdo recebido, em múltiplas tentativas). Tentativas
  alternativas: API dedicada (`api.clubelo.com`) segue inacessível
  (mesmo timeout de rede da seção 1.1); `clubelo.com/VEN` (código do
  país) carrega uma página *diferente* da Venezuela (resultados de
  partida e estatísticas cabeça-a-cabeça contra outras seleções/países),
  não a tabela de ranking de clubes por nível — não tinha rating
  utilizável ali. Não é falta de busca, é limitação real de acesso à
  fonte nesta janela de tempo — fica pra uma próxima rodada tentar de
  novo (o tamanho da página cresce com o tempo, pode voltar a caber ou
  pode ser preciso outra estratégia de fetch).
- **Chile, Colômbia, Equador, Paraguai, Uruguai**: nenhuma ambiguidade
  nos casos confirmados — nomes batem exatamente ou de forma óbvia
  (ex: "Iquique" = `deportes_iquique`, "Envigado" = `envigado_fc`,
  "Vinotinto" = `vinotinto_ecuador`, "General Cabañero" truncado =
  `general_caballero_jlm` confirmado por slug `/General-Caballer`). Os
  clubes restantes de cada uma dessas competições não têm entrada na
  fonte — cobertura baixa de 2ª divisão é o esperado, não indica erro
  de busca.

**Cobertura fora do escopo desta rodada**: Bolívia não tem 2ª divisão
modelada (fora do projeto). Copa do Brasil, Libertadores/Sul-Americana,
estaduais brasileiros e qualquer outra pendência continuam de fora,
como já documentado nas seções 1.1/1.2.

## 2. Motor de partida — duelo por zona (estilo FM/Brasfoot)

Nenhum clube (fora o do jogador) tem elenco persistido — a força de cada
zona é **gerada por partida/temporada**, não guardada permanentemente. Isso
evita ter que manter uma base de ~600 elencos fictícios.

- Cada time tem 3 zonas agregadas: **Defesa**, **Meio**, **Ataque**. Pro
  time do jogador, os atributos reais dele entram na zona da posição dele
  com peso extra; o resto de cada zona (em qualquer time, incluindo o do
  jogador) é um **perfil gerado** a partir do `rating_inicial`/atual do
  clube, com variância — não é média fixa, sorteia dentro de uma faixa, pra
  time forte poder ter um dia ruim e time fraco poder ter uma zebra.
- **Duelo de Meio decide quantidade e distribuição de chances** (casa x
  fora, com aleatoriedade) — não decide gol direto. Quem vence o meio fica
  com mais chances no total, não domina sozinho.
- **Cada chance individual** vira `Ataque` de quem a tem vs `Defesa` do
  adversário + aleatoriedade → gol ou não. A aleatoriedade entra em pelo
  menos dois níveis (geração do perfil da zona + resolução de cada duelo),
  então um time mais forte tem mais chance de vencer, mas nunca é garantido
  — sem determinismo "melhor sempre ganha do pior".
- **Se a chance é do jogador**, ela ganha um **subtipo** (voleio, cabeceio,
  chute de fora, jogada individual, desarme, etc.), sorteado com peso pela
  posição dele e **pelo estilo do técnico** (técnico de jogo aéreo aumenta
  a chance de subtipos de cruzamento/cabeceio pra ele) — resolvida com o
  atributo específico daquele subtipo, não a zona inteira. Isso é o que
  conecta tática → quais atributos rendem XP mais rápido (pedido já
  existente na seção 5.2 do `game-design.md`).
- **Unifica as duas camadas de simulação**: partidas sem o jogador usam só
  a parte "agregada" do motor (mais barato de rodar em massa, pra
  centenas de jogos por rodada); partidas do clube do jogador usam a
  mesma mecânica, só que separando a fatia de chances dele pra resolução
  individual por atributo/subtipo.

## 3. Progressão do jogador — atributos sem perks

**Decisão**: sem perks/habilidades especiais desbloqueáveis. Tudo é
atributo numérico, estilo FIFA (0-99), por posição. Arquétipo não dá
habilidade nenhuma — só **acelera o crescimento** de atributos específicos.

- **Arquétipo = multiplicador de XP** (ex: 1.5×-2×) nos atributos
  prioritários dele (o conceito de `stats_prioritarios` por arquétipo, já
  em `game-design.md` seção 3.2, continua valendo — só o campo
  `perks_exclusivos` de cada arquétipo deixa de existir).
- **Atributo ganha XP quando é "usado"** num evento da partida (marcou de
  cabeça → XP em `cabeceio`), mais uma fração distribuída por desempenho
  geral. Curva de crescimento com **retorno decrescente perto de 99** (sair
  de 90→99 custa muito mais que 40→50) — mantém a "curva exponencial leve"
  já prevista no design original.
- **`nível`/overall deixa de ser recurso separado com slots de perk — vira
  derivado dos atributos** (tipo "OVR" do FIFA: média ponderada pelos
  atributos relevantes da posição/arquétipo). Simplifica bastante: não tem
  mais XP-pra-nível e XP-pra-atributo como coisas separadas, é uma curva só.
- **Idade modula a curva**: jovem cresce mais rápido em atributos físicos
  (velocidade, força física); veterano estabiliza ou decai no físico mas
  pode manter/subir em atributos mentais (visão de jogo, frieza,
  posicionamento).
- **Treino semanal** (já previsto na seção 5.2 do `game-design.md`)
  continua existindo — é onde o jogador escolhe direcionar XP de treino
  pra um atributo específico, complementando o XP ganho em campo.
- **XP de partida**: função de nota de desempenho (gols, assistências,
  ações defensivas bem-sucedidas, chances perdidas como penalidade leve),
  minutos jogados, e importância da partida (`peso_midia` do clássico já
  existe no schema; competição nacional > estadual; final > fase de
  grupos).

## 4. Pendências / próximos passos

- **Dados**: popular `rating_inicial` real (Elo ou equivalente) pros
  clubes com cobertura; calibrar fórmula de fallback pros demais. Frente
  de pesquisa separada, fica pra depois — não faz parte desta rodada de
  design.
- **Atributos por posição**: definir a lista exata de atributos por
  posição (goleiro tem um set bem diferente de um atacante) — pendência já
  listada em `game-design.md` seção 8, item 1.
- **Arquétipos das posições restantes** (goleiro, zagueiro, lateral,
  volante, meia) com atributos prioritários — mesma pendência da seção 8.
- **Fórmulas exatas**: `K` do Elo por tipo de partida, curva exata de XP
  por atributo, pesos do duelo de zona (quanto o atributo do jogador pesa
  vs. o perfil gerado do resto do time) — hoje é desenho conceitual, as
  constantes ficam pra quando a implementação permitir calibrar por teste.
- **Implementação**: nada em `src/simulation/`/`src/schemas/player.ts`
  ainda — ainda são stubs. Este doc é a base pra sair do stub.
