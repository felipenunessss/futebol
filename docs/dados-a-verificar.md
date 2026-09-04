# Dados a verificar

Rastreamento das pendências de qualidade de dados abertas durante o povoamento dos
clubes e estaduais. Critério aplicado: só entra na base um clube/fato confirmado por
pelo menos uma fonte razoável; qualquer coisa duvidosa fica de fora dos arquivos de
dados e listada aqui.

Nota: o campo `fundacao` foi removido do schema de `Club` — não rastreamos mais ano
de fundação dos clubes, então itens que só existiam por causa de ambiguidade nesse
campo foram removidos deste documento.

## Resolvidos

- **"EC São Bernardo"** vs **"São Bernardo FC"**: confirmados como dois clubes
  distintos e reais, ambos de São Bernardo do Campo — Wikipédia inglesa tem
  páginas separadas e a página do São Bernardo FC diz explicitamente "Not to
  be confused with Esporte Clube São Bernardo". EC São Bernardo (estádio 1º
  de Maio) disputa a A3; São Bernardo FC (também joga a Série B nacional)
  disputa a A1. Ambos adicionados à base.
- **União Suzano** (estádio Francisco Marques Figueira) e **XV de Jaú**
  (estádio Zezinho Magalhães) — confirmados por múltiplas fontes (Wikipédia,
  Futebol Interior) disputando a A3 2026. Adicionados; a A3 agora tem os 16
  times reais da divisão.

## Divisões ainda não modeladas (lista de clubes não encontrada com confiança)

- **Campeonato Carioca — Série B1** (3ª divisão do RJ): existência e formato
  confirmados, mas não achei lista oficial completa da edição 2025 dentro do
  tempo de pesquisa.
- **Campeonato Carioca — Série B2** (4ª divisão): a lista de 12 clubes encontrada
  é da edição **2026**, não 2025 — não deve ser usada como se fosse do ano
  correto. Também não está confirmado quais 9 dos 12 clubes originais
  permaneceram na disputa (3 desistiram).
- **Campeonato Carioca — Série C** (5ª divisão): existência e formato
  confirmados (Taça Waldir Amaral, 13 clubes), lista de clubes não encontrada.
- Não há evidência de uma "Série D" carioca ativa hoje — a hierarquia atual
  parece ir só até a Série C.

## Detalhes pendentes em clubes já incluídos

A maioria dos clubes novos em `src/data/clubes/sp_estadual.json` e
`rj_estadual.json` tem `estadio` ausente — não foi verificado individualmente
nesta rodada (confirmei só nome/cidade).

## Minas Gerais — detalhes pendentes

- **Itabirito Futebol Clube** e **Sport Club Aymorés**: nome do estádio atual
  incerto (fontes citam nomes diferentes, possivelmente por reforma/mudança
  recente) — campo `estadio` deixado de fora.
- **Coimbra Esporte Clube**: manda jogos ora no Independência (Belo
  Horizonte), ora no estádio de Contagem — `cidade` ficou como Contagem
  (sede do clube) mas `estadio` foi deixado de fora pela ambiguidade.
- **Mineiro Módulo I**: vagas de Copa do Brasil/Libertadores não pesquisadas
  — `premiacao` só tem o rebaixamento confirmado (2 times).
- **Mineiro Módulo II**: a regra real de classificação é "melhores 8 no geral
  entre os 2 grupos de 6", não necessariamente 4 de cada grupo — modelei como
  `classificam_por_grupo: 4` por aproximação, já que o schema não representa
  classificação cruzada entre grupos. Pode não bater exatamente com o
  regulamento em anos de desempenho desbalanceado entre os grupos.

## Rio Grande do Sul — detalhes pendentes

- **Monsoon Futebol Clube** (1ª divisão): clube real, mas mudou a sede de
  Porto Alegre para Capão da Canoa em 2026 — o estádio atual não foi
  confirmado, campo `estadio` deixado de fora.
- **8 clubes da Série A2** (Apafut, Brasil-Farroupilha, Esportivo Bento
  Gonçalves, Sport Clube Gaúcho, Glória, Gramadense, Guarani-VA, União
  Frederiquense): existência e participação na temporada 2026 confirmadas
  pela Wikipédia oficial da competição, mas `estadio` não foi pesquisado
  individualmente ainda.
- **Gauchão (1ª divisão)**: vagas de Copa do Brasil/Libertadores não
  pesquisadas — `premiacao` só tem o rebaixamento confirmado (2 times).
- Nenhum clube com risco real de duplicata/identidade ambígua foi encontrado
  nesta rodada (diferente dos casos São Bernardo/Patrocinense).

## Bahia — detalhes pendentes

- **ECPP (Vitória da Conquista), Fluminense de Feira, Redenção, SSA FC**
  (Série B): estádio não confirmado — campo `estadio` deixado de fora.
- **Feira de Santana tem 3 clubes reais e distintos** no Baianão: Bahia de
  Feira (A1), Fluminense de Feira e Feira FC (ambos Série B) — confirmado que
  não são o mesmo clube, apesar do nome de cidade em comum.
- **Baianão A1**: formato de mata-mata confirmado como "jogo único" só para a
  semifinal na fonte consultada; assumi jogo único também na final por
  ausência de indicação em contrário — vale confirmar contra o regulamento
  oficial da FBF.
- Vagas de Copa do Brasil/Libertadores da Série A1 não pesquisadas —
  `premiacao` só tem o rebaixamento confirmado (2 times).

## Pernambuco — detalhes pendentes

- **Reforma 2026/27**: a FPF vai fundir Série A1 e A2 num campeonato único
  de 31 clubes a partir de outubro de 2026. Por isso `pernambucano_1.json`
  usa a temporada 2026 (último ano no formato separado da A1) e
  `pernambucano_2.json` usa 2025 (última edição completa da A2 antes da
  fusão) — os dois arquivos têm `ano_referencia` diferentes de propósito.
  O formato novo (31 clubes) não foi modelado ainda.
- **6 clubes da Série A2** (Águia de Cumaru, América-PE, Caruaru City,
  Ipojuca, Porto, Ypiranga-PE): estádio não pesquisado ainda.
- **Pernambucano A1**: o formato real tem uma assimetria que o schema atual
  não representa bem — 1º e 2º colocados do turno único avançam direto à
  semifinal, enquanto só 3º-6º disputam quartas de final. Modelei como
  `classificam_por_grupo: 6` seguido de quartas+semifinal+final genéricas,
  o que perde a informação de quem tem passagem direta — a simulação
  (Fase 2) vai precisar tratar isso à parte se for relevante.
- **Pernambucano A2**: número de classificados por grupo para a semifinal
  (assumi 2 por grupo = 4 no total) não foi reconfirmado explicitamente na
  fonte, é inferência por padrão comum de outros estaduais.
- Clássicos de Pernambuco (Sport x Náutico, etc.) não foram pesquisados
  nesta rodada — nenhum foi adicionado por falta de confirmação do nome
  oficial de cada rivalidade.

## Paraná e Santa Catarina — detalhes pendentes

- **"Andraus" x "Galo Maringá"**: a pesquisa inicial levantou dúvida se
  seriam o mesmo clube com nome composto. Verificado por fonte: são dois
  clubes reais e distintos — Andraus (Campo Largo) e Galo Maringá (Maringá)
  — e há de fato um terceiro clube de Maringá, o Maringá FC, tornando a
  cidade única no campeonato por ter dois representantes.
- **"Barra FC" (Catarinense)**: a pesquisa inicial errou a cidade (disse
  Barra Velha). Verificado: o Barra FC que disputa a Série A 2026 é de
  Balneário Camboriú — corrigido antes de gravar.
- **Carlos Renaux x Brusque FC**: ambos clubes de Brusque-SC, e o Brusque FC
  nasceu de uma fusão em 1987 entre o antigo Carlos Renaux e o Paysandu de
  Brusque — mas a fonte da lista de participantes 2026 os trata como dois
  clubes atualmente distintos e ativos. Não investiguei a fundo como o
  Carlos Renaux voltou a existir separadamente após a fusão de 1987;
  incluí os dois por estarem confirmados como participantes separados da
  Série A 2026, mas vale checar essa história com mais cuidado.
- **Operário Ferroviário** e **Londrina**: ambos jogam Série B nacional —
  movidos para `brasil.json`.
- **Paranaense**: formato de mata-mata e relegação é mais complexo do que o
  schema representa (grupo de 4 times em "Torneio da Morte" à parte da
  fase principal) — modelei de forma aproximada; o resultado final
  confirmado (2 rebaixados: Andraus e Galo Maringá) bate, mas o mecanismo
  intermediário não está representado.
- **Catarinense**: mecanismo real de rebaixamento é um quadrangular especial
  em que o 5º colocado de uma das chaves entra com 1 ponto de vantagem —
  não representado no schema; usei só o resultado final confirmado (3
  rebaixados).

## Distrito Federal, Goiás, Mato Grosso e Mato Grosso do Sul — detalhes pendentes

- **Primavera Atlético Clube**: herdou o estádio Cerradão do antigo
  Primavera EC (dissolvido em 2011), mas a continuidade entre os dois
  clubes não está 100% confirmada.
- **Atlético Goianiense**: confirmado jogando Série B nacional 2026 —
  movido para `brasil.json`, mas continua listado em `times` do
  `goiano_1.json` por também disputar o estadual.
- **Matogrossense**: número de rebaixados não encontrado nas fontes
  consultadas — `premiacao` ficou vazio nesse arquivo.
- **Goiano**: regra real de rebaixamento tem um playoff condicional (10º x
  11º só se a diferença de pontos for ≤ 6) que o schema não representa —
  modelei só com `rebaixamento_proxima_divisao: 2` como aproximação.
- Nenhum caso de clube duplicado/ambíguo do tipo São Bernardo/Patrocinense
  encontrado — as duas coincidências reais (dois clubes em Várzea Grande-MT
  dividindo o mesmo estádio; Capital CF e Paranoá EC dividindo o estádio JK
  em Paranoá-DF) são situações genuínas confirmadas por fonte, não erros.

## Ceará, Rio Grande do Norte, Paraíba e Sergipe — detalhes pendentes

- **QFC (Potiguar)**: nome completo confirmado como "Quinho Futebol Clube"
  após verificação — a pesquisa inicial só tinha a sigla.
- **Atlético Gloriense** e **Dorense** (Sergipano): cidade não confirmada na
  pesquisa inicial — verificado: Nossa Senhora da Glória e Nossa Senhora das
  Dores, respectivamente (não Simão Dias, como a pesquisa inicial
  especulou).
- **Confiança (Sergipe)**: confirmado jogando Série C nacional 2026 —
  movido para `brasil.json` (id `confianca`); o "Confiança" da Paraíba é um
  clube diferente (id `confianca_pb`, Sapé).
- **Cearense**: formato real tem uma 2ª fase de reclassificação (os 3
  melhores de cada grupo da 1ª fase formam novos grupos) que o schema não
  representa — modelei de forma simplificada (`fase_grupos` seguido direto
  de `mata_mata` semifinal+final), perdendo o detalhe da reclassificação e
  do jogo de 3º lugar.
- **Potiguar/Paraibano/Sergipano**: formatos de mata-mata modelados por
  aproximação a partir de resumos rápidos de fonte, sem checar o
  regulamento oficial completo de cada federação.
- **Sergipano**: campeão e 3º colocado ganham vaga na Série D nacional
  2027 — fato não modelado no schema (`premiacao` não tem campo para vaga
  em competição nacional a partir de estadual).
- Clássicos de RN e PB não foram pesquisados/adicionados por falta de
  confirmação do nome oficial de cada rivalidade.

## Alagoas, Piauí, Maranhão e Espírito Santo — detalhes pendentes

- **CSA** (Alagoas): confirmado jogando Série D nacional 2026 — movido para
  `brasil.json`.
- **"Capixaba" (ES)**: um dos 10 clubes da 1ª divisão do Capixaba 2026 não
  teve a cidade confirmada com segurança (encontrei candidatos como "Sport
  Clube Brasil Capixaba" mas não bati com certeza) — excluído da base por
  `cidade` ser campo obrigatório. `capixaba_1.json` fica com 9 dos 10 times
  reais da divisão até resolver.
- Formatos de Alagoano, Piauiense e Maranhense modelados por aproximação
  simples (turno único + semifinal/final) a partir de resumos rápidos de
  fonte — não confirmei detalhes como cruzamentos exatos do mata-mata ou
  número de rebaixados/vagas nacionais.
- Clássicos de Alagoas e Piauí não foram pesquisados/adicionados por falta
  de confirmação do nome oficial de cada rivalidade.

## Pará, Amazonas, Tocantins e Rondônia — detalhes pendentes

- **Paysandu** (PA) e **Amazonas FC** (AM): confirmados jogando Série C
  nacional 2026 — movidos para `brasil.json`.
- **Paraense**: duas fontes divergiram sobre a lista de 12 clubes (uma
  citou "Caeté" e "Independente" em vez de "São Raimundo" e "Amazônia") —
  usei a lista da fonte que citava explicitamente "Parazão 2026" e o
  mecanismo de acesso via Série A2, mas vale checar contra o site oficial
  da FPF antes de considerar definitivo. Número de rebaixados não
  confirmado — `premiacao` ficou vazio.
- **Amazonense**: rebaixamento modelado como 1 time por inferência (uma
  fonte mencionou "Sete foi rebaixado" na edição anterior) — não é uma
  confirmação direta da regra atual.
- **Rondoniense**: só 7 clubes na 1ª divisão (número ímpar, incomum) —
  confirmado por múltiplas fontes, não é engano. Vagas de Copa do Brasil/
  Série D para campeão e vice não modeladas no schema.
- Clássicos de Amazonas, Tocantins e Rondônia não foram pesquisados/
  adicionados por falta de confirmação do nome oficial de cada rivalidade
  (Re-Pa do Pará foi adicionado por ser amplamente conhecido).

## Regras de formato ainda não confirmadas com o regulamento oficial

- **Paulistão A1 (fase suíça, desde 2026)**: confirmado que são 16 times em 4
  potes de 4, turno único, top 8 avança ao mata-mata; a fonte foi vaga sobre
  exatamente contra quem cada time joga fora do próprio pote (menciona "9
  jogos" mas a composição exata dos confrontos não fechou com clareza).
- **Paulistão A2**: a segunda fase (2 quadrangulares após os 8 classificados)
  e a "final de acesso" entre líderes foram confirmadas na estrutura, mas o
  número exato de vagas de acesso à A1 não foi encontrado — `premiacao` não
  tem `acesso_proxima_divisao` preenchido nesse arquivo por esse motivo.
- **Paulistão A3**: número de rebaixados à A4 não confirmado — `premiacao`
  ficou vazio nesse arquivo.

## Como resolver

Cada item acima deveria ser confirmado contra a fonte primária (site da FPF
para São Paulo, FERJ para o Rio) antes de ser promovido de "a verificar" para
os arquivos de dados definitivos.
