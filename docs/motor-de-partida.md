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

### 1.4. Pendência de dados — investigada (estaduais: SP, RJ, MG, RS)

**Fonte usada**: mesma das seções 1.1/1.2/1.3 — [clubelo.com](https://clubelo.com)
(Club Elo), tabela por país embutida no HTML de `clubelo.com/Brazil`,
snapshot do dia **2026-09-05**. Além da tabela por país, esta rodada
tentou também páginas de clube individual (`clubelo.com/<slug>`, em
várias variações de capitalização/hífen) pra alguns clubes tradicionais
que pareciam candidatos plausíveis a ter rating próprio mesmo fora da
tabela principal (Portuguesa-SP, Bangu, Boa Esporte, Ipatinga, Brasil de
Pelotas, Passo Fundo) — todas essas tentativas caíram na home genérica do
site, sem página dedicada, confirmando que o clube não tem entrada
rastreada individualmente pelo Club Elo.

**Resultado principal desta rodada: nenhum `rating_inicial` novo foi
adicionado.** Os 4 estados (SP, RJ, MG, RS) somam **138 clubes únicos**
entre `<uf>_estadual.json` e os clubes de `brasil.json` que jogam
estadual nesses estados; **29 já tinham `rating_inicial`** — todos
populados em rodadas anteriores (seção 1.1, pelo Brasileirão Série A, e
seção 1.2, pela Série B/C/D) — e os **109 restantes não têm nenhuma
entrada no Club Elo**, nem na tabela por país (que lista integralmente
Level 1/2/3 + a categoria "Lower", conferida linha a linha nesta rodada:
exatamente 20+20+20+4 = 64 clubes pro Brasil, sem clube novo desde a
seção 1.2) nem em página individual.

**Cobertura por estado** (clubes com `rating_inicial` / total de clubes
únicos do estadual, incluindo os que moram em `brasil.json`):

| Estado (competições) | Confirmados | Confirmados nesta rodada |
|---|---|---|
| SP (Paulistão A1-A4) | 14/64 | 0 |
| RJ (Carioca A, A2) | 5/22 | 0 |
| MG (Mineiro 1, 2) | 5/24 | 0 |
| RS (Gauchão 1, 2) | 5/28 | 0 |
| **Total** | **29/138** | **0** |

Os confirmados em cada estado vêm todos de clubes que também disputam
competição nacional (Série A/B/C, já cobertos nas seções 1.1/1.2):

- **SP**: `corinthians`, `palmeiras`, `sao_paulo`, `santos`,
  `red_bull_bragantino`, `guarani`, `ponte_preta`, `novorizontino`,
  `mirassol` (Série A/B/C, em `brasil.json`) + `sao_bernardo`,
  `botafogo_sp`, `ferroviaria`, `inter_de_limeira`, `ituano` (Série
  B/C/"Lower", em `sp_estadual.json`).
- **RJ**: `flamengo`, `fluminense`, `vasco_da_gama`, `botafogo` (Série A,
  em `brasil.json`) + `volta_redonda` ("Lower"/Série C, em
  `rj_estadual.json`).
- **MG**: `cruzeiro`, `atletico_mg`, `america_mg` (Série A/B, em
  `brasil.json`) + `tombense`, `athletic_club_mg` ("Lower"/Série B, em
  `brasil.json`).
- **RS**: `gremio`, `internacional`, `juventude` (Série A/B, em
  `brasil.json`) + `caxias`, `ypiranga_rs` (Série C, em `rs_estadual.json`).

**Clubes de Série D sem `rating_inicial` que jogam estadual desses 4
estados** (checados individualmente e ausentes da tabela/página do Club
Elo, mesma limitação já documentada na seção 1.2 pros outros 92 clubes
da Série D): `velo_clube`, `noroeste`, `xv_de_piracicaba` (SP, Paulistão
A1/A2); `nova_iguacu`, `portuguesa_rj`, `sampaio_correa_rj`, `america_rj`
(RJ, Carioca A/A2); `uberlandia_ec`, `pouso_alegre` (MG, Mineiro 1);
`sao_jose_rs`, `sao_luiz` (RS, Gauchão 1).

**Clubes puramente estaduais (sem competição nacional) — nenhum com
cobertura**: todos os demais clubes de `sp_estadual.json` (ex:
`portuguesa`, `primavera`, `capivariano`, e a totalidade do Paulistão
A3/A4), `rj_estadual.json` (ex: `bangu`, `boavista_rj`, `madureira`,
`americano`, `duque_de_caxias`, `olaria`), `mg_estadual.json` (ex: `urt`,
`betim_fc`, `boa_esporte`, `caldense`, `villa_nova`, `ipatinga_fc`) e
`rs_estadual.json` (ex: `avenida`, `guarany_bage`, `novo_hamburgo`,
`brasil_pelotas`, `passo_fundo`, `pelotas`) — nenhum apareceu na tabela
por país nem tem página individual própria. Isso bate com a expectativa
documentada no design (`game-design.md`/pedido desta rodada): divisão
estadual inferior/clube amador ou semi-profissional pequeno, sem
histórico de competição continental ou nacional relevante, não é
rastreado pelo Club Elo.

**Nenhuma ambiguidade de nome encontrada** — como nenhum clube novo foi
casado com a fonte nesta rodada, não houve caso de nome truncado,
entrada duplicada ou clube-satélite pra resolver (diferente das seções
1.1-1.3). Único cuidado ativo: confirmar que "Guarani" (SP, `guarani`,
1547) e "Santa Cruz" (PE, `santa_cruz`, 1505) da tabela nacional — já
atribuídos em rodada anterior — não fossem confundidos com os clubes
homônimos `guarani_mg` (MG), `guarani_va` (RS) e `santa_cruz_rs` (RS);
confirmado que os já atribuídos permanecem corretos e os homônimos
seguem sem `rating_inicial`.

**Cobertura fora do escopo desta rodada**: todos os outros estados
brasileiros (só SP/RJ/MG/RS foram investigados nesta rodada), Copa do
Brasil, Libertadores/Sul-Americana e qualquer outra pendência já listada
nas seções 1.1-1.3.

### 1.5. Pendência de dados — investigada e encerrada (demais 23 estados)

**Fonte usada**: mesma das seções anteriores — [clubelo.com](https://clubelo.com)
(Club Elo), tabela por país embutida no HTML de `clubelo.com/Brazil`,
snapshot do dia **2026-09-05**. Escopo: todos os estados brasileiros
não cobertos na seção 1.4 — **BA, PR, SC, PE, GO, DF, MT, MS, ES, CE,
RN, PB, SE, AL, PI, MA, PA, AM, TO, RO, AC, RR, AP** (23 estados) — os
204 clubes cadastrados em `src/data/clubes/<uf>_estadual.json` desses
estados, mais os clubes desses mesmos estados que moram em
`brasil.json` (33 clubes, checados só por completude — fora do escopo
de edição desta rodada).

**Resultado: nenhum `rating_inicial` novo foi adicionado. Esta é a
última rodada planejada da frente de pesquisa de `rating_inicial` —
ver conclusão geral ao final desta seção.**

**Passo 1 — recheck da tabela por país**: a tabela por país do Club
Elo pra Brasil (Level 1/2/3 + "Lower") segue com exatamente **64
clubes** (20+20+20+4), os mesmos já atribuídos nas seções 1.1/1.2 —
nenhum clube novo apareceu desde o snapshot da seção 1.2. Isso já era
esperado (documentado na própria tarefa desta rodada): a tabela por
país só rastreia a pirâmide nacional (Série A-D), não clube que só
disputa estadual.

Cruzando os 204 clubes dos 23 estados contra `divisao_nacional`: **11
já tinham `rating_inicial`**, todos clubes de Série C/Nível 3 ou da
categoria "Lower" de Série D já atribuídos nas seções 1.1/1.2 (moram no
`<uf>_estadual.json` do seu estado em vez de `brasil.json`, mesma nota
estrutural da seção 1.2) — `maringa_fc`/`brusque_fc`/`figueirense`/
`barra_fc` (PR/SC), `retro` (PE), `anapolis_fc` (GO), `floresta` (CE),
`abc_rn` (RN), `botafogo_pb` (PB), `itabaiana` (SE), `mac` (MA). Os
demais clubes com `divisao_nacional` nível 4 (Série D) desses 23
estados — `atletico_alagoinhas`/`jacuipense`/`juazeirense`/`porto_ba`
(BA), `fc_cascavel`/`cianorte`/`azuriz` (PR), `joinville`/`marcilio_dias`
(SC), `maguary`/`decisao`/`central_pe` (PE), `aparecidense`/`abecat`/
`crac`/`goiatuba`/`inhumas` (GO), `luverdense`/`mixto` (MT),
`ivinhema` (MS), `real_noroeste` (ES), `ferroviario_ce`/`maracana_ce`/
`iguatu`/`tirol`/`atletico_cearense` (CE), `america_rn`/`laguna` (RN),
`serra_branca`/`sousa`/`treze` (PB), `lagarto`/`sergipe_fc` (SE),
`asa`/`cse` (AL), `fluminense_pi`/`piaui_ec`/`altos`/`parnahyba` (PI),
`imperatriz`/`iape`/`sampaio_correa_ma`/`moto_club` (MA), `tuna_luso`/
`aguia_de_maraba` (PA), `manaus_fc`/`nacional_am`/`manauara` (AM),
`araguaina`/`tocantinopolis` (TO), `porto_velho_ec`/`guapore_fc` (RO),
`independencia_ac`/`galvez`/`humaita_ac` (AC), `monte_roraima`/
`sao_raimundo_rr`/`gas` (RR), `oratorio`/`trem` (AP), `gama`/`ceilandia`/
`capital_cf`/`brasiliense` (DF) — **nenhum** tem entrada na tabela
(confirmado no recheck do passo 1; mesmo padrão exaustivo já documentado
na seção 1.2 pros 92 clubes de Série D sem cobertura). O restante dos
204 clubes não tem `divisao_nacional` nenhuma (clube puramente
estadual) e, por natureza, nunca foi candidato à tabela por país.

**Passo 2 — checagem individual de candidatos notáveis**: como a
tarefa desta rodada instruiu explicitamente a não gastar tempo tentando
slugs pra clube pequeno, mas a investigar individualmente qualquer
clube que parecesse "tradicional de capital com histórico relevante",
avaliei os clubes puramente estaduais (sem `divisao_nacional`) desses
23 estados por relevância histórica e escolhi 3 candidatos plausíveis
pra checagem de página individual (`clubelo.com/<slug>`): **Campinense
Clube** (PB — "Raposa", disputou Copa Sul-Americana 2009, referência
de continental relevance), **Desportiva Ferroviária** (ES — clube
tradicional de Cariacica, disputou Série B nas décadas de 1980-90) e
**Galícia Esporte Clube** (BA — um dos clubes mais antigos de Salvador,
fundado 1913). As três tentativas caíram na home genérica do site
(`clubelo.com/Campinense`, `/Desportiva`, `/Galicia`), sem página
dedicada — mesmo resultado da seção 1.4 pros equivalentes de SP/RJ/MG/RS
(Portuguesa-SP, Bangu, Boa Esporte, Ipatinga, Brasil de Pelotas, Passo
Fundo). Não fiz mais tentativas de slug pra esses 3 nem pra outros
clubes menores — dado que nem clubes tradicionais com passagem recente
por Série A (Ipatinga) ou relevância continental documentada
(Campinense) aparecem, não há razão pra esperar cobertura em clube
ainda menor.

**Cobertura por estado** (clubes com `rating_inicial` / total de
clubes únicos do estadual — nenhum confirmado nesta rodada em nenhum
estado):

| Estado | Confirmados / total | Estado | Confirmados / total |
|---|---|---|---|
| BA | 0/18 | SE | 1/9 |
| PR | 1/7 | AL | 0/6 |
| SC | 3/8 | PI | 0/8 |
| PE | 1/15 | MA | 1/8 |
| GO | 1/9 | PA | 0/10 |
| DF | 0/10 | AM | 0/7 |
| MT | 0/6 | TO | 0/8 |
| MS | 0/9 | RO | 0/7 |
| ES | 0/7 | AC | 0/8 |
| CE | 1/9 | RR | 0/9 |
| RN | 1/8 | AP | 0/8 |
| PB | 1/10 | | |
| **Total** | **11/204** | | |

(Os 11 confirmados vêm todos de rodadas anteriores — seções 1.1/1.2 —
por o clube também disputar Série C/D nacional; **0 novos** nesta
rodada.)

**Conclusão da frente de pesquisa de `rating_inicial` (encerrada)**:
com SP/RJ/MG/RS (seção 1.4) e os demais 23 estados (esta seção) ambos
resultando em zero cobertura nova de clube puramente estadual, dá pra
fechar esta frente como **explorada até o limite razoável da fonte
disponível**: o Club Elo rastreia bem a pirâmide nacional brasileira
(Série A/B/C, mais um punhado de Série D com queda recente ou
relevância histórica) e as primeiras/segundas divisões CONMEBOL, mas
não tem cobertura de campeonato estadual brasileiro — nem para os
maiores estados/mercados (SP, RJ, MG, RS) nem para os menores. Não há
próxima rodada planejada pra `rating_inicial`; os cerca de 570 clubes
sem rating real (todo clube puramente estadual, mais a maioria da
Série D e das 2ªs divisões CONMEBOL) seguem usando
`calcularRatingFallback` (`src/simulation/rating.ts`) — isso é o
resultado esperado e aceitável do design original (seção 1, acima):
fallback por `nivel` de divisão + `forca_financeira` pra clube sem
exposição competitiva nacional/continental relevante. Se uma fonte de
rating histórico diferente (ex: dados de federação estadual, ranking
CBF) for encontrada no futuro, popular esses clubes pode ser retomado
como pendência nova — mas não faz parte do escopo original desta
frente (Club Elo).

**Cobertura fora do escopo desta rodada**: Copa do Brasil,
Libertadores/Sul-Americana e qualquer outra pendência já listada nas
seções 1.1-1.4 (não mudaram de status).

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

## 4. Cenários de múltipla escolha da carreira (implementado)

Cobre "Narrativa de carreira" e "Vida fora de campo" (`game-design.md`
seções 5.1 e 5.3: lesões, imprensa regional, dilemas de proposta/lealdade,
rivalidades pessoais, vida pessoal/mudança de cidade, relação com comissão
técnica/elenco/diretoria, patrocínios, reputação regional, agente/contrato,
convocação, momentos dentro de uma partida — pênalti decisivo, discussão
com árbitro). Implementado em `src/progression/scenarios.ts`, com catálogo
de 200 cenários (`CENARIOS`, propositalmente grande e variado pra que
carreiras diferentes não repitam sempre os mesmos dilemas — ver pendência
de condições de gatilho abaixo) e demo via `npx tsx src/cli/index.ts cenario`.

- **Cenário** tem 2-3 **opções**; cada opção tem 1+ **resultados
  possíveis**, cada um com probabilidade própria (`resolverEscolha` sorteia
  qual acontece — a mesma escolha pode dar certo ou errado, não é
  determinística) e um **impacto**: delta de atributo (direto, não passa
  pela curva de retorno decrescente de XP de partida — evento narrativo
  pontual, não desempenho em campo), delta de moral, delta de reputação
  nacional, delta de reputação **regional**, delta de **relações
  internas**.
- `aplicarImpacto` clampa atributo em 1-99, moral/reputação/relações em
  0-100, sem mutar o estado recebido. O delta de reputação regional só é
  aplicado se quem chama informar `regiaoAtual` (normalmente a UF do clube
  atual) — o cenário em si é genérico e não sabe de região; sem essa
  informação o delta regional fica sem efeito, silenciosamente (documentado,
  não é bug).
- **Reputação agora é separada por escopo** (`Reputacao {nacional,
  porRegiao}`, `progression/scenarios.ts`): reflete a ideia de "ídolo local
  no estadual x desconhecido fora do estado" (`game-design.md` seção 5.3) —
  região sem entrada em `porRegiao` equivale a 0.
- **`relacoesInternas`** (`progression/scenarios.ts`/`career/Player.ts`): um
  único número 0-100 agregando elenco + comissão técnica + diretoria (não
  três stats separadas) — puramente conceitual até existir sistema de
  minutagem/renovação de contrato que de fato leia esse valor.
- **Patrocínios** (`src/career/patrocinios.ts`): catálogo `PATROCINIOS`
  (regional ou nacional, cada um com `reputacaoMinima` e
  `valorPorTemporada`), `patrociniosDisponiveis(reputacao, regiaoAtual?)`
  filtra o catálogo pela reputação/região atuais. Não é negociação de
  contrato nem economia da Fase 4 — é só uma renda simples somada ao
  `patrimonio` do jogador a cada `avancarTemporada`.
- **`moral`/`reputacao`/`relacoesInternas`/`patrimonio` têm lar**:
  `src/career/Player.ts` (`EstadoDeCarreira`) junta `Jogador` +
  `clubeAtualId` + `temporada` + esses campos num só lugar — o "save" da
  carreira. Funções puras: `criarEstadoInicial` (jovem promessa, atributos
  prioritários do arquétipo um pouco acima dos demais, reputação de
  estreante via `criarReputacaoInicial`), `overallAtual` (derivado, nunca
  guardado), `aplicarDesempenhoPartida` (liga `chancesJogador` de
  `simularPartida` ao XP), `aplicarImpactoDeCenario` (liga este módulo,
  aceita `regiaoAtual?` opcional), `transferirParaClube`, `avancarTemporada`
  (idade+temporada +1, curva de pico/declínio, soma renda de patrocínios
  disponíveis pra `regiaoAtual?` informada). Demo completa (partida real →
  XP → cenário → impacto → nova temporada, com renda de patrocínio) via
  `npx tsx src/cli/index.ts carreira`.

## 5. Loop de calendário (implementado, cobertura parcial por design)

`src/simulation/engine.ts` — `simularTemporada(temporada, campeonatos, clubes, participacaoJogador?)`
lê `construirCalendarioPadrao` (`data/loaders/calendario.ts`), reúne todas
as competições ativas em algum período do ano e simula cada uma.

- **`escolherReceita` confere primeiro um registro por id** (`RECEITAS_POR_ID`
  — hoje só `argentina_primera` → `receitaArgentina`, ver seção 6) **antes**
  de cair no despacho genérico por combinação exata de blocos de `formato`
  (`Object.keys` ordenado) — só 3 combinações são estruturalmente
  inambíguas o bastante pra despachar por formato sozinho: só
  `pontos_corridos`; só `mata_mata`; `fase_grupos`+`mata_mata`
  (classificados do grupo alimentam o mata-mata direto — cobre a maioria
  dos estaduais brasileiros). **Por que precisa do registro por id**: o
  Carioca usa a mesma combinação de blocos que a Argentina
  (`final_estadual`+`returno`+`turno`) com significado bem diferente —
  não dá pra despachar isso só pela combinação de blocos, precisa saber
  qual competição é. Combinações ainda sem receita nenhuma (a maioria dos
  países CONMEBOL, Carioca, Paulistão A1/A2, etc.) — ver pendência na
  seção 6.
- **Falha isolada, não em cascata**: uma competição sem receita (ou com
  dado incompatível — ex: Libertadores/Sul-Americana, cujo `times[]` inclui
  clubes da fase preliminar além dos 32/56 do corpo principal, então a
  validação de tamanho de `simularFaseDeGruposDoFormato` rejeita) aparece
  com `erro` no resultado daquela competição específica, sem derrubar as
  demais.
- **Validado contra o calendário padrão real**: das 11 competições
  referenciadas, 4 rodam automaticamente hoje (Brasileirão A/B/D, Copa do
  Brasil) — as outras 7 falham de forma esperada e documentada (combinação
  sem receita ou fase preliminar não coberta). Demo via
  `npx tsx src/cli/index.ts temporada`.
- **Bug real encontrado e corrigido nessa validação**: `calendario.ts`
  referenciava `"mineiro_1"`/`"gauchao_1"`, mas o campo `id` real desses
  dois arquivos é `"mineiro_modulo_1"`/`"gauchao_a"` (o nome do arquivo
  segue a convenção `_1`/`_2` de outros estados, mas o `id` interno segue o
  nome oficial da competição — inconsistência pré-existente, não
  introduzida por esta mudança). Corrigido pra apontar pro `id` certo.

## 6. Pendências / próximos passos

- **Dados de `rating_inicial`**: resolvida a parte que dava pra resolver —
  267/678 clubes com rating real (ver seções 1.1-1.5), o resto no fallback
  por decisão de design documentada (clube sem exposição competitiva
  nacional/continental não tem histórico público pra puxar).
- ~~Curva de pico/declínio por idade~~ **resolvida**: `progression/aging.ts`
  (`aplicarDeclinioPorIdade`), ligada em `avancarTemporada`. Físico
  (velocidade, força, resistência, jogo aéreo, reflexos) tem pico aos 26 e
  decai 2 pontos/temporada depois; mental/técnico (o resto, exceto
  liderança) tem pico aos 30 e decai 0.8/temporada; liderança nunca decai.
  Antes do pico, nada muda automaticamente aqui — o crescimento de jovem
  continua vindo só do multiplicador de XP do arquétipo
  (`progression/xp.ts`). Constantes são estimativa de design, não fórmula
  validada — mesma ressalva de "Fórmulas exatas" abaixo.
- **Cenários — condições de gatilho não definidas**: hoje `sortearCenario`
  só sorteia da lista toda, sem noção de "quando" cada cenário pode
  aparecer (ex: proposta de clube grande só faz sentido em janela de
  transferência, lesão só em período de jogos) — falta ligar isso ao
  calendário/game loop.
- **Fórmulas exatas**: `K` do Elo por tipo de partida, curva exata de XP
  por atributo, pesos do duelo de zona (quanto o atributo do jogador pesa
  vs. o perfil gerado do resto do time) — hoje é desenho conceitual, as
  constantes ficam pra quando a implementação permitir calibrar por teste.
- ~~Ligar `ParticipacaoJogador` em grupos/mata-mata/suíça~~ **resolvido**:
  `season.ts`/`groups.ts`/`knockout.ts`/`swiss.ts` aceitam um
  `ParticipacaoJogadorClube` opcional (`match.ts`) e devolvem
  `partidasDoJogador` com o resultado de cada partida do clube dele
  (`resolverConfronto` trata ida-e-volta corretamente, alternando o lado
  por perna). Validado com smoke test real (Boca Juniors no Apertura
  argentino, 29 partidas).
- **Receitas de simulação bespoke pras competições com formato composto**
  (ver seção 5): **Argentina resolvida** (`receitaArgentina`, registrada
  por id em `RECEITAS_POR_ID` — precisou ser por id, não por formato,
  porque o Carioca usa a mesma combinação de blocos `final_estadual`+
  `returno`+`turno` com significado diferente, final de verdade em vez de
  reconciliação por tabela). Ainda faltam: Uruguai, Paraguai, Peru,
  Colômbia, Venezuela, Carioca, Paulistão A1/A2, Mineiro, Gauchão,
  Libertadores/Sul-Americana (fase preliminar). Nota: `argentina_primera`
  ainda não é referenciada pelo calendário padrão (`calendario.ts` só
  cobre Brasil + continentais hoje), então a receita foi validada
  chamando `receitaArgentina` direto (testes + smoke test contra dado
  real, campeão Boca Juniors), não ainda via `simularTemporada`.
- **Estado de carreira não persiste entre temporadas via `engine.ts`**:
  `simularTemporada` devolve resultados por competição, mas quem aplica
  `partidasDoJogador` ao `EstadoDeCarreira` (`career/Player.ts`) ainda é
  responsabilidade de quem chama (ver `src/cli/index.ts` `simularCarreira`
  pra um exemplo manual de uma partida só) — falta um laço que faça isso
  pra todas as partidas de uma temporada inteira automaticamente.
