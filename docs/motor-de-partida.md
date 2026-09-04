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
