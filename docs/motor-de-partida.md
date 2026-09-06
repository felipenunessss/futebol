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
- **Gatilhos — cenário elegível conforme o contexto** (`Cenario.gatilho?`,
  `ContextoSorteio`, `cenarioElegivel`, `filtrarCenariosElegiveis`, todos em
  `progression/scenarios.ts`): resolve a pendência de "sortear da lista
  toda sem noção de quando" (ver histórico na seção 6). `Gatilho` é um
  conjunto de condições opcionais — idade mín/máx, reputação nacional
  mín/máx, reputação regional mín/máx, moral mín/máx, relações internas
  mín/máx, e `momentos` (`MomentoDeCarreira`: `pre_temporada` |
  `temporada_regular` | `reta_final` | `pos_temporada`, uma categoria
  simples de fase da temporada, não o `periodo` granular de
  `data/loaders/calendario.ts`). Cenário sem `gatilho` é elegível sempre —
  compatível com o catálogo anterior. `filtrarCenariosElegiveis(CENARIOS,
  contexto)` deve ser chamado antes de `sortearCenario` pra restringir o
  sorteio ao que faz sentido agora; sem filtrar antes, `sortearCenario`
  continua funcionando exatamente como antes (sorteia de qualquer lista
  passada, sem saber de gatilho). Se `ContextoSorteio.momento` não for
  informado, gatilhos de `momentos` ficam permissivos (não filtram) — é
  o caso de quem ainda não ligou isso ao calendário. Demo via
  `npx tsx src/cli/index.ts cenario [momento]` (ex: `cenario pre_temporada`)
  mostra quantos dos 200 cenários ficam elegíveis pro momento escolhido.
- **Momento ligado ao calendário real** (`momentoDoPeriodo`,
  `momentoPorProgresso`, ambos em `progression/scenarios.ts`):
  `momentoDoPeriodo(periodo)` mapeia o `periodo` (string livre de
  `PeriodoCalendario`) pro `MomentoDeCarreira` mais próximo — hoje só
  `"jan-1a_quinz"` vira `pre_temporada` (ainda dentro da janela de
  transferência real, mesmo com os primeiros jogos de estadual já
  rolando), o resto (`fev`/`mar`/`abr`/`mai-nov`) vira `temporada_regular`.
  **Limitação real, não escondida**: o período `"mai-nov"` sozinho cobre 7
  meses — de meio de temporada a reta final de verdade (rodadas finais de
  Brasileirão/Libertadores em out-nov) — e o calendário padrão não tem
  granularidade pra distinguir isso, então nenhum período mapeia pra
  `"reta_final"` hoje. Pra quem já sabe a rodada/fase exata (não só o mês),
  `momentoPorProgresso(progresso 0-1)` é mais preciso (`>= 0.85` já conta
  como reta final). `src/cli/index.ts` `carreira` usa `momentoDoPeriodo`
  de verdade: percorre os períodos de `construirCalendarioPadrao` da
  temporada do jogador e sorteia um cenário elegível em cada um, mostrando
  o catálogo elegível mudar de tamanho por período (ex: só ~72/200
  elegíveis em `jan-1a_quinz`/`pre_temporada` contra ~123/200 no resto do
  ano, na prática — os números variam com o estado do jogador).
  **Reclassificação concluída**: dos 200 cenários do catálogo, 146 têm
  `gatilho` definido (idade/reputação/moral/relações/momento, conforme o
  que cada narrativa pressupõe — ex: convocação de seleção exige
  reputação nacional, cenários dentro de uma partida exigem
  `temporada_regular`/`reta_final`, contrato/transferência exige
  `pre_temporada`), e 54 ficam deliberadamente sem `gatilho` por serem
  genuinamente atemporais (podem acontecer com qualquer jogador, a
  qualquer momento/idade/reputação — ex: atrito com colega, redes
  sociais, vida pessoal sem ligação a calendário).

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

### 5.1. Game loop de carreira persistente (implementado)

`src/career/career-loop.ts` — `jogarTemporada(estado, campeonatos, clubes,
opcoes?)` junta todas as peças que antes só eram orquestradas na mão pela
demo de CLI (`npx tsx src/cli/index.ts carreira`) numa única função pura:

1. Monta a `ParticipacaoJogadorClube` a partir do `EstadoDeCarreira` (clube
   atual, jogador, `estiloTecnico` — padrão `"equilibrado"`) e chama
   `simularTemporada` (seção 5) pra rodar o calendário de competições
   inteiro.
2. Aplica o XP de **cada** partida do jogador em qualquer competição, em
   ordem (`aplicarDesempenhoPartida`, `career/Player.ts`) — o overall
   evolui partida a partida, não só uma vez por temporada.
3. Percorre os períodos do calendário da temporada
   (`construirCalendarioPadrao`) e sorteia+resolve um cenário elegível em
   cada um, usando `momentoDoPeriodo` (seção 4) pra saber o momento de
   cada período — o mesmo mecanismo que a demo de CLI já usava, agora sem
   precisar chamar na mão.
4. Ao final, chama `avancarTemporada` (idade+temporada+1, declínio por
   idade, renda de patrocínio).

Devolve `{ estado, resultadoTemporada, cenariosResolvidos }` — o novo
`EstadoDeCarreira`, o resultado bruto do calendário (pra inspecionar quais
competições rodaram) e a lista de cenários resolvidos na ordem em que
aconteceram. **Não muta o `estado` recebido.**

`jogarCarreira(estadoInicial, quantidadeDeTemporadas, campeonatos, clubes,
opcoes?)` encadeia `jogarTemporada` N vezes, alimentando o estado final de
uma temporada na próxima — o "save" avançando sozinho por várias
temporadas seguidas. Devolve `{ estadoFinal, temporadas: [...] }` (uma
entrada por temporada).

- **`opcoes.escolherOpcao`** (padrão: sempre a primeira opção do cenário,
  mesmo comportamento das demos de CLI) é injetável — outra função pode
  plugar uma interface real (jogador humano escolhendo, IA, sempre a opção
  mais segura, etc) sem mudar o loop.
- **`regiaoAtual` é derivada automaticamente** de `Club.estado` a cada
  período, a partir do `clubeAtualId` corrente — acompanha uma
  transferência de clube dentro da própria temporada (ver seção 5.2).
  `opcoes.regiaoAtual` só serve de fallback pra clube sem `estado` (a
  maioria dos clubes fora do Brasil).
- **Simplificações documentadas, não bugs escondidos**: toda partida do
  jogador é tratada como 90 minutos jogados e importância 1 — não existe
  sistema de minutagem/banco nem diferenciação de fase (final de
  mata-mata vs. fase de grupos) dentro de `partidasDoJogador` ainda (ver
  pendências).
- **Validado com dado real**: `npx tsx src/cli/index.ts carreira-loop
  [clubeInicialId] [N]` (padrão Corinthians, 3 temporadas) roda com o
  calendário completo (Brasil + continentais + estaduais) — overall
  subindo de 39 pra 71 em 3 temporadas simuladas com o Corinthians;
  rodando com um clube pequeno (`portuguesa`) por 5 temporadas, o jogador
  foi efetivamente transferido duas vezes (Portuguesa → Gama → ADT) por
  negociação de mercado de verdade (ver seção 5.2). `npx tsx src/cli/index.ts
  clubes [pais]` lista ids de clube pra escolher `clubeInicialId`.

### 5.2. Mercado e negociação de transferências (adiantado da Fase 4, implementado)

Fase 4 (`docs/game-design.md` seção 4) estava planejada pra depois do
motor de partida/progressão — a pedido explícito, adiantamos a parte
central dela (valorização + negociação ativa + teto salarial) pra já
funcionar dentro do game loop persistente (seção 5.1), em vez de ficar só
como cenário narrativo (`proposta_clube_grande` etc, que continuam
existindo e coexistem com isso — ver ressalva abaixo).

- **`src/market/valuation.ts`** — `calcularValorDeMercado({overall, idade,
  reputacaoNacional})`: valor em reais fictícios (mesma escala de
  `career/patrocinios.ts` e do exemplo original de `game-design.md` seção
  4). Cresce com o cubo do overall acima de 40 (rookie sem overall
  suficiente vale zero), tem um platô de idade 24-29 (multiplicador 1×,
  caindo pra fora dessa faixa — mesmo espírito das curvas de
  `progression/aging.ts`, mas pro valor, não pro atributo) e um bônus de
  até 50% pela reputação nacional. **Sem perks** (o design original usava
  "nível + perks" — aqui é overall derivado, coerente com o resto do
  design sem perks). Também expõe `calcularRatingDeInteresse({overall,
  idade, reputacaoNacional})` — rating "equivalente" do jogador na mesma
  escala tipo Elo dos clubes (`simulation/rating.ts`, ~1000-2100): rookie
  overall 39/reputação 10 fica em ~1449, estrela overall 90/reputação 90
  fica em ~2170. Existe especificamente pra garantir que o **interesse de
  mercado seja factível com o desempenho real do jogador** (overall, que
  é derivado de XP de partida) — ver `selecionarClubesInteressados`
  abaixo.
- **`src/market/transfers.ts`**:
  - `estaNaJanelaDeTransferencia(momento)` — reaproveita
    `MomentoDeCarreira` (seção 4) em vez de inventar um conceito de janela
    separado; hoje só `pre_temporada` conta como aberta (mesma limitação
    de granularidade do calendário documentada em `momentoDoPeriodo`).
  - `tetoSalarialMensal(club)` — vem de `Club.forca_financeira`
    (`muito_alta` a `muito_baixa`) quando disponível; sem isso, fallback
    por `divisao_nacional.nivel`, mesmo padrão de
    `simulation/rating.ts` `calcularRatingFallback`.
  - `selecionarClubesInteressados(clubes, clubeAtualId, perfil, opcoes?)`
    — 3 filtros: (1) por padrão, rating esportivo
    (`simulation/rating.ts`) igual ou maior que o clube atual
    (desligável via `opcoes.exigirUpgrade: false`, usado pela venda
    forçada abaixo); (2) rating do clube interessado não pode passar
    muito de `calcularRatingDeInteresse` do jogador (+ margem de ~1
    nível de divisão) — **resolve o pedido explícito de garantir que
    interesse de clube maior seja plausível com o desempenho do
    jogador**, não só com o rating do clube atual dele (antes disso, um
    jogador fraco num clube fraco atraía qualquer clube "melhor que o
    atual", incluindo gigantes); (3) capacidade financeira de bancar uma
    fração do valor de mercado. Embaralha (com `random` injetado) e
    recorta em até 3 (padrão).
  - `gerarProposta(clube, valorDeMercado, random?)` — proposta inicial
    abaixo do teto salarial do clube e da referência de valor de mercado
    (valor de mercado ~ 2 anos de salário), deixando espaço de negociação.
- **`src/market/negotiation.ts`**:
  - `contrapropostaPadrao(proposta)` — estratégia padrão do jogador (pede
    mais salário/luvas que a oferta inicial) — injetável
    (`OpcoesJogarTemporada.responderProposta` no game loop).
  - `calcularConfiancaDoClube(propostaClube, contraproposta, fatores)` —
    0-100, substitui a "barra de confiança do clube" de `game-design.md`
    seção 4: cai com o gap salarial pedido, sobe com overall/reputação do
    jogador, cai com quantos outros clubes concorrem pela mesma
    contratação (**substitui** o fator original "perks relevantes pro
    esquema tático", que não existe nesse design sem perks).
  - `negociarTransferencia(proposta, contraproposta, fatores,
    temporadaAtual, random?)` — **probabilístico**, não determinístico
    (mesma filosofia de risco/retorno dos cenários de carreira,
    `progression/scenarios.ts`): sorteia se o clube aceita ponderado pela
    confiança; se aceito, monta um `Contrato`
    (`src/schemas/contract.ts`: salário mensal, luvas, cláusula de
    rescisão estimada, anos, temporada de assinatura).
- **`career/Player.ts`**: `EstadoDeCarreira.contratoAtual?: Contrato`
  (ausente até a primeira negociação de mercado bem-sucedida — jogador
  recém-criado não tem contrato registrado, simplificação documentada).
  `assinarContrato(estado, contrato)` troca o clube e registra o
  contrato; `transferirParaClube` (já existia) continua disponível pra
  mover o jogador sem negociação, pra uso puramente narrativo.
- **Venda forçada por necessidade financeira** (`career/club-finances.ts`
  `precisaVender(club, random?)`, `Opcao.disparaVendaForcada`,
  `progression/scenarios.ts` `venda_forcada_por_necessidade_financeira`):
  a cada janela de transferência, o clube atual pode precisar vender o
  jogador pra fazer caixa — probabilidade por temporada calibrada por
  `Club.forca_financeira` (2% pra `muito_alta` até 40% pra
  `muito_baixa`; 15% sem dado financeiro). **Não é simulação de fluxo de
  caixa de verdade** (fica pra uma peça bem maior de Fase 4) — é só uma
  probabilidade. Quando dispara, os compradores candidatos vêm de
  `selecionarClubesInteressados` com `exigirUpgrade: false` (um clube
  desesperado por caixa vende pra qualquer comprador capaz de pagar, não
  só clubes maiores) — ainda respeitando o teto de
  `calcularRatingDeInteresse`. O cenário tem 2 opções: "aceitar a saída"
  (`disparaVendaForcada: true`, dispara a negociação de verdade) e
  "resistir" (100% narrativo — só desgasta ou não a relação com a
  diretoria, não força uma transferência incoerente com o resultado
  narrativo — ver ressalva abaixo).
- **Unificado com os cenários narrativos de transferência** — não são mais
  duas coisas "coexistindo sem se referenciar" (ver histórico na seção
  6). `Opcao.disparaNegociacaoReal` marca a opção de "buscar a saída" nos
  3 cenários de interesse de compra que já existiam
  (`proposta_clube_grande`/`aceitar_agora`,
  `proposta_do_exterior`/`topar_o_desafio`,
  `agente_pressiona_transferencia`/`seguir_o_conselho_do_agente`);
  `Opcao.disparaVendaForcada` marca a opção equivalente no cenário de
  venda forçada (ambos os campos em `progression/scenarios.ts`). Em
  `career/career-loop.ts` `jogarTemporada`, a cada período: se a janela de
  transferência está aberta e existe interesse real (de compra ou de
  venda forçada), o sorteio de cenário fica restrito aos cenários "de
  transferência" do tipo correspondente elegíveis (em vez de competir
  contra o catálogo inteiro) — venda forçada tem prioridade se os dois
  calharem no mesmo período. Garante que a negociação real sempre venha
  acompanhada da moldura narrativa certa. **Sem** interesse real (de
  nenhum dos dois tipos), cenários de transferência nem entram no sorteio
  (nunca promete proposta que não existe mecanicamente). Ao escolher a
  opção marcada, o desfecho não vem da probabilidade estática do cenário:
  dispara a negociação de verdade (gera+negocia uma proposta por clube
  interessado, parando no primeiro que aceitar) — `resultados[0]` do
  cenário vira o molde de narrativa/impacto se a negociação for aceita,
  `resultados[último]` se for recusada. Escolher a opção de recusar/ficar
  continua 100% narrativo (nenhuma negociação é tentada) — pra evitar o
  desfecho incoerente de "narrativa diz que você foi vendido mesmo
  resistindo, mas mecanicamente nada mudou", o cenário de venda forçada
  foi desenhado pra "resistir" nunca resultar em venda (só desgaste ou
  alívio na relação com a diretoria). No máximo uma transferência aceita
  por temporada.
- **Estimativas de design, não fórmulas validadas** (mesma ressalva de
  Elo/XP/valorização): todas as constantes de teto salarial, referência
  salarial, fatores de confiança, cláusula de rescisão, rating de
  interesse e probabilidade de venda forçada foram calibradas só pra dar
  uma progressão que "sente" certa, não a partir de dado real de mercado.
- **Validado com dado real**: `npx tsx src/cli/index.ts carreira-loop
  portuguesa 10` — Portuguesa (clube pequeno, sem `forca_financeira`
  cadastrada) teve 8 negociações de transferência ao longo de 10
  temporadas simuladas (mistura de interesse de compra e venda forçada),
  o jogador foi efetivamente transferido 6 vezes, e — com o teto de
  `calcularRatingDeInteresse` em vigor — os clubes interessados ficaram
  consistentemente no mesmo patamar do overall real do jogador (que
  estagnou em ~57-58 por várias temporadas), em vez de atrair gigantes
  desproporcionais como acontecia antes dessa mudança.

### 5.3. Carreira interativa (implementado)

`jogarTemporada`/`jogarCarreira` (`career/career-loop.ts`) sempre
aceitaram `escolherOpcao`/`responderProposta` injetáveis (ver seção
5.1) — a peça que faltava era só uma interface de verdade plugando
essas funções a uma entrada humana em vez de "sempre a primeira opção".
`npx tsx src/cli/index.ts jogar` é essa interface: cria o personagem
(nome, posição, arquétipo — filtrado pela posição escolhida via
`ARQUETIPOS` — e clube inicial, com um atalho `listar [pais]` embutido
no próprio prompt) e depois joga temporada por temporada, te
perguntando de verdade qual opção escolher em cada cenário.

- **`escolherOpcao`/`responderProposta` agora podem ser assíncronos**
  (`Opcao | Promise<Opcao>`, `TermosDeContrato | Promise<TermosDeContrato>`)
  — por isso `jogarTemporada`/`jogarCarreira` viraram `async`/retornam
  `Promise`. Isso é o que permite esperar de verdade a resposta do
  terminal (`node:readline/promises`) no meio do loop, sem quebrar o
  comportamento síncrono de quem não precisa disso (as demos
  `carreira`/`carreira-loop` continuam funcionando, só com um `await` a
  mais na chamada).
- **Hooks em `OpcoesJogarTemporada`** chamados no momento exato em que
  cada coisa é resolvida (não só no fim da temporada) — é o que permite
  mostrar o desfecho em tempo real na tela: `onPartidasResumidas` (uma
  vez por temporada, resumo agregado das partidas — ver ressalva
  abaixo), `onTreinoResolvido` e `onCenarioResolvido` (uma vez por
  período) e `onNegociacaoResolvida` (uma vez por proposta negociada).
- **As opções são mostradas sem revelar probabilidade/resultado de
  antemão** — só o texto de cada opção; o desfecho (narrativa + impacto,
  ou o resultado real de uma negociação) só aparece depois de escolher.
  Mais parecido com jogar de verdade do que a exibição de
  `npx tsx src/cli/index.ts cenario`, que mostra tudo de antemão (essa
  continua existindo como ferramenta de inspeção do catálogo, não como
  "jogo").
- **Contraproposta de transferência continua automática**
  (`contrapropostaPadrao`) nesta versão — negociar os termos (salário,
  luvas, anos) na mão é a próxima extensão natural, ainda não feita.
- **Validado com um terminal de verdade** (não só piping de respostas
  pré-definidas, que fecha o stdin antes da hora e quebra
  `readline/promises` — comportamento conhecido do Node, não é bug do
  jogo): rodei via um pseudo-terminal (`pty`) simulando alguém digitando
  as respostas, e o fluxo completo funcionou — criação de personagem,
  5 cenários de uma temporada (incluindo uma negociação de transferência
  real com 3 propostas recusadas em sequência), resumo de fim de
  temporada, e encerramento ao digitar "sair".

### 5.4. Treino com escolha de foco (implementado)

`docs/game-design.md` seção 5.2 previa "sessões de treino semanais com
escolha de foco (físico, técnico, tático, descanso)" — pilar que ficou
pendente até agora, porque a única fonte de crescimento de atributo era
passiva (XP de desempenho em partida). `progression/xp.ts` implementa
isso como uma **segunda fonte de XP**, independente da primeira:

- **`FocoDeTreino`**: `"fisico" | "tecnico" | "tatico" | "descanso"`.
  `ATRIBUTOS_POR_FOCO` categoriza os 24 atributos nos 3 focos que
  treinam algo (físico: velocidade/força/resistência/jogo
  aéreo/reflexos; técnico: finalização/drible/passe/marcação/etc;
  tático: visão de jogo/frieza/posicionamento/movimentação/liderança) —
  **diferente** de `progression/aging.ts` `CATEGORIA_POR_ATRIBUTO` (que
  só separa físico/mental/sem_declínio pra fins de curva de idade):
  aqui "técnico" e "tático" são a mesma categoria "mental" da aging.ts,
  separada em duas porque faz sentido escolher entre elas ao treinar.
- **`aplicarTreino(jogador, arquetipo, foco)`** — concentra
  `XP_POR_SESSAO_DE_TREINO` (250, estimativa de design, mesma ressalva
  de sempre) só nos atributos do foco escolhido que são relevantes pra
  posição do jogador, reaproveitando a mesma curva de retorno
  decrescente e multiplicador de arquétipo de `aplicarXpAtributo`/
  `aplicarXpPartidaAoJogador` — não é um sistema novo, é a mesma
  mecânica de XP com uma fonte diferente. `"descanso"` não treina nada;
  não tem atributo associado (a recuperação de `MORAL_RECUPERADA_NO_DESCANSO`
  é responsabilidade de quem chama, ver abaixo). Posição sem nenhum
  atributo no foco escolhido (ex: goleiro treinando "tático" — nenhum
  atributo de goleiro é tático) não quebra, só não tem efeito.
- **Ligado no game loop** (`career/career-loop.ts` `jogarTemporada`): a
  cada período, antes do cenário, chama `escolherFocoDeTreino(estado)`
  (padrão: sempre `"tecnico"`, mesmo espírito do padrão de
  `escolherOpcao`) e aplica o treino — `"descanso"` soma
  `MORAL_RECUPERADA_NO_DESCANSO` via `aplicarImpactoDeCenario` (reaproveita
  o clamp 0-100 já existente em vez de inventar um novo). Resultado
  registrado em `treinosResolvidos` (overall/moral antes e depois por
  período) e no hook `onTreinoResolvido`.
- **Interativo** (`npx tsx src/cli/index.ts jogar`): antes de cada
  cenário do período, você escolhe o foco de treino da sessão (1-4) e
  vê o overall (ou moral, se descanso) antes/depois imediatamente.
- **Validado com dado real**: rodando a carreira interativa escolhendo
  sempre foco técnico, o overall subiu de período em período dentro de
  uma mesma temporada (39 → 53 pelas partidas, depois 53 → 53 → 53 → 54
  → 54 pelas sessões de treino seguintes — incremento pequeno por sessão,
  como esperado de uma fonte de XP secundária).

### 5.5. Jogo a jogo com tabela ao vivo (implementado)

Antes desta peça, `resumoPartidas` (seção 5.3) só dava um resumo
agregado por competição — pedido explícito do usuário foi ver cada
partida do clube do jogador de verdade: preparação (classificação dos
dois times antes do jogo), o placar, e a tabela atualizada depois.
Implementado adicionando um hook opcional na camada de simulação em si
(`simulation/season.ts`/`simulation/knockout.ts`), não só na camada de
carreira — qualquer chamador (não só o game loop) pode se inscrever.

- **`simulation/season.ts`**: `simularTemporadaPontosCorridos`/
  `simularFaseUnicaDoFormato` ganham um parâmetro opcional
  `aoSimularConfronto?: (evento: EventoConfrontoPontosCorridos) => void`,
  chamado depois de cada confronto (na ordem real de rodada) com
  `tabelaAntes`/`tabelaDepois` — **cópias** (não a referência mutável
  interna), pra poder guardar/exibir sem se preocupar com mutação
  posterior. As cópias só são feitas quando o callback é passado (sem
  custo extra pra quem não usa).
- **`simulation/knockout.ts`**: `simularMataMataComEtapas`/
  `simularMataMataSimples`/`simularMataMataDoFormato` ganham
  `aoResolverConfronto?: (evento: EventoConfrontoMataMata) => void`,
  chamado por confronto resolvido (ida-e-volta conta como 1 evento
  agregado, não 1 por perna — simplificação documentada). Mata-mata não
  tem "tabela" (é chaveamento) — o evento só traz `etapa` + o confronto
  (placar agregado, se foi nos pênaltis, vencedor).
- **`simulation/engine.ts`**: `EventosSimulacaoTemporada` (dois campos,
  um por tipo de hook acima, cada um recebendo também o `campeonatoId` —
  `simularTemporada` roda várias competições ao mesmo tempo) — thread
  através de todas as receitas (`receitaPontosCorridos`/`receitaMataMata`/
  `receitaGruposEMataMata`/`receitaArgentina`). **Cobertura parcial**: a
  fase de grupos de `receitaGruposEMataMata` ainda não emite evento — só
  o mata-mata que segue emite (pendência; não afeta nada que já
  funciona hoje, já que nenhuma competição do calendário real usa essa
  receita com sucesso ainda, ver seção 5).
- **`career/career-loop.ts`**: `onPartidaPontosCorridos`/
  `onPartidaMataMata` em `OpcoesJogarTemporada` — `jogarTemporada` filtra
  os eventos brutos de `simularTemporada` (que incluem TODOS os
  confrontos da competição, de todos os times) pra só disparar quando o
  confronto envolve o clube atual do jogador. **Síncronos, não
  assíncronos** (diferente dos outros hooks do game loop): a temporada
  inteira é simulada de uma vez só (`simularTemporada` não é
  assíncrono), então não dá pra pausar/esperar entrada de usuário entre
  partidas sem reescrever todo o motor de simulação como assíncrono —
  os hooks servem pra **mostrar** o jogo a jogo conforme a temporada é
  processada (dezenas de partidas por temporada, pausar em cada uma
  seria tedioso de qualquer forma), não pra interagir partida a partida.
- **CLI**: `exibirPartidaPontosCorridos`/`exibirPartidaMataMata`
  (`src/cli/index.ts`) formatam cada evento — pontos corridos mostra
  "preparação" (posição/pontos dos 2 times antes, de `tabelaAntes`),
  placar, chances do jogador na partida (se teve) e a posição/pontos
  atualizados depois (`tabelaDepois`); mata-mata mostra etapa, placar
  agregado e classificado/eliminado. Ligado em `npx tsx src/cli/index.ts
  jogar` (sempre ativo) e em `carreira-loop` via a flag `--jogo-a-jogo`
  (opt-in, já que por padrão essa demo é o resumo compacto).
- **Validado com dado real**: `npx tsx src/cli/index.ts carreira-loop
  corinthians 1 --jogo-a-jogo` mostrou as 38 rodadas do Brasileirão
  (posição/pontos antes e depois de cada uma) e os 2 confrontos da Copa
  do Brasil (classificado na quinta fase, eliminado nas oitavas) — e o
  mesmo fluxo funcionou dentro da carreira interativa (`jogar`), jogo a
  jogo intercalado com as sessões de treino e os cenários da temporada.

### 5.6. Status no elenco + propostas iniciais (implementado)

Pedido explícito: (1) início de carreira com 3 propostas de clube em vez
de escolher o clube direto; (2) status do jogador no elenco
("promessa", "titular", etc) impactando desempenho/stats; (3) status
evoluindo/regredindo conforme o jogador melhora/piora, puxando junto o
prestígio das propostas de mercado — inclusive o caso concreto pedido:
"um jogador que é reserva no Flamengo pode ser importante numa Série B".

- **`career/status.ts`** (novo módulo) — `StatusNoClube`: `"promessa" |
  "reserva" | "titular" | "idolo"`, só sobe/desce 1 degrau por vez.
  - `minutosEsperadosPorStatus(status, random?)`: não é mais um valor
    fixo por status — cada status tem uma **faixa** (`promessa`: 5-30,
    `reserva`: 15-70, `titular`: 60-90, `idolo`: 70-90) e o minuto real é
    sorteado dentro dela, **partida a partida** (não uma vez por
    temporada) em `career/career-loop.ts` `jogarTemporada` — pedido
    explícito de mais variação (um "promessa" às vezes entra 5 min, às
    vezes 30; um "reserva" pode até superar o mínimo de um "titular" num
    jogo específico) em vez do jogador sempre jogar exatamente os mesmos
    minutos toda partida. Impacta diretamente o desempenho:
    `progression/xp.ts` já escala XP e nota por `minutosJogados/90`.
  - `statusMinimoPorIdade(idade)`: acima de 22 anos, o piso sobe de
    `"promessa"` pra `"reserva"` — pedido explícito ("um jogador
    promessa não pode ter mais de 22 anos, ele pode ser reserva").
    Aplicado via `aplicarPisoPorIdade` em **três** pontos, pra garantir
    que a regra vale onde quer que um status seja atribuído: dentro de
    `evoluirStatus` (evolução por desempenho), dentro de
    `statusOferecido` (proposta de mercado) e em `career/Player.ts`
    `criarEstadoInicial` (status inicial, pro caso de uma carreira
    customizada já começar com `idadeInicial` acima de 22).
  - `multiplicadorDeValorizacaoPorStatus`: 0.7/0.85/1/1.25 — aplicado
    em `market/valuation.ts` `PerfilDeMercado.multiplicadorStatus`
    (campo opcional, número puro — `valuation.ts` não depende do tipo
    `StatusNoClube`, só recebe o multiplicador já calculado, pra não
    criar uma dependência de `career/` desnecessária ali).
  - `evoluirStatus(statusAtual, notaMedia, idadeJogador)`: promove com
    nota média ≥7, rebaixa com nota <5, depois passa pelo piso por
    idade — chamado uma vez por temporada em `career/career-loop.ts`
    `jogarTemporada`, logo depois do resumo de partidas
    (`onStatusAtualizado`), só quando o jogador jogou alguma partida na
    temporada. **Ressalva de calibração importante**: a nota usada aqui
    é calculada com 90 minutos fixos (`MINUTOS_PADRAO_PARA_NOTA_DE_AVALIACAO`),
    não com os minutos "reais" sorteados pra aquela partida — senão um
    "promessa" (5-30 min) quase nunca cruzaria o limiar de promoção só
    porque a nota vem descontada pela escassez de minutos (a mesma
    variável que o status deveria destravar estaria travando a própria
    evolução dele). O que decide o status é a qualidade de quando jogou,
    não a oportunidade que já tinha — os minutos sorteados continuam
    sendo os usados pra aplicar XP normalmente, só a nota de avaliação
    de status usa a base fixa de 90.
  - `statusOferecido(statusAtual, fatores: FatoresDeOferta)`: agora é um
    **score contínuo** com 3 fatores em vez de só a diferença de rating —
    pedido explícito ("a oferta de status deve considerar concorrência e
    fase atual da equipe"):
    - `scoreRating`: diferença de rating entre clube ofertante e clube
      atual (mesmo efeito de antes: clube bem mais forte empurra pra
      baixo, bem mais fraco empurra pra cima — resolve o caso "reserva
      do Flamengo pode ser titular numa Série B" sem caminho especial).
    - `scoreConcorrencia`: proxy de concorrência interna via
      `Club.forca_financeira` do ofertante (`muito_alta`/`alta` = mais
      concorrência por posição, empurra a oferta pra baixo;
      `baixa`/`muito_baixa` empurra pra cima) — clube rico tende a ter
      elenco mais cheio na mesma posição.
      Cada fator sozinho consegue cruzar o limiar de troca de degrau
      (`LIMIAR_DE_DEGRAU = 1`); em combinação, podem se reforçar ou se
      cancelar (ver testes de "fatores se contrabalançam" em
      `tests/career/status.test.ts`).
    - `scoreFase`: fase atual do clube ofertante, de -1 (crise) a +1
      (auge) — **sorteada por quem chama** (`market/transfers.ts`
      `gerarProposta`, via `random() * 2 - 1`), não é uma simulação de
      forma de equipe de verdade. Não existe hoje nenhum tracking real
      de forma/resultado recente por clube ao longo de uma carreira —
      `simulation/rating.ts` `atualizarElo` está implementado mas nunca
      é chamado em lugar nenhum do motor. Ver pendência na seção 6.
    `ratingClubeAtual = 0` (início de carreira, sem clube ainda) sempre
    pesa como "clube bem mais forte" nesse cálculo, então cai
    naturalmente pro piso permitido pra idade sem precisar de um
    caminho especial pra isso.
- **`market/transfers.ts`**: `PropostaTransferencia` ganha
  `statusOferecido` (calculado dentro de `gerarProposta`, não é
  negociável — a negociação só mexe em salário/luvas/anos). Nova
  `gerarPropostasIniciais(clubes, perfil, quantidade=3, random?)` —
  reaproveita `selecionarClubesInteressados` com um `clubeAtualId`
  vazio (não bate com nenhum clube real, então nada é excluído nem
  usado como referência de upgrade) e `ratingClubeAtual: 0` em
  `gerarProposta` pra cada clube selecionado.
- **`career/Player.ts`**: `EstadoDeCarreira.statusNoClube` (`"promessa"`
  por padrão em `criarEstadoInicial`). `assinarContrato` agora recebe
  o status junto (contrato e papel no elenco mudam juntos numa
  transferência real); `mudarStatusNoClube` só pra revisão de status
  sem trocar de clube.
- **CLI interativa (`jogar`)**: depois de nome/posição/arquétipo, gera
  3 propostas iniciais (`gerarPropostasIniciais`) — mostra clube,
  status oferecido (sempre `"promessa"`, por construção) e termos; você
  escolhe uma, e ela vira o contrato/status inicial de verdade via
  `assinarContrato`. Sem proposta nenhuma (raro), cai de volta no fluxo
  antigo de digitar o id do clube manualmente. Status aparece no resumo
  de cada temporada e em cada negociação de transferência (`status
  oferecido: X`).
- **Validado com dado real**: rodando 8 temporadas seguidas com um
  atacante no Corinthians (`carreira-loop`), o jogador seguiu
  `"promessa"` até os 22 anos (permitido pelo piso) e, ao virar 23,
  a próxima avaliação de status já rebaixou o piso pra `"reserva"`
  mesmo sem uma queda de desempenho — exatamente a regra pedida. Uma
  transferência pro Argentinos Juniors nessa janela ofereceu
  `"reserva"` (não `"promessa"`, ainda que o rating do clube fosse
  parecido), e evoluções seguintes (`reserva` → `titular`) vieram por
  nota média alta em partidas normais. Numa negociação subsequente com
  Palmeiras/Flamengo/Boca Juniors no mesmo momento de carreira, os 3
  clubes concorrentes ofereceram status diferentes apesar de rating
  parecido entre eles — efeito da concorrência (`forca_financeira`) e
  da fase sorteada de cada um, confirmando que os 3 fatores realmente
  produzem ofertas distintas em vez de sempre convergirem pro mesmo
  resultado só pela diferença de rating.

### 5.7. Simulação de partida ao vivo + menu de modo (implementado)

Pedido explícito: "quero ver os jogos passarem" — um menu, antes de cada
partida do clube do jogador, com 3 opções: (1) simulação rápida, direto
pro resultado; (2) simular até a metade da temporada, sem perguntar de
novo; (3) simular o jogo ao vivo, com os 90 minutos passando de forma
corrida e pausando de verdade quando aparece um evento importante.

**Descoberta central**: antes disso, `simulation/season.ts`/`knockout.ts`/
`groups.ts`/`engine.ts` eram 100% síncronos — `simularTemporada` resolvia
a temporada inteira (todas as competições, todas as rodadas) numa rajada
só, e os hooks existentes (`aoSimularConfronto`/`aoResolverConfronto`) só
avisavam **depois** de cada confronto já resolvido — dava pra **mostrar**
jogo a jogo (`carreira-loop --jogo-a-jogo`), mas não pra **pausar** no meio
de uma partida específica esperando uma decisão real. O comentário antigo
em `career/career-loop.ts` (`onPartidaPontosCorridos`) já registrava essa
limitação como pendência conhecida — esta seção é ela sendo resolvida.

- **`simulation/match.ts`**: novo tipo `ResolverPartida` — o ponto de
  injeção que `season.ts`/`knockout.ts`/`groups.ts` agora chamam em vez de
  invocar `simularPartida` direto. Assinatura aceita `Promise` (por isso
  todo mundo na cadeia virou `async function`), mas o resolvedor padrão
  (`resolverPartidaPadrao`) só chama `simularPartida` normalmente — **nenhum
  comportamento muda pra quem não injeta nada**, só a assinatura ganha
  `await` a mais. `ContextoConfronto` (mandante/visitante) é passado junto,
  meramente informativo, pra quem for perguntar "contra quem é esse jogo"
  antes de decidir o modo. `CHANCES_BASE_POR_PARTIDA`/
  `VANTAGEM_MAXIMA_DE_MEIO`/`PESO_ENVOLVIMENTO_ATAQUE`/`forcaDoAtributo`/
  `resolverDuelo` viraram exports (eram privados) pra `live-match.ts`
  reaproveitar a mesma matemática sem duplicar.
- **`simulation/live-match.ts`** (novo módulo) — `jogarPartidaAoVivo`:
  reimplementa a mesma conta de `simularPartida` (chances totais/fatia
  casa-fora do duelo de meio), mas monta uma **linha do tempo ordenada por
  minuto** (cada chance sorteia seu próprio minuto 1-90) em vez de resolver
  tudo de uma vez. Três tipos de parada:
  - **Chance genérica** (não é do jogador): resolvida na hora, só narrada
    (`onEvento`), sem pausa.
  - **Chance do jogador**: pausa **numa fração** delas, não em todas
    — pedido explícito ("não quero que as interrupções e eventos ocorram
    na mesma frequência sempre, quero que seja randômico/provável, mas não
    fixo"). Cada chance sua sorteia se pausa
    (`PROBABILIDADE_DE_PAUSAR_CHANCE_DO_JOGADOR = 0.6`, configurável via
    `probabilidadeDePausarChance`); quando pausa, o `decidirChance`
    recebe o `ContextoDecisaoChance` (minuto/subtipo/atributo), e o
    `ResultadoDecisaoChance` (ajuste de força pro jogador e/ou pro
    adversário) volta e **entra direto no duelo antes dele ser resolvido**
    — a decisão muda a probabilidade de verdade, não é só narrativa (era a
    exigência explícita: "muda a probabilidade de verdade, depois retoma
    o jogo de onde parou"). Quando não pausa (incluindo sem `decidirChance`
    nenhum), resolve sem ajuste — mas continua narrada normalmente
    (`onEvento` "chance_jogador" dispara do mesmo jeito).
  - **Evento de contexto**: sorteado do novo catálogo
    `progression/match-events.ts` `EVENTOS_DE_PARTIDA` (cartão duvidoso,
    disputa dura de bola, provocação da torcida, cãibra no fim do jogo,
    cobrança de companheiro — 5 eventos, mesmo formato de
    `progression/scenarios.ts` `Cenario`/`Opcao`, só que **catálogo
    separado e sem `gatilho`**: o motor de partida não tem acesso a
    contexto de carreira, e a maior parte do catálogo principal é sobre
    decisões fora de campo, sem sentido como pausa em pleno jogo). A
    **quantidade por partida também varia**, não é um teto fixo sempre
    atingido: até `maxEventosDeContexto` candidatos são sorteados (padrão
    3), cada um só virando evento de verdade com
    `PROBABILIDADE_DE_EVENTO_DE_CONTEXTO = 0.25` — na prática a maioria
    das partidas tem 0-1 evento, raramente 2-3, nunca sempre o mesmo
    número. Pausa via `decidirEventoDeContexto`; o impacto
    (moral/relações internas — só isso, nunca atributo, porque o motor de
    partida não sabe a posição do jogador pra saber qual atributo seria
    seguro mexer) sai no retorno (`impactosDeContexto`) pra quem orquestra
    aplicar depois — `live-match.ts` não conhece `EstadoDeCarreira`
    (`simulation/*` não depende de `career/*`).
  - `msPorMinuto` (padrão ~220ms, ~90 min em ~20s), `maxEventosDeContexto`
    e `probabilidadeDePausarChance` são configuráveis — em teste, sempre
    0/desligado ou forçado pra 0/1, pra não esperar de verdade nem
    depender de sorte pra exercitar o caminho certo.
- **`career/career-loop.ts`**: `OpcoesJogarTemporada` ganha
  `escolherModoDePartida` (`ContextoPartidaDoJogador`: número sequencial
  da partida do jogador na temporada, lado, mandante/visitante ->
  `ModoDePartida`: `"rapida"` ou `"ao_vivo"`), `decidirChanceAoVivo`,
  `decidirEventoDePartida`, `onEventoAoVivo`. `jogarTemporada` monta seu
  próprio `ResolverPartida` internamente: sem `participacaoJogador` (não é
  o clube do jogador) ou sem `escolherModoDePartida` injetado, cai direto
  no `resolverPartidaPadrao`; senão, pergunta o modo, e se for `"ao_vivo"`
  chama `jogarPartidaAoVivo`, acumulando os `impactosDeContexto` numa lista
  (`impactosDePartidaAoVivo`) aplicada ao `estadoAtual` (via
  `aplicarImpactoDeCenario`) logo depois que `simularTemporada` termina —
  **não existe um 3º modo "simular até a metade" no motor**: essa lógica
  ("parar de perguntar por um tempo") é inteiramente de quem implementa
  `escolherModoDePartida` (ver CLI abaixo); `jogarTemporada` só chama de
  novo a cada partida e usa o que vier.
- **CLI interativa (`jogar`)**: `escolherModoDePartidaInterativo` mostra o
  menu de 3 opções antes de cada partida do clube do jogador — a opção 2
  guarda `numeroDaPartida + PARTIDAS_ATE_METADE_DA_TEMPORADA_HEURISTICA`
  (constante fixa, hoje 25) e para de perguntar até passar desse número,
  **estimativa de design**: não dá pra saber de antemão quantas partidas o
  clube do jogador vai ter na temporada inteira nesse ponto do motor (cada
  competição só conhece o próprio calendário, ver `simulation/engine.ts`),
  então "metade da temporada" não é uma conta exata. `decidirChanceAoVivoInterativo`
  oferece 2 opções (arriscar vs. ajeitar com mais categoria, ajustes de
  força diferentes); `decidirEventoDePartida` reaproveita
  `escolherOpcaoInterativa` (mesmo formato de `Cenario`/`Opcao` dos
  cenários de carreira, então o mesmo renderizador serve pros dois sem
  duplicar); `onEventoAoVivoInterativo` narra cada evento em tempo real.
- **Validado**: suíte de testes (`tests/simulation/live-match.test.ts`,
  `tests/progression/match-events.test.ts`, describe
  `"modo de partida ao vivo"` em `tests/career/career-loop.test.ts`) cobre
  o mecanismo isoladamente (decisão muda o resultado do duelo de verdade,
  contexto recebido bate com a chance resolvida, eventos saem em ordem
  crescente de minuto terminando em apito final) e integrado
  (`escolherModoDePartida` chamado uma vez por partida do jogador com o
  contexto certo, impacto de evento de contexto realmente aplicado ao
  estado). Rodado também via script avulso chamando `jogarTemporada`
  direto (fora da suíte de testes, só pra inspeção visual da narração) —
  confirma minutos crescentes, decisão "arriscar" variando entre gol/sem
  gol (não é sempre um ou sempre outro) e partidas seguintes (modo
  `"rapida"`) sem narração nenhuma, como esperado.

### 5.8. Receitas de simulação pra mais formatos de competição (implementado)

Pedido explícito: "implemente a receita pra todos os campeonatos
registrados" — motivado por uma carreira nova ter caído num clube cuja
única competição (estadual) não tinha receita de simulação, resultando
numa temporada inteira sem nenhuma partida real. Levantamento (62
campeonatos registrados, 11 ativos no calendário padrão — Brasil +
continentais) mostrou que só 4 tinham receita: `pontos_corridos`/
`mata_mata` isolados e `fase_grupos`+`mata_mata` simples (genéricas) +
Argentina por id. Implementadas 8 receitas novas em
`simulation/engine.ts`, todas exportadas e testadas diretamente (mesmo
padrão de `receitaArgentina`):

- `receitaFaseSuicaEMataMata` (`fase_suica`+`mata_mata`) — Paulistão A1,
  Gauchão, Catarinense, Goiano, Paraense, Paranaense, Copa Sul-Sudeste.
- `receitaFaseSuicaMataMataEFinal` (`fase_suica`+`mata_mata`+`final_estadual`)
  — Mineiro Módulo I: o `mata_mata` aqui é só a semifinal (1 etapa,
  termina com 2 sobreviventes, não 1 campeão) — precisou de
  `simulation/knockout.ts` `simularEtapasMataMataParcial`, variante nova
  de `simularMataMataComEtapas` que **não exige terminar com 1 campeão
  só** (extraído o loop comum pra `resolverEtapasMataMata`, reaproveitado
  pelas duas). Os 2 semifinalistas vão pro `final_estadual` de verdade.
- `receitaFaseGruposFaseQuadrangularEFinal` (`fase_grupos`+`fase_quadrangular`+
  `final_estadual`) — Série C, Paulistão A2: só o **líder** (1º colocado)
  de cada quadrangular disputa a final, não todo `classificam_por_grupo`
  (o `criterio` diz "líderes... disputam o título", singular por grupo).
- `receitaTurnoEMataMata` (`mata_mata`+`turno`) — Carioca A2.
- `receitaTurnoRetornoSomado` (`returno`+`turno`, sem `final_estadual`) —
  Paraguai 1ª divisão: mesma soma de tabelas de `receitaArgentina` (agora
  extraída num helper comum, `simularTurnoRetorno`), mas sem reconciliação
  nenhuma depois — campeão é direto o topo da tabela somada.
- `receitaPontosCorridosComLiguilla` (`mata_mata`+`pontos_corridos`) —
  Chile 2ª divisão: temporada inteira decide a tabela, os
  `2^(nº de fases do mata_mata)` melhores colocados disputam a liguilla
  de acesso. **Aproximação documentada** (já existia em
  `docs/dados-a-verificar.md`): a liguilla real dá bye pro 2º colocado
  (só 3º-8º jogam quartas), não representável com o bloco `MataMata`
  atual — aqui todos os classificados entram direto, sem bye.
- `receitaCarioca` (por id, mesma combinação `final_estadual`+`returno`+
  `turno` de `receitaArgentina` com significado diferente): Taça
  Guanabara/Taça Rio decididas pelo topo da própria tabela (não usa
  `classificam_proxima_fase` — não há mais nenhuma fase entre elas e a
  final), `final_estadual` é uma final de verdade entre os 2 — mesmo
  clube campeão dos dois vira campeão automático, sem final
  (`simularFinalEstadualDoFormato` já cobre 1 participante só).
- `receitaFaseGruposComPreClassificatorioEMataMata` (`fase_grupos`+
  `mata_mata` com `mata_mata.etapas` detalhado) — Libertadores/
  Sul-Americana: ao contrário do caso simples (classificados do grupo
  alimentam o mata-mata direto), aqui uma PARTE das etapas do mata-mata
  acontece **antes** da fase de grupos (pré-classificatório — só alguns
  times entram direto, o resto disputa vaga) e o resto **depois** (mata-
  mata final entre os classificados da fase de grupos). O corte entre
  "antes" e "depois" é **derivado da contagem de times, não hardcoded**:
  times que nunca aparecem em nenhum `entrantes` são "diretos"; percorre
  as etapas resolvendo o pré-classificatório até sobreviventes+diretos
  bater exatamente com o tamanho esperado da fase de grupos
  (`num_grupos × times_por_grupo`). Pra Libertadores fecha exatamente (28
  diretos + 4 sobreviventes = 32) — pra Sul-Americana **não fecha em
  nenhum ponto** (achado documentado em `docs/dados-a-verificar.md`,
  possível mecanismo cross-competição com a fase preliminar da
  Libertadores, não modelável só com o `times[]` de uma competição), erro
  claro em vez de simulação errada.
- `despacharReceitaGenerica` passou a **ignorar `tabela_acumulada`** na
  chave de despacho (o bloco só tem `{criterio: string}`, nenhum dado
  próprio — é uma anotação de "some as tabelas dos outros blocos", não um
  mecanismo independente). Resolveu de graça o Paraguai 2ª divisão
  (`pontos_corridos`+`tabela_acumulada` → cai no `receitaPontosCorridos`
  já existente, já que o `tabela_acumulada` ali é só sobre rebaixamento
  por média de temporadas, sem efeito nesta temporada).
- `simulation/swiss.ts` (`simularFaseSuica`) convertido pra `async` +
  `ResolverPartida`, mesmo padrão de `season.ts`/`knockout.ts`/`groups.ts`
  — necessário porque a fase suíça agora está em competições ativas de
  verdade (antes só era exercitada em teste).
- **Deferido nesta rodada, documentado como pendência**
  (`docs/dados-a-verificar.md`): Peru, Colômbia, Argentina 2ª divisão,
  Copa Verde (`dupla_chave_regional`), Copa do Nordeste — mecanismo real
  ainda não totalmente confirmado por fonte (ou, no caso da Argentina 2ª,
  o próprio torneio real ainda em andamento sem chaveamento fechado).
  Uruguai/Venezuela/Equador, inicialmente também deferidos aqui, foram
  pesquisados e implementados na seção 5.9 logo abaixo.
- **Validado com dado real**: rodando `simularTemporada` com o calendário
  padrão de 2027 e todos os clubes reais carregados, 10 das 11
  competições ativas simulam com sucesso (campeões plausíveis: Flamengo/
  Palmeiras no Brasileirão, Cruzeiro/Atlético-MG no Mineiro, Grêmio/
  Internacional no Gauchão, clubes CONMEBOL reais na Libertadores) — só a
  Sul-Americana continua com erro nesta seção (resolvido na seção 5.10
  logo abaixo). Antes desta seção, só 4 das 11 simulavam.

### 5.9. Receitas pra Uruguai, Venezuela e Equador, com pesquisa de regulamento real (implementado)

Continuação da seção 5.8 — pedido explícito de confirmar regulamento nos
sites oficiais (CONMEBOL/federações) antes de implementar as receitas
deferidas. Uruguai, Venezuela e Equador foram pesquisados e implementados
nesta rodada (fontes citadas em `docs/dados-a-verificar.md`); Colômbia,
Peru, Argentina 2ª divisão e as copas regionais brasileiras continuam
pendentes (uma pesquisa em lote travou num limite de sessão da API antes
de completar essas 3 — refazer em sequência, não em paralelo).

- **`schemas/championship.ts`**: novo bloco `FaseFinalPorClassificacao` —
  depois de uma fase anterior (normalmente `pontos_corridos`), os times
  são divididos em grupos de **tamanhos e propósitos diferentes**, na
  ordem da tabela final dessa fase (não por sorteio nem grupos fixos,
  diferente de `FaseGrupos`/`FaseQuadrangular`). `pontos_carregados`
  opcional soma os pontos já conquistados em vez de zerar a tabela do
  grupo. Cobre o Equador (única pendência de arquitetura de schema
  identificada até agora, ver seção 6 antiga).
- **`receitaPontosCorridosComFaseFinalPorClassificacao`** (genérica,
  combo `fase_final_por_classificacao,pontos_corridos`) — Equador 1ª e 2ª
  divisão: campeão é o líder do PRIMEIRO grupo (o que reúne os melhores
  colocados). **Achado ao pesquisar**: o dado antigo de
  `equador_segunda.json` (2 grupos de 6 desde o início) não batia com o
  formato real 2025 — corrigido pra `pontos_corridos` único de 12 times
  seguido de 2 hexagonais por classificação.
- **`receitaTurnoRetornoComGrupoEMataMataEFinal`** (genérica, combo
  `fase_grupos,final_estadual,mata_mata,returno,turno`) — Venezuela 1ª
  divisão: cada torneio (Apertura/Clausura) tem sua própria mini-
  competição interna (classificados do turno/returno → `fase_grupos`
  própria → `mata_mata` próprio → "campeão do torneio"), só depois os 2
  campeões de torneio se enfrentam no `final_estadual` da temporada
  (mesmo clube campeão dos dois = campeão automático). **Bug de dado
  corrigido**: `venezuela_primera.json` tinha `final_estadual.ida_e_volta:
  false`, deveria ser `true` (confirmado por fonte). Venezuela 2ª divisão
  usa a MESMA combinação de blocos (então cai na mesma receita
  genérica), mas os números não reconciliam (`turno` classifica só 4,
  `fase_grupos` pede 16) — erro claro ao rodar, documentado como
  pendência em vez de forçar algo errado.
- **`receitaUruguaiPrimeira`** (por id — mecanismo específico demais pra
  generalizar): Apertura/Clausura decididos pelo topo da própria tabela;
  mesmo clube campeão dos dois = campeão automático; senão, semifinal
  entre os 2 campeões de torneio, e só precisa de uma final adicional
  contra o líder da Tabela Anual se esse líder **não** for um dos 2
  semifinalistas. **Achado ao pesquisar**: o dado tinha um `fase_grupos`
  representando o "Torneo Intermedio" misturado com o mata-mata do
  título (`mata_mata.fases` incluía `"final_torneo_intermedio"` junto de
  `"semifinal_campeonato"/"final_campeonato"`) — confirmado que o Torneo
  Intermedio é uma competição À PARTE (só vaga internacional, sem relação
  com o título) — removido do dado (não modelado) em vez de simulado
  errado.
- **`receitaUruguaiSegunda`** (por id): Torneo Competencia (2 séries +
  final, rodado à parte) não decide o campeão — confirmado que o campeão
  da divisão é sempre o líder da fase regular (`pontos_corridos`).
  **Aproximação documentada**: o playoff pelo 3º acesso na vida real
  inclui condicionalmente o campeão do Torneo Competencia (só se ele não
  estiver em zona de acesso direto nem de descenso) — aqui sempre usa as
  posições 3ª-6ª da tabela regular, sem essa condicional (não afeta quem
  é campeão, só o detalhe de quem disputa a vaga extra).
- **Validado com dado real**: rodando as 5 receitas novas direto com os
  campeonatos/clubes reais carregados (nenhuma delas está no calendário
  padrão hoje — calendário só cobre Brasil + continentais), todas
  produzem campeões plausíveis (Deportivo Táchira na Venezuela, Peñarol
  no Uruguai, Independiente del Valle no Equador) sem erro, em várias
  rodadas com RNG real (`Math.random()`).

### 5.10. Sul-Americana + Libertadores resolvidas juntas (implementado)

Pedido explícito: confirmar no site da CONMEBOL o mecanismo de que "os
3º colocados de cada grupo da Libertadores entram no primeiro mata-mata
depois da fase de grupos, na repescagem, contra os 2º colocados dos
grupos da Sul-Americana" — **confirmado** (LA NACION, Infobae, Wikipedia,
ver `docs/dados-a-verificar.md`): 1º/2º de cada grupo da Libertadores
avançam direto às oitavas da própria Libertadores; 3º cai pra Sul-
Americana; na Sul-Americana, 1º de cada grupo avança direto às oitavas
dela, 2º disputa o repechaje (ida e volta) contra os 3º da Libertadores.

Isso é exatamente a limitação arquitetural que a seção 5.8 já suspeitava
ao investigar por que a matemática das etapas da Sul-Americana nunca
fechava sozinha: **a Sul-Americana depende de dados da Libertadores**, e
uma `Receita` isolada só enxerga o `times[]`/`formato` da própria
competição.

- **`receitaLibertadoresESulAmericanaConjunta`** (não é uma `Receita`
  comum — não entra em `RECEITAS_POR_ID`/`despacharReceitaGenerica`):
  recebe as DUAS competições e os DOIS mapas de rating de uma vez.
  Resolve o pré-classificatório e a fase de grupos de cada uma
  separadamente (reaproveitando `resolverPreClassificatorioDeFaseDeGrupos`,
  extraído de `receitaFaseGruposComPreClassificatorioEMataMata` pra esse
  fim) — a fase de grupos da Libertadores roda com `classificam_por_grupo`
  temporariamente sobrescrito pra 3 (precisamos saber quem é o 3º
  colocado, não só quem avança). Monta o repechaje manualmente (não via
  `EtapaMataMata` — o emparelhamento automático por força não respeitaria
  o lado de origem de cada time): ordena os 2º da Sul-Americana e os 3º
  da Libertadores por rating e casa por índice (mais forte contra mais
  forte de cada lado), resolvendo cada confronto com `resolverConfronto`
  diretamente. Os classificados do repechaje entram na 1ª etapa **depois**
  de "repescagem" no `mata_mata.etapas` da Sul-Americana (que é ignorada
  na hora de montar as etapas finais — já foi resolvida manualmente,
  entrar de novo dobraria a resolução).
- **Bug pego em teste, não só no dado**: um time que vem da Libertadores
  pro repechaje da Sul-Americana pode seguir vencendo e **virar campeão da
  Sul-Americana de verdade** (aconteceu num teste com dado real:
  Atlético-MG, times que caem da Libertadores realmente disputam e às
  vezes vencem a Sul-Americana) — só que os ratings desse time só estavam
  cadastrados no mapa da Libertadores, não no da Sul-Americana, e usar o
  mapa errado depois do repechaje geraria `NaN` na força do time.
  Corrigido combinando os dois mapas de rating (`{...ratingsSulAmericana,
  ...ratingsLibertadores}`) pra qualquer confronto a partir do repechaje.
- **Wire-up em `simularTemporada`**: antes do loop normal por competição,
  um caso especial verifica se `"libertadores"` e `"sulamericana"` estão
  ativas E carregadas — se sim, resolve as duas juntas e marca os 2 ids
  como já resolvidos (pulados no loop genérico). Se só uma das duas
  estiver presente, cai no despacho normal por competição (mesmo
  comportamento de antes — Sul-Americana sozinha continua com erro claro,
  não inventa um repechaje sem o dado real da Libertadores).
- **Limitação aceita, documentada**: não modela o clube do jogador
  "migrando" de competição — se o clube dele terminasse 3º de grupo na
  Libertadores, na vida real ele seguiria jogando (agora pela Sul-
  Americana); aqui ele é eliminado da Libertadores normalmente, como o
  motor já fazia antes desta função existir. Só a correção estrutural do
  campeão de cada competição (e das partidas de quem já tiver o clube do
  jogador na própria lista de times daquela competição) foi resolvida —
  participação dinâmica entre competições ficaria pra uma mudança maior
  de arquitetura.
- **Validado com dado real**: rodando `simularTemporada` com o calendário
  padrão de 2027 e todos os clubes reais carregados, repetidas vezes,
  Libertadores e Sul-Americana simulam com sucesso junto com as outras 9
  — **11 das 11 competições ativas agora simulam**, contra 4 no início
  desta série de mudanças (seção 5.8).

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
- ~~Cenários — condições de gatilho não definidas~~ **resolvida**:
  mecanismo implementado e catálogo reclassificado (`Gatilho`/
  `ContextoSorteio`/`cenarioElegivel`/`filtrarCenariosElegiveis`, ver seção
  4) — 146/200 cenários têm `gatilho`, os outros 54 ficam elegíveis sempre
  por decisão deliberada (são atemporais). `ContextoSorteio.momento` já
  vem do calendário real via `momentoDoPeriodo`/`momentoPorProgresso`
  (`src/cli/index.ts` `carreira` percorre os períodos de
  `construirCalendarioPadrao` de verdade, não é mais um valor fixo).
  **Ainda falta**: isso só está ligado na demo da CLI — não existe ainda
  um "game loop" de carreira de verdade que persista `EstadoDeCarreira`
  automaticamente através de uma temporada inteira (ver pendência
  separada abaixo, "Estado de carreira não persiste entre temporadas via
  `engine.ts`") nem que distinga `reta_final` de fato dentro do período
  `"mai-nov"` (a granularidade do calendário padrão não permite isso hoje
  — ver seção 4).
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
- ~~Estado de carreira não persiste entre temporadas via `engine.ts`~~
  **resolvida**: `career/career-loop.ts` `jogarTemporada`/`jogarCarreira`
  (ver seção 5.1) fazem exatamente esse laço — aplicam `partidasDoJogador`
  de toda competição da temporada ao `EstadoDeCarreira` automaticamente,
  encadeando quantas temporadas quiser.
- ~~Transferência de clube não acontece automaticamente no loop~~
  **resolvida**: mercado adiantado da Fase 4 (`src/market/*.ts`, ver seção
  5.2) — negociação de verdade (proposta, contraproposta, confiança,
  contrato) ligada em `jogarTemporada`, disparando durante o período
  mapeado pra `pre_temporada`.
- ~~Cenários narrativos de transferência não ligados à negociação
  real~~ **resolvida**: `Opcao.disparaNegociacaoReal` (ver seção 5.2) —
  escolher a opção de buscar saída num cenário de transferência dispara a
  negociação de verdade, e o sorteio de cenário só oferece um cenário de
  transferência quando existe interesse real de mercado nesse período.
- ~~Interesse de clube maior não era factível com o desempenho do
  jogador~~ **resolvida**: `calcularRatingDeInteresse` (ver seção 5.2)
  passou a limitar `selecionarClubesInteressados` pelo overall/reputação
  reais do jogador, não só pelo rating do clube atual dele.
- ~~Sem cenário de venda forçada por necessidade financeira do clube~~
  **resolvida**: `career/club-finances.ts` `precisaVender` +
  `venda_forcada_por_necessidade_financeira` (ver seção 5.2).
- **Mercado — limitações reais desta versão** (não são bugs escondidos):
  só uma negociação aceita por temporada (para no primeiro clube que
  aceitar, não acumula múltiplas ofertas simultâneas de verdade disputando
  entre si além do fator "concorrentes" agregado); venda forçada e
  interesse de compra nunca acontecem no mesmo período (prioridade fixa
  pra venda forçada, não uma disputa entre os dois); só 4 cenários do
  catálogo de 201 têm `disparaNegociacaoReal`/`disparaVendaForcada` (os
  outros ~197, incluindo os ~145 com outros tipos de `gatilho`, não têm
  nenhuma ligação com mercado — não faria sentido pra maioria, mas nada
  impede de marcar mais opções de "buscar saída"/"aceitar venda" em
  cenários futuros); `precisaVender` é probabilidade pura, não uma
  simulação de fluxo de caixa (clube não fica "mais endividado" com o
  tempo, a chance por temporada é sempre a mesma); não existe renovação
  de contrato (jogador pode ficar anos além de `temporadaDeVencimento`
  sem nada acontecer); ~~não existe sistema de minutagem que reduza o
  interesse de mercado de um jogador que não joga~~ **resolvida**: status
  no elenco (seção 5.6) cumpre esse papel — `multiplicadorDeValorizacaoPorStatus`
  reduz valor de mercado/teto de rating alcançável pra quem não é
  titular. ~~`clubeAtualId` inicial continua vindo de quem chama, sem
  lista curada~~ **resolvida na CLI interativa** (`jogar` gera 3
  propostas iniciais em vez de pedir o id direto, seção 5.6) — a API
  (`criarEstadoInicial`) continua exigindo `clubeInicialId` explícito
  pra quem chama programaticamente (`npx tsx src/cli/index.ts clubes
  [pais]` ainda lista tudo sem filtrar por tamanho/divisão, útil pro
  fallback manual da CLI quando nenhuma proposta chega).
- **Carreira interativa — limitações desta primeira versão** (ver seção
  5.3): contraproposta de negociação continua automática
  (`contrapropostaPadrao`), o jogador não escolhe os termos; não há
  como ver o placar/eventos de uma partida específica durante o loop
  (só o resumo agregado por competição, igual `carreira-loop`); não há
  "salvar e continuar depois" — a carreira só existe enquanto o
  processo do terminal está rodando.
- **Treino — limitações desta versão** (ver seção 5.4): uma sessão por
  período (5 por temporada), sem noção de carga de treino/fadiga real;
  o XP de treino é uma constante fixa (`XP_POR_SESSAO_DE_TREINO`), não
  varia por qualidade do CT do clube, comissão técnica, ou nada
  parecido; `escolherFocoDeTreino` não tem acesso a nenhuma informação
  sobre qual atributo está mais "atrasado" pra sugerir foco — quem
  escolhe (humano ou automação) decide sem esse apoio.
- **Jogo a jogo — limitações desta versão** (ver seção 5.5): fase de
  grupos (`groups.ts`) ainda não emite evento de confronto (só o
  mata-mata que segue, dentro de `receitaGruposEMataMata`) — não afeta
  nada que já funciona hoje, já que nenhuma competição do calendário
  real usa essa receita com sucesso ainda; fase suíça
  (`swiss.ts`, usada por Paulistão/Carioca/Mineiro/Gauchão, que também
  não têm receita funcionando ainda) também não tem hook; mata-mata
  ida-e-volta emite 1 evento agregado por confronto, não 1 por perna —
  quem quiser o placar perna a perna precisa olhar
  `resultado.partidasDoJogador` (quando o clube do jogador estava
  envolvido) em vez do evento.
- **Status no elenco — limitações desta versão** (ver seção 5.6): só
  sobe/desce 1 degrau por temporada, sem meio-termo (ex: "quase
  titular"); o limiar de promoção/rebaixamento (nota 7/5) é constante
  fixa, igual pra qualquer posição/arquétipo/competição — na prática,
  atacante contra defesas fortes de Série A demora mais pra cruzar o
  limiar que outras combinações, o que não foi calibrado
  deliberadamente por posição, só é uma consequência do jeito que a
  nota é calculada (`progression/xp.ts` `calcularNotaPartida`); um
  clube só pode oferecer um dos 4 status fixos, não intermediários.
  ~~`statusOferecido` não leva em conta nada além da diferença de
  rating~~ **parcialmente resolvida**: agora também considera
  concorrência interna (proxy `Club.forca_financeira`, não o elenco
  real do clube — não existe hoje um modelo de "outro jogador forte na
  mesma posição") e fase da equipe — mas essa fase é **sorteada**, não
  simulada de verdade: não existe tracking real de forma/resultado
  recente por clube ao longo de uma carreira (`simulation/rating.ts`
  `atualizarElo` está implementado mas nunca é chamado em lugar nenhum
  do motor — se/quando isso for ligado, `scoreFase` em
  `career/status.ts` `statusOferecido` deveria passar a vir de um
  histórico real de Elo recente do clube em vez do sorteio atual em
  `market/transfers.ts` `gerarProposta`).
- **Simulação ao vivo — limitações desta versão** (ver seção 5.7): o
  menu de modo (rápida/até metade da temporada/ao vivo) só está ligado
  na CLI interativa (`jogar`) — `carreira-loop`/`temporada`/`carreira`
  continuam 100% instantâneas, sem o menu; "simular até a metade da
  temporada" é uma janela de partidas de tamanho fixo
  (`PARTIDAS_ATE_METADE_DA_TEMPORADA_HEURISTICA = 25`), não uma conta
  real de "metade" (o motor não sabe de antemão quantas partidas o
  clube do jogador vai ter na temporada, cada competição só conhece o
  próprio calendário); eventos de contexto ao vivo
  (`progression/match-events.ts`) só afetam moral/relações internas,
  nunca atributo (o motor de partida não tem a posição do jogador
  disponível ali pra saber qual atributo seria seguro mexer sem criar
  um campo "órfão" fora da lista de atributos da posição); e o próprio
  jogo ao vivo não tem "escalação"/lesão real durante a partida — só a
  chance do jogador e eventos de contexto pausam, o resto do time
  segue sendo Camada 1 (duelo agregado), igual antes.
- **Receitas de simulação ainda faltando** (ver seções 5.8/5.9): Peru,
  Colômbia (1ª e 2ª divisão), Argentina 2ª divisão, Copa Verde
  (`dupla_chave_regional`), Copa do Nordeste — só entram no calendário de
  uma carreira brasileira se algum dia `data/loaders/calendario.ts`
  passar a incluir competições internacionais além das continentais
  atuais. Venezuela 2ª divisão tem receita (mesma função da 1ª) mas erra
  sempre — os números não reconciliam (`turno` classifica só 4,
  `fase_grupos` pede 16), ver `docs/dados-a-verificar.md`. Libertadores e
  Sul-Americana (que dependiam uma da outra pro repechaje) foram
  resolvidas juntas na seção 5.10 — as 11 competições ativas do calendário
  padrão simulam com sucesso hoje.
