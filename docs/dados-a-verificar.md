## Primeiras divisões da CONMEBOL adicionadas em 2026

- Foram adicionadas as ligas de primeira divisão de Bolívia, Equador,
  Paraguai, Peru e Venezuela, com clubes, cidades e vínculos `pais`/`nivel`.
- Peru e Venezuela já foram corrigidos para os elencos de 2026 confirmados nas
  fontes consultadas: 18 e 14 clubes, respectivamente, incluindo Apertura e
  Clausura em turno único.
- Bolívia, Equador e Paraguai ainda precisam de conferência com as listas
  oficiais das respectivas federações. Formatos, acessos, rebaixamentos e
  vagas continentais continuam pendentes nos cinco arquivos.

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
- **"America" ligado à Série D 2026 (RJ)**: a distribuição oficial de grupos
  da Série D 2026 (CBF/NSC Total) lista "America-RJ" no Grupo A13 — é o
  mesmo clube já cadastrado como `america_rj` (Rio de Janeiro), não um clube
  distinto. Movido para `brasil.json` com `divisao_nacional` de Série D.
- **"Blumenau" (SC) ligado à Série D 2026**: confirmado por duas fontes
  independentes (distribuição oficial de grupos CBF/NSC Total, Grupo A16, e
  tabela de participantes da Wikipédia) como Blumenau Esporte Clube — clube
  novo na base (`blumenau_ec`), fundado em 1919, sede em Blumenau-SC.

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

## Acre, Roraima e Amapá — detalhes pendentes

- **Roraimense e Acreano**: quase todos os clubes de cada estado jogam no
  mesmo estádio da capital (Canarinho em Boa Vista; Florestão em Rio
  Branco) — por isso a maioria dos clubes ficou com `cidade` igual
  (Boa Vista / Rio Branco), o que é real, não erro de dado. Exceção:
  ADESG (Acre) é de Senador Guiomard, não da capital.
  Não é redundante nem gerou registros duplicados — são clubes distintos.
- **Amapaense**: cidade do "Cristal" inferida por contexto (fundado para
  rivalizar com o Oratório, também de Macapá) mas não confirmada
  explicitamente por fonte direta — confiança moderada, não alta.
- **Números de rebaixamento**: Acreano e Amapaense não tiveram o número
  exato de rebaixados confirmado nesta rodada (`premiacao` ficou vazio);
  Roraimense confirmado com 1 rebaixado (introduzido pela primeira vez
  em 2026, quando a 2ª divisão estadual foi criada).
- Clássicos de Acre, Roraima e Amapá não foram adicionados — não achei
  nome oficial confirmado de nenhuma rivalidade específica.

## Campeonatos nacionais (Brasileirão A, B, C) — detalhes pendentes

- **Tombense**: estava marcado `serie_b` mas foi confirmado que não faz
  parte da Série B 2026 real — tag removida. Não foi possível confirmar em
  que competição nacional (se alguma) o clube está atualmente, então ficou
  sem `divisao_nacional` e de fora dos três arquivos de campeonato
  nacional, até uma pesquisa dedicada confirmar sua situação.
- **Vagas de Libertadores/Sul-Americana da Série A**: não modeladas em
  `premiacao` — o número de vagas varia ano a ano pelo ranking da CBF
  (não é um número fixo por posição simples), e isso não foi apurado com
  precisão nesta rodada.
- **Rebaixamento da Série B**: mantive `rebaixamento_proxima_divisao: 4`
  por ser o padrão histórico conhecido, mas essa contagem específica não
  foi reconfirmada para 2026 na pesquisa.
- **Clássicos da Série A**: reaproveitei os clássicos estaduais já
  verificados cujos dois clubes disputam a Série A 2026 (Grenal, Derby
  Paulista, Fla-Flu, Clássico dos Milhões, Majestoso, Clássico da Vovó,
  Atletiba). Nenhum clássico novo foi pesquisado especificamente para o
  contexto nacional.
- **Série C**: formato modelado com boa confiança (fonte: CBF, band.com.br,
  olympics.com) — fase única de 20 times, top 8 avançam a 2 quadrangulares
  cruzados (1º/4º/5º/8º vs. 2º/3º/6º/7º), os 2 melhores de cada
  quadrangular sobem à Série B (4 vagas de acesso), líderes dos
  quadrangulares disputam o título, 2 últimos da fase única são
  rebaixados à Série D. É a última edição com 20 clubes antes da
  expansão (24 em 2027, 28 em 2028) — o formato vai mudar de novo em
  breve.

## Campeonato Brasileiro Série D — detalhes pendentes

- **Elenco completo (96/96)**: os 20 clubes que faltavam foram confirmados
  contra a distribuição oficial dos 16 grupos da edição 2026, cruzando duas
  fontes independentes (CBF/NSC Total, que publicou a lista literal dos 16
  grupos de 6, e a tabela de participantes da Wikipédia PT) — a fonte da CBF/
  NSC foi tratada como autoritativa nos casos em que as duas fontes
  divergiram em UF de um clube (ver bullet "Correções" abaixo). Dos 20, 19 já
  existiam cadastrados em arquivos `<uf>_estadual.json` (times que também
  disputam o estadual do seu estado) e foram movidos para `brasil.json` com
  `divisao_nacional` adicionado, mantendo o mesmo `id`: `rio_branco_es`,
  `vitoria_es` (ES); `uberlandia_ec`, `pouso_alegre` (MG); `sao_jose_rs`,
  `sao_luiz` (RS); `santa_catarina_ec` (SC); `nova_iguacu`,
  `sampaio_correa_rj`, `portuguesa_rj`, `america_rj` (RJ); `noroeste`,
  `velo_clube`, `xv_de_piracicaba` (SP); `sao_joseense` (PR); `operario_vg`,
  `primavera_ac`, `uniao_rondonopolis` (MT); `operario_ms` (MS). O 20º,
  **Blumenau Esporte Clube** (`blumenau_ec`, SC), não existia na base —
  criado novo, nome oficial e cidade confirmados via Wikipédia PT/EN,
  Sofascore e FotMob (fundado em 1919, hoje disputa Série D e Catarinense
  Série B).
- **Correções encontradas durante a conferência**: a fonte CBF/NSC Total
  confirmou que `decisao` é do **PE** (Goiana-PE, como já estava cadastrado)
  e não "Decisão Goiana-GO" como uma fonte secundária (resumo da Wikipédia)
  sugeriu — o nome "Goiana" é a cidade, não o estado; e que `oratorio` é do
  **AP** (Macapá, como já estava cadastrado), não MG. Nenhuma das duas
  precisou de correção na base — os dois já estavam certos —, mas fica
  registrado porque a fonte secundária estava errada nesses dois casos
  específicos, então não deve ser reusada sem checagem cruzada.
- **Descompasso de temporada**: as vagas da Série D 2026 vêm, na maioria
  dos casos, do resultado dos estaduais de **2025** — não da edição 2026
  que modelamos em `src/data/estaduais/`. O campo `premiacao.vaga_serie_d`
  foi preenchido mesmo assim nos arquivos 2026 atuais, tratando-os como
  "template" do mecanismo/formato daquele estadual, não como o registro
  histórico exato de quem ganhou a vaga em 2025. Isso é uma aproximação
  deliberada, não um erro não percebido.
- **Vagas que NÃO vêm do estadual** (por isso não entraram em
  `vaga_serie_d` de nenhum arquivo, mas os clubes estão em
  `brasileirao_serie_d.json.times`): `fc_cascavel`, `marcilio_dias`,
  `agua_santa`, `marica`, `aparecidense`, `goiatuba`, `luverdense`
  (direito de permanência da Série D anterior); `brasiliense`
  (pontuação no ranking nacional da CBF); `brasil_pelotas` (Copa FGF);
  `tombense` (origem não confirmada, mas participação em 2026
  confirmada); `central_pe` (não disputou nem o Pernambucano 2026,
  critério da vaga não documentado nas fontes encontradas);
  `atletico_cearense` (clube novo adicionado à base, não veio do
  Cearense modelado).
- **`portuguesa` (SP) e `real_noroeste` (ES)**: participação na Série D
  2026 confirmada, mas a fonte não deixou claro se a vaga veio do
  respectivo estadual — por isso entraram em `times[]` da Série D mas
  não contam em `vaga_serie_d` de `paulistao_a1`/`capixaba_1`.
- **Distrito Federal**: as fontes citam "Metropolitano-DF" como origem
  das vagas de `gama` e `capital_cf`, não "Campeonato Brasiliense" (que é
  o que modelamos como `candangao_1`) — pode ser uma competição
  diferente (talvez de base/amadora) que não modelamos. Por precaução,
  `candangao_1.premiacao` não recebeu `vaga_serie_d`, apesar de os 4
  clubes do DF (`gama`, `capital_cf`, `brasiliense`, `ceilandia`) estarem
  no elenco nacional.
- **Bahia**: uma fonte da pesquisa inicial citou "Jequié" como possível
  3º representante baiano, mas verificação direta confirmou que os 4
  reais são Atlético de Alagoinhas, Jacuipense, Juazeirense e Porto —
  todos já cadastrados e usados no `times[]`.
- **Formato**: 96 clubes em 16 grupos de 6 (turno e returno, confirmado
  por duas fontes independentes — uma delas disse "turno único" mas a
  contagem de rodadas, 10, só fecha com turno e returno), top 4 de cada
  grupo avança ao mata-mata nacional. 6 vagas de acesso à Série C 2027
  (4 semifinalistas + 2 vencedores de um playoff entre eliminados nas
  quartas) — aumentou de 4 para 6 nesta edição.

## Copa do Brasil e lógica de resolução de vagas — o que foi construído

- **Copa do Brasil 2026 — elenco completo (atualização)**: os 126 clubes
  reais da edição 2026 foram confirmados e adicionados a `times[]`
  (arquivo foi de 60 para 134 entradas — ver nota de "extras" abaixo).
  Fontes cruzadas: CBF (nota oficial "recorde de participantes e 17
  estreantes"), Wikipédia PT ("Copa do Brasil de Futebol de 2026"),
  Rádio Itatiaia e Jornal da Paraíba (ambos publicaram a lista completa
  dos 126 clubes por fase de estreia, batendo exatamente nas contagens
  por estado: 28 na 1ª fase, 74 na 2ª, 4 na 3ª — campeões de Copa Verde/
  Série D/Série C e vice da Copa do Nordeste — e 20 na 5ª, que é a
  Série A). Todos os 74 clubes novos já existiam cadastrados em algum
  `<uf>_estadual.json` ou em `brasil.json` — nenhum clube precisou ser
  criado do zero.
  - **`rio_branco_es`** (Espírito Santo): confirmado por manchete direta
    da CNN Brasil ("Rio Branco-ES x Athletic Club"), resolvendo a
    ambiguidade entre os dois "Rio Branco" capixabas cadastrados
    (`rio_branco_es`, Vitória, e `rio_branco_vn`, Venda Nova do
    Imigrante) — é o primeiro.
  - **`mac`** (Maranhão Atlético Clube): a fonte só citava "Maranhão"
    como participante da 2ª fase; como não há nenhum outro clube com
    esse nome cadastrado no Maranhense, assumi que é o MAC (cujo nome
    completo é literalmente "Maranhão Atlético Clube") — confiança boa,
    mas não é uma confirmação nominal exata.
  - **8 clubes que já estavam em `times[]` antes desta atualização não
    aparecem em nenhuma das quatro listas de fase cruzadas** (`nautico`,
    `botafogo_sp`, `criciuma`, `brusque_fc`, `ferroviaria`, `floresta`,
    `inter_de_limeira`, `ituano`) — como as contagens por fase batem
    exatamente (28+74+4+20=126) nas duas fontes que publicaram lista
    completa, é pouco provável que sejam omissões de fonte; mais
    provável é que esses 8 tenham sido incluídos anteriormente por
    "alta confiança genérica" (jogam Série A/B/C) sem checar se
    realmente entraram no chaveamento real desta edição específica.
    Não foram removidos por precaução — vale confirmar contra a fonte
    oficial antes de decidir se saem da lista.
  - **Formato real mais preciso que o já documentado**: 9 fases
    confirmado (CBF/Wikipédia); da 1ª à 4ª fase os jogos são eliminatórios
    em **partida única**; da 5ª fase às quartas de final (e semifinal,
    segundo a Wikipédia) os confrontos são **ida e volta**; a **final é
    jogo único** (mudança desta edição). O `formato.mata_mata` atual do
    schema (`ida_e_volta: true` uniforme para todas as 8 fases listadas)
    não representa nem o número certo de fases nem essa mistura de
    jogo único/ida-e-volta/final única — schema precisaria de um campo
    por fase (ou pelo menos separar "fases de jogo único" de "fases de
    ida e volta" e marcar a final como exceção). Fica como pendência de
    modelagem, não implementada nesta rodada.
- **`nivel: 0`** foi reservado para competições de mata-mata puro fora da
  hierarquia vertical A→B→C→D (hoje só a Copa do Brasil) — o teste que
  confere `divisao_nacional` por nível pula esse caso de propósito.

- **Lógica de resolução criada** (`src/data/loaders/vagas-nacionais.ts`,
  função `resolverVagasEstaduais`): dado o número de vagas de um estadual
  (`premiacao.vaga_serie_d` ou `vaga_copa_do_brasil`) e a classificação
  final dessa competição, retorna os N melhores colocados que ainda não
  disputam nenhuma competição nacional. Cobre tanto "só o campeão" quanto
  "campeão e vice" sem precisar de um branch por critério — a posição
  exata só muda o N. Testada com dados sintéticos (não há classificação
  real ainda, isso depende do motor de simulação da Fase 2).
- **`vaga_serie_d_criterio`** (novo campo, texto livre) documenta como
  cada estadual distribui as vagas confirmadas por pesquisa; onde não foi
  possível confirmar a posição exata, ficou registrado como "melhor(es)
  colocado(s) sem competição nacional — posição exata não confirmada",
  que é justamente o comportamento padrão da função de resolução.
- **3 estaduais sem pesquisa dedicada de Série D** (`paulistao_a1`,
  `candangao_1`, `capixaba_1`) receberam a regra padrão (1 vaga, melhor
  colocado sem competição nacional) em vez de ficarem sem nada — vale
  revisar contra fonte real depois, especialmente São Paulo, que
  provavelmente tem mais de 1 vaga por ser um estado grande.

## Copas regionais (Nordeste, Verde, Sul-Sudeste) — geradas por script

- **Geração automática**: `scripts/gerar-copas-regionais.ts` monta os 3
  arquivos a partir de um seed de vagas reais pesquisadas (não escrito à
  mão) + `gerarTimesDaCopa` (`src/data/loaders/gerar-copa-regional.ts`),
  que só valida que os ids existem na base e monta a lista — nenhum clube
  novo foi pesquisado, os 56 já existiam. Rodar de novo com
  `npx tsx scripts/gerar-copas-regionais.ts` sempre que o seed mudar.
- **Critério real não é "sem competição nacional"**: diferente da Série D,
  a exclusão dessas copas é "sem CONMEBOL" (Libertadores/Sul-Americana),
  não "sem Série A/B/C" — por isso clubes de Série A/B (Vitória, Ceará,
  Fortaleza, Sport, Avaí, Juventude etc.) aparecem normalmente nas listas.
  Não temos no schema um jeito de saber quem está na CONMEBOL num dado
  ano, então o seed usa a lista real já resolvida pela fonte, em vez de
  tentar recalcular a exclusão.
- **Campeão vs. vice não distinguido**: pra quase todas as vagas, sei
  quais 2-3 clubes ocupam a vaga de cada estado/federação, mas não qual é
  campeão e qual é vice (exceto MG, PR e SC na Copa Sul-Sudeste, onde a
  fonte foi explícita). Os campos `criterio` refletem essa incerteza.
- **Copa do Nordeste — formato aproximado**: o real são 4 grupos de 5
  pareados (A×B, C×D — um grupo só enfrenta o seu par, não os outros
  dois); `fase_suica` não representa esse pareamento, só bate a
  contagem de jogos (5 por time). A continuação depois da fase de grupos
  (mata-mata? outra fase de grupos?) não foi confirmada.
- **Copa Verde**: schema ganhou o bloco `dupla_chave_regional`
  (`FormatoEstadual`) pra representar as duas metades independentes
  (Copa Norte, Copa Centro-Oeste) que só se cruzam na final — confirmado
  por fonte que a final 2026 foi exatamente Anápolis (campeão Centro-
  Oeste) x Paysandu (campeão Norte).
- **Premiação**: as três dão vaga na Copa do Brasil (3ª fase) pro
  campeão — não confirmei se dão Sul-Americana/Libertadores direto (achei
  indício de que não, mas não é 100% certo).

## Expansão CONMEBOL — Argentina (1ª divisão)

- **Fonte**: openfootball só tem até a temporada 2025 (30 clubes,
  confirmados por dados de partida real). Os 30 clubes de 2026 foram
  confirmados via busca (ESPN, Wikipédia PT/EN, La Nación, Infobae) —
  cross-referenciei com o elenco 2025 do openfootball e bate exatamente
  exceto por 2 promovidos (Gimnasia y Esgrima de Mendoza, Estudiantes de
  Río Cuarto) que verifiquei individualmente por fonte própria.
- **Formato aproximado**: o real é duas zonas de 15 times por torneio
  (Apertura e Clausura), quase-todos-contra-todos dentro da zona + 1
  clássico/rodada interzonal, playoffs de jogo único pra decidir cada
  torneio, e uma Tabela Anual (soma dos pontos da fase regular dos dois
  torneios) que define o "Campeão de Liga" de verdade e as vagas
  continentais. Modelei isso com `turno`/`returno` (um por torneio) +
  `final_estadual` reaproveitado pra representar a Tabela Anual — não é
  literalmente uma final, é uma reconciliação por tabela. Não modelei as
  2 zonas internas de cada torneio nem o tamanho exato do chaveamento de
  playoff (`classificam_proxima_fase: 16` é uma estimativa, não
  confirmada).
- **Rebaixamento**: Argentina usa um sistema de "promedios" (média de
  pontos de múltiplas temporadas), não simples "último colocado desce" —
  não modelado. `rebaixamento_proxima_divisao: 2` é inferência a partir
  do número de promovidos (2), não confirmado por fonte direta sobre o
  mecanismo real.
- **Vagas CONMEBOL**: essas sim, bem confirmadas por fonte específica —
  6 vagas de Libertadores (campeão Apertura, campeão Clausura, campeão
  Copa Argentina, 3 melhores da Tabela Anual sem vaga por outra via) e
  6 de Sul-Americana (6 melhores da Tabela Anual restantes).
- **Clássicos**: só incluí os 2 mais inquestionáveis (Superclásico
  River-Boca, Clássico de Avellaneda Racing-Independiente) — existem
  vários outros clássicos regionais argentinos não pesquisados.

## Expansão CONMEBOL — Uruguai (1ª divisão)

- **Fonte**: sem cobertura no openfootball — pesquisado do zero via
  Wikipédia ES/EN (fetch direto da página do Campeonato Uruguayo 2026),
  cross-referenciado com uma segunda busca que trouxe a mesma lista de
  16 clubes de forma independente.
- **1 erro corrigido antes de gravar**: escrevi errado o nome oficial do
  "Progreso" (coloquei "Institución Atlética Sud América", que é outro
  clube uruguaio) — corrigido pra "Club Atlético Progreso" antes do
  commit.
- **Formato aproximado**: real tem 4 componentes (Apertura, Torneo
  Intermedio — 16 times em 2 grupos por campanha do Apertura, Clausura,
  Tabela Anual) e uma cadeia de mata-mata pra decidir o campeão anual
  (semifinal Apertura x Clausura, final contra o líder da Tabela Anual,
  com atalho se o mesmo time vencer os dois turnos). Modelado com
  turno/returno (Apertura/Clausura) + fase_grupos (Intermedio) +
  mata_mata (cadeia final) — aproximação razoável, mas o schema não
  amarra explicitamente qual fase alimenta qual etapa do mata-mata.
- **Rebaixamento não confirmado**: 3 clubes subiram da Segunda División
  2025, o que sugere 3 descidas, mas não confirmei isso por fonte direta
  nem o mecanismo exato (Uruguai também costuma usar tabela de médias
  plurianuais, não simples "último cai") — `premiacao` ficou sem
  `rebaixamento_proxima_divisao` por esse motivo.
- **Vagas CONMEBOL**: Libertadores bem confirmada (4: campeão anual,
  vice, 2º da Tabela Anual, campeão da Copa AUF Uruguay). Sul-Americana
  confirmada em número (4) mas não em critério exato posição-a-posição.

## Expansão CONMEBOL — Chile (1ª divisão)

- **Fonte**: sem cobertura no openfootball — pesquisado do zero,
  confirmado por duas fontes independentes (busca agregada + fetch
  direto da Wikipédia ES da temporada 2026), lista idêntica nas duas.
- **Formato**: o mais simples até agora — torneio único de pontos
  corridos (turno e returno, 30 rodadas), sem Apertura/Clausura. Encaixa
  bem no bloco `pontos_corridos` já existente, sem aproximação.
- **Vagas CONMEBOL muito bem documentadas**: 4 Libertadores (1º e 2º do
  Campeonato Nacional, campeão da Copa de la Liga, vencedor de jogo
  único 3º colocado x campeão da Copa Chile) e 4 Sul-Americana (4º, 5º,
  6º colocados + perdedor daquele jogo único).
- **Rebaixamento não confirmado**: não encontrei o número exato de
  descensos nesta rodada de pesquisa — `premiacao` ficou sem
  `rebaixamento_proxima_divisao`.

## Expansão CONMEBOL — Colômbia (1ª divisão)

- **Fonte**: openfootball só tem até 2025 (20 clubes). Lista 2026 completa
  confirmada via fetch direto da Wikipédia ES ("Torneo Apertura 2026
  (Colombia)"); os 3 clubes novos (Cúcuta Deportivo, Jaguares de
  Córdoba promovidos; Internacional de Bogotá no lugar do Equidad)
  também confirmados por uma segunda fonte (Futbolred) que citou essas
  mudanças especificamente.
- **Formato assimétrico não totalmente capturado**: em 2026 o Apertura
  usa playoff direto (mata-mata a partir das quartas, sem cuadrangulares)
  enquanto o Finalización usa cuadrangulares semifinais — mudança
  específica dessa temporada. Modelei os dois torneios de forma
  uniforme com `fase_quadrangular`, o que representa bem o Finalización
  mas não a mudança de formato do Apertura.
- **Vagas CONMEBOL bem documentadas**: 4 Libertadores (campeão Apertura,
  campeão Finalización, 2 melhores da tabela de reclassificação anual) e
  4 Sul-Americana (campeão da Copa Colombia + 3 melhores da
  reclassificação restantes).
- **Rebaixamento não confirmado** — `premiacao` ficou sem
  `rebaixamento_proxima_divisao`.
- **Águilas Doradas**: fontes divergem entre "Medellín" e "Rionegro"
  como cidade-sede — usei Rionegro (sede tradicional do clube) por ser
  mais específico, mas vale confirmar.

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
