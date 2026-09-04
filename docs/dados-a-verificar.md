## Primeiras divisões da CONMEBOL adicionadas em 2026

- Foram adicionadas as ligas de primeira divisão de Bolívia, Equador,
  Paraguai, Peru e Venezuela, com clubes, cidades e vínculos `pais`/`nivel`.
- **Atualização**: os 5 países já receberam o mesmo tratamento de detalhe
  que Argentina/Uruguai/Chile/Colômbia — formato real, rebaixamento e vagas
  de Libertadores/Sul-Americana documentados e confirmados por fonte, ver
  seções próprias "Expansão CONMEBOL — <país>" mais abaixo neste arquivo.
  Nenhum ficou sem correção: até os 2 marcados como "já corrigidos" (Peru,
  Venezuela) numa rodada anterior tinham pelo menos um erro real (Peru:
  `premiacao` vazia e Liguilla final mal modelada; Venezuela: vagas
  CONMEBOL subestimadas pela metade — 4+4, não 2+2).

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

- **Copa do Brasil 2026 — elenco completo e corrigido contra a fonte
  primária (CBF)**: `times[]` tem os 126 clubes reais da edição, com
  fonte de verdade agora sendo a própria página da CBF
  (cbf.com.br/futebol-brasileiro/noticias/se/a/copa-do-brasil-de-2026-tera-recorde-de-participantes-e-17-estreantes),
  que lista os 126 participantes nominalmente por estado (não só o total
  "recorde de participantes e 17 estreantes"). Essa lista por estado
  bateu 126/126 contra a base de clubes já cadastrada, sem precisar criar
  nenhum clube novo.
  - **Duas rodadas anteriores de pesquisa (Wikipédia/imprensa regional
    cruzadas, depois "verificação individual" clube a clube) erraram
    9 entradas**, incluídas por engano antes da fonte oficial ser
    conferida diretamente: `botafogo_sp`, `criciuma`, `brusque_fc`,
    `ferroviaria`, `floresta`, `inter_de_limeira`, `ituano`, `gurupi`,
    `brasiliense`. Nenhum desses aparece na lista oficial da CBF pro
    estado correspondente (SP tem 13 confirmados, nenhum é Botafogo-SP/
    Ferroviária/Inter de Limeira/Ituano; SC tem 6, nenhum é Criciúma/
    Brusque; CE tem 4, nenhum é Floresta; TO tem 3 — Araguaína, Capital,
    Tocantinópolis, não Gurupi; DF tem 3 — Capital, Ceilândia, Gama, não
    Brasiliense) — **removidos de `times[]`**. Isso inclui até 4 casos em
    que uma pesquisa anterior achou o que parecia ser um resultado de
    jogo real específico (`botafogo_sp`, `criciuma`, `brusque_fc`,
    `inter_de_limeira`) — bate errado com a fonte oficial mesmo assim, o
    que sugere que esses "resultados" encontrados por busca na web eram
    de outra competição/ano ou mal atribuídos. **Lição**: pra uma
    competição com fonte primária federativa disponível e completa (like
    esta nota da CBF), ela deve prevalecer sobre cruzamento de fontes
    secundárias, mesmo quando a fonte secundária parece dar um resultado
    de jogo específico.
  - **Duas vagas reais ficaram de fora nas rodadas anteriores e foram
    adicionadas agora**: `ceilandia` (DF) e `capital_fc_to` (Tocantins,
    não confundir com `capital_cf`, o Capital do Distrito Federal).
  - **`rio_branco_es`** (Espírito Santo) permanece confirmado — a fonte
    da CBF só cita "Rio Branco (7 participações)" sem desambiguar, mas a
    manchete direta da CNN Brasil ("Rio Branco-ES x Athletic Club") já
    tinha resolvido a ambiguidade entre os dois "Rio Branco" capixabas
    cadastrados (`rio_branco_es`, Vitória — o correto — e `rio_branco_vn`,
    Venda Nova do Imigrante).
  - **`mac`** (Maranhão Atlético Clube): a fonte da CBF cita só "Maranhão
    (10 participações)"; como não há nenhum outro clube com esse nome
    cadastrado no Maranhense, mantém-se a suposição de que é o MAC (nome
    completo "Maranhão Atlético Clube") — confiança boa, mas não é uma
    confirmação nominal exata letra por letra.
  - A nota da CBF também confirma que a edição 2026 tem **415 clubes
    diferentes na história da competição desde 1989** e que **São Paulo é
    o estado com mais participantes (13)**, seguido do Rio de Janeiro
    (10) — dado de contexto, sem efeito na modelagem.
  - **Formato de 9 fases com entrada escalonada — modelado** (resolvido
    com o novo campo `formato.mata_mata.etapas`, ver
    `src/schemas/championship.ts`): `fases`/`ida_e_volta` legado agora tem
    as 9 fases corretas (faltava `quinta_fase` na lista antiga, corrigido)
    e `etapas[]` detalha jogo único (1ª-4ª fase e final) vs ida e volta
    (5ª fase a semifinal) e quem entra fresco em cada fase:
    - **1ª fase (28 clubes) — confiança alta, nominal**: confrontos
      extraídos diretamente da tabela de resultados da Wikipédia PT
      ("Copa do Brasil de Futebol de 2026"), os 14 jogos batem exatamente
      com os 28 clubes de `times[]` que não aparecem em nenhuma outra
      fase.
    - **3ª fase (4 clubes) — confiança alta, nominal**: TMC Esporte
      confirma os 4 entrantes diretos — Paysandu (campeão Copa Verde),
      Confiança-SE (herdou a vaga da Copa do Nordeste porque o Bahia,
      campeão de fato, foi excluído das copas regionais por disputar
      competição internacional), Ponte Preta (campeã Série C) e Barra-SC
      (campeão Série D).
    - **5ª fase (20 clubes) — confiança alta, derivado da própria base**:
      os 20 clubes de `divisao_nacional: {pais: "BR", nivel: 1}` (Série A
      2026), sem precisar de fonte externa.
    - **2ª fase (74 clubes) — confiança média, por dedução, não nominal
      confirmada um a um**: nenhuma fonte consultada trouxe a lista
      nominal completa da 2ª fase (só a contagem, "74 clubes com melhor
      posicionamento no ranking entram nesta fase" — confirmada por 3
      fontes independentes). Como as outras 4 fases (1ª, 3ª, 5ª, e a
      ausência de entrantes na 4ª/oitavas/quartas/semifinal/final) já
      somam exatamente 52 dos 126 clubes com confiança nominal alta, os
      **74 restantes de `times[]` foram atribuídos à 2ª fase por
      subtração** — matematicamente forçado a bater (28+74+4+20=126,
      confirmado por múltiplas fontes), mas sem confirmação nominal
      individual de que cada um desses 74 específicos entrou exatamente
      nessa fase (só que o conjunto certo de 74 clubes entra ali).
    - **4ª fase, oitavas, quartas, semifinal, final**: sem entrantes
      novos — só quem venceu a fase anterior, por isso `entrantes`
      omitido nessas etapas.
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

## Modelagem — Copa Libertadores 2026

- **Fonte**: Wikipédia ES "Copa Libertadores 2026" (fetch direto da página,
  já com resultados reais da fase de grupos disputada em abril/maio de
  2026 — a edição já está em andamento no mundo real na data de hoje,
  faltando só as fases finais, que terminam em 28 de novembro de 2026).
- **Elenco**: **47 de 47 clubes reais confirmados** (todos já existiam na
  base, cadastrados durante a modelagem dos 9 países CONMEBOL + Brasil —
  nenhum clube novo precisou ser criado). A fonte organiza os 47 por país
  com o "cupo" de cada um: Argentina 7 (Lanús, Platense, Estudiantes LP,
  Independiente Rivadavia, Rosario Central, Boca Juniors, Argentinos
  Juniors), Bolívia 4, Brasil 8 (Flamengo, Corinthians, Palmeiras,
  Cruzeiro, Mirassol, Fluminense, Botafogo, Bahia — campeão vigente da
  Libertadores + campeão da Copa do Brasil + vice a 7º colocados do
  Brasileirão 2025), Chile 4, Colômbia 4, Equador 4, Paraguai 4, Peru 4,
  Uruguai 4, Venezuela 4. `times[]` inclui os 47, sem distinguir fase de
  entrada (mesmo critério já usado na Copa do Brasil).
- **Formato modelado (corpo principal)**: fase de grupos com os 32
  clubes que a alcançam (8 grupos de 4, todos contra todos ida e volta,
  2 primeiros de cada grupo avançam) + mata-mata (oitavas, quartas,
  semifinal, final) — `fase_grupos`/`mata_mata` do schema, confiança alta
  (contagens e resultados reais confirmados grupo a grupo na fonte).
- **Fase preliminar — modelada em `formato.mata_mata.etapas`** (schema
  estendido no commit `ccde052` com `EtapaMataMata`/`entrantes`, usado
  pela primeira vez na Copa do Brasil e agora aqui). Confirmado por fonte
  nominal (Wikipédia ES + ESPN + CONMEBOL.com, incluindo o release
  oficial "Estos son los clasificados a la Fase 3"):
  - **Primeira fase** (6 entrantes, ida e volta): `alianza_lima`,
    `deportivo_tachira`, `universidad_catolica_ec`, `sportivo_2_de_mayo`,
    `juventud`, `the_strongest` (3 confrontos: PE×VE, EC×UY, PY×BO).
  - **Segunda fase** (13 entrantes frescos + 3 vencedores da 1ª fase,
    ida e volta): `botafogo`, `bahia` (BR); `huachipato`, `ohiggins`
    (CL); `independiente_medellin`, `deportes_tolima` (CO);
    `argentinos_juniors` (AR); `nacional_potosi` (BO); `barcelona_sc`
    (EC); `guarani_paraguai` (PY); `sporting_cristal` (PE); `liverpool_uy`
    (UY); `carabobo` (VE).
  - **Terceira fase** (sem entrantes novos — os 8 vencedores da 2ª fase
    seguem direto): confirmado por fonte quem venceu e quem perdeu —
    venceram e completaram os 32 da fase de grupos: `barcelona_sc`,
    `deportes_tolima`, `sporting_cristal`, `independiente_medellin`;
    **perderam e foram transferidos à Copa Sul-Americana 2026**:
    `juventud`, `ohiggins`, `carabobo`, `botafogo` — esses 4 ids já
    resolvem a metade da pendência de "quem vem da Libertadores pra
    Sul-Americana" que ficou em aberto quando `sulamericana.json` foi
    modelado, útil pra quando o arquivo da Sul-Americana ganhar seus
    próprios `etapas`.
  - **Não resolvido nesta rodada**: os 8 terceiros colocados da fase de
    grupos da Libertadores (que vão pro repechaje de oitavas da
    Sul-Americana) — o mecanismo está confirmado por fonte (1º avança
    direto às oitavas da própria Libertadores, 2º idem, 3º cai pro
    repechaje da Sul-Americana), mas os 8 ids específicos não foram
    pesquisados nesta passada.
  - `oitavas`/`quartas`/`semifinal`/`final` sem `entrantes` (continuação
    natural da fase de grupos, sem entrada escalonada).
- **Final em jogo único** (Estádio Centenário, Montevidéu) — resolvido
  junto com a fase preliminar: a etapa `final` em `etapas` tem
  `ida_e_volta: false`, enquanto as demais etapas de mata-mata (incluindo
  as 3 preliminares) são `true`. O campo legado `mata_mata.ida_e_volta`
  (nível do bloco todo) continua `true` só como resumo geral.
- **`pais: "CONMEBOL"`**: decisão deliberada, não é um código ISO 3166-1
  real — a competição não tem país-sede único (final rotativa entre os
  10 países). Mesmo padrão poderia servir de referência pra outras copas
  continentais (Sul-Americana, Recopa).
- **Premiação**: nenhum campo de `Premiacao` do schema atual cobre o que
  o campeão da Libertadores ganha (vaga direta na Copa Intercontinental
  da FIFA 2026, na Recopa Sul-Americana 2027 e na Copa Mundial de Clubes
  da FIFA 2029) — fica só documentado aqui, sem campo correspondente.

## Modelagem — Copa Sul-Americana 2026

- **Fonte**: busca agregada (Infobae, El Gráfico, ESPN, promediosinfo.com)
  + fetch direto da Wikipédia ES "Copa Sudamericana 2026" (mapa de
  localização dos clubes participantes, que também marca com "(L)" os
  clubes transferidos da Copa Libertadores 2026 — mesma edição que acabou
  de ser modelada em `libertadores.json`). Como a Libertadores, a edição
  2026 já está em andamento no mundo real (fase de grupos disputada entre
  abril e maio de 2026); final marcada para 21/11/2026, em jogo único, no
  Estádio Metropolitano Roberto Meléndez, Barranquilla-Colômbia (fonte:
  CONMEBOL, ESPN).
- **Elenco**: **56 de 56 clubes confirmados** no mapa de participantes da
  Wikipédia (todos já existiam na base, cadastrados durante a modelagem
  dos 9 países CONMEBOL + Brasil e/ou durante a modelagem da própria
  Libertadores — nenhum clube novo precisou ser criado). Distribuição por
  país: Argentina 8, Bolívia 5, Brasil 7, Chile 5, Colômbia 6, Equador 4,
  Paraguai 4, Peru 5, Uruguai 6, Venezuela 6. `times[]` não distingue
  fase de entrada (mesmo critério já usado na Copa do Brasil e na
  Libertadores) — mas a fase de entrada de cada um dos 56 já está
  totalmente resolvida em `formato.mata_mata.etapas`, ver bullet abaixo
  (atualização: as 4 vagas da fase de grupos vindas da Fase 3 da
  Libertadores, citadas como não resolvidas numa rodada de pesquisa
  anterior, e as 8 vagas da `repescagem` vindas dos terceiros-colocados
  da Libertadores, também citadas como pendentes na seção da
  Libertadores, foram todas confirmadas nominalmente por fonte).
  - **12 clubes marcados "(L)" no mapa da Wikipédia** (`boca_juniors`,
    `lanus`, `bolivar`, `botafogo`, `ohiggins`, `santa_fe_co`,
    `independiente_medellin`, `sporting_cristal`, `nacional_uy`,
    `juventud`, `universidad_central_venezuela`, `carabobo`) também
    aparecem em `times[]` da Libertadores — **não é duplicata/erro**: são
    clubes que disputam (ou disputaram) a Libertadores e, se eliminados
    nas fases preliminares dela, são transferidos pra Sul-Americana no
    mesmo ano, então aparecer nas duas listas é o comportamento real
    esperado.
- **Formato modelado (corpo principal)**: fase de grupos com os 32 clubes
  que a alcançam (8 grupos de 4, todos contra todos ida e volta) —
  confiança alta pro tamanho/formato geral (confirmado por múltiplas
  fontes de imprensa). **Assimetria de classificação ainda não
  representada** (só `classificam_por_grupo: 2` por aproximação): o 1º
  colocado de cada grupo avança direto às oitavas, o 2º entra na
  `repescagem` (ver abaixo) — o schema não tem como marcar "1º e 2º
  seguem caminhos diferentes" dentro de `fase_grupos`, mesma
  simplificação já usada em outras assimetrias do projeto (ex:
  Pernambucano A1).
- **Fase preliminar e repescagem — modeladas** com o novo campo
  `formato.mata_mata.etapas` (mesma técnica já usada na Copa do Brasil e
  na Libertadores), **todas as entradas confirmadas individualmente por
  fonte** (Wikipédia EN "2026 Copa Sudamericana first stage"/"final
  stages", beIN Sports, FotMob):
  - **`primeira_fase`** (32 clubes, jogo único com pênaltis em caso de
    empate — confirmado explicitamente pelo texto do regulamento citado
    na Wikipédia): 4 clubes de cada um dos 8 países "menores" (Bolívia,
    Chile, Colômbia, Equador, Paraguai, Peru, Uruguai, Venezuela) jogam
    2 confrontos internos por país (não cruzados entre países), 16
    vencedores avançam à fase de grupos.
  - **`repescagem`** (ida e volta, mandante do returno é o 2º colocado
    do grupo da Sul-Americana): os **8 terceiros colocados da fase de
    grupos da Libertadores** (`independiente_medellin`, `nacional_uy`,
    `bolivar`, `boca_juniors`, `santa_fe_co`, `sporting_cristal`,
    `lanus`, `universidad_central_venezuela`) enfrentam os 8 segundos
    colocados dos grupos da própria Sul-Americana — resolve a pendência
    que tinha ficado em aberto na seção da Libertadores ("8 terceiros
    colocados... não foram resolvidos nesta rodada").
  - **16 clubes entram direto na fase de grupos** sem passar por
    `primeira_fase` nem aparecer em nenhum `entrantes`: Argentina 6
    (`river_plate`, `racing_club`, `deportivo_riestra`, `san_lorenzo`,
    `tigre`, `barracas_central`) + Brasil 6 (`sao_paulo`, `gremio`,
    `red_bull_bragantino`, `atletico_mg`, `santos`, `vasco_da_gama`) + 4
    perdedores da Fase 3 da Libertadores (`juventud`, `ohiggins`,
    `carabobo`, `botafogo`) — mesma convenção já usada na Libertadores
    pros diretos-à-fase-de-grupos (não ficam em `etapas`, só em
    `times[]`, porque quem os "recebe" é `fase_grupos`, não `mata_mata`).
  - `oitavas`/`quartas`/`semifinal`: ida e volta, mandante do returno é
    o time de melhor campanha/seed. `final`: jogo único (Barranquilla,
    já documentado).
  - Isso corrigiu também os 12 clubes marcados "(L)" do bullet anterior:
    4 deles (`juventud`, `ohiggins`, `carabobo`, `botafogo`) são
    perdedores da Fase 3 (entram direto na fase de grupos), os outros 8
    são os terceiros-colocados que entram na `repescagem` — a
    distinção entre os dois grupos não estava clara na pesquisa
    anterior e ficou resolvida agora.
- **`pais: "CONMEBOL"`**: mesma decisão deliberada já usada na
  Libertadores — sem sede única (a final é rotativa, mas todo o resto do
  torneio é distribuído pelos 10 países).
- **Premiação — vaga direta na Libertadores seguinte**: confirmado por
  fonte (desde 2016, regra vigente) que o campeão da Sul-Americana entra
  direto na fase de grupos da Libertadores do ano seguinte — nenhum campo
  de `Premiacao` do schema atual cobre isso (é uma vaga *concedida por*
  uma competição *pra* outra competição irmã, não uma vaga estadual pra
  competição nacional), fica só documentado aqui, sem campo
  correspondente, mesma situação da premiação da própria Libertadores
  (Intercontinental/Recopa/Mundial de Clubes).

## 2ª divisão CONMEBOL — Argentina (Primera Nacional)

- **Fonte**: Wikipédia ES "Campeonato de Primera Nacional 2026" (fetch
  direto do HTML — o WebFetch com resumo por IA errou a composição das
  zonas na primeira tentativa, listando clubes duplicados entre Zona A e
  B; a extração direta da tabela de posições de cada zona corrigiu isso).
  A edição já está em andamento no mundo real (27ª rodada disputada).
- **Elenco**: **36 de 36 clubes confirmados** (18 por zona), com
  cidade/estádio direto da tabela oficial de participantes da Wikipédia.
  Zona A: Acassuso, All Boys, Almirante Brown, Central Norte (Salta),
  Chaco For Ever, Ciudad de Bolívar, Colón, Defensores de Belgrano,
  Deportivo Madryn, Deportivo Morón, Estudiantes (BA), Ferro Carril
  Oeste, Godoy Cruz, Los Andes, Mitre (SdE), Racing (Córdoba), San
  Miguel, San Telmo. Zona B: Agropecuario, Almagro, Atlanta, Atlético de
  Rafaela, Chacarita Juniors, Colegiales, Deportivo Maipú, Ferrocarril
  Midland, Gimnasia y Esgrima (Jujuy), Gimnasia y Tiro (Salta), Güemes
  (SdE), Nueva Chicago, Patronato, Quilmes, San Martín (SJ), San Martín
  (Tucumán), Temperley, Tristán Suárez.
- **Ids desambiguados** de clubes já existentes na base (nível 1) com
  nome parecido: `estudiantes_caseros` (≠ `estudiantes_lp`,
  `estudiantes_rio_cuarto`), `racing_cordoba` (≠ `racing_club`,
  Avellaneda), `gimnasia_esgrima_jujuy`/`gimnasia_tiro_salta` (≠
  `gimnasia_mendoza`, `gimnasia_la_plata`), `colon_santa_fe`,
  `guemes_santiago`, `mitre_santiago`, `central_norte_salta` — nenhum
  colidia de fato com id existente, mas o sufixo evita ambiguidade
  futura. `san_martin_sj`/`san_martin_tucuman` também desambiguados entre
  si (são dois clubes reais e distintos com o mesmo nome popular).
- **Confirmado por esta pesquisa**: Godoy Cruz está corretamente fora da
  1ª divisão (`argentina_primera.json`) — foi rebaixado à Primera
  Nacional 2026 (fonte: tabela "Equipos descendidos de la Primera
  División 2025" da própria Wikipédia). Nenhum conflito com a modelagem
  da 1ª divisão já feita.
- **Formato real**: 2 zonas de 18 times, todos-contra-todos ida e volta
  (34 rodadas) + 1 rodada especial interzonal por turno. Os campeões de
  cada zona disputam uma **final em campo neutro** pelo 1º ascenso
  direto; o perdedor dessa final entra no **"Reduzido"** junto com as
  posições 2ª-8ª de cada zona (14 times) — mata-mata de jogo único na
  casa do melhor colocado, vencedor leva o 2º ascenso. Modelado com
  `fase_grupos` (`classificam_por_grupo: 8`, aproximação — só o 1º de
  cada zona vai direto à final, os demais entre 2º-8º vão ao Reduzido,
  o schema não distingue as duas rotas) + `final_estadual` (a final
  entre campeões de zona) + `mata_mata` simples (`["reduzido"]`, sem
  `etapas` detalhado — não fechei o chaveamento exato de 15 times do
  Reduzido nesta rodada).
- **Rebaixamento**: 4 clubes (os 2 últimos de cada zona), confirmado por
  fonte — descem pra Primera B Metropolitana ou Torneo Federal A
  conforme afiliação (3ª divisão, não modelada no projeto).
- **Vaga de Copa Argentina 2027**: a fonte confirma que algumas posições
  de cada zona classificam à Copa Argentina 2027, mas as marcações
  exatas (que posições) não ficaram claras na extração — não modelado
  (não há campo de premiação genérico pra isso no schema, similar ao que
  já documentamos pra vagas de Libertadores/Sul-Americana da Série A do
  Brasil).
- **Nomes completos**: pra clubes menos conhecidos, o campo `nome`
  (razão social completa) foi preenchido por conhecimento geral de
  futebol argentino, não reverificado individualmente clube a clube —
  `nome_popular`/existência/participação 2026 vêm todos direto da fonte.

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
- **Rebaixamento — resolvido na modelagem da 2ª divisão**: 2 clubes descem
  por temporada. Confirmado ao modelar `chile_segunda.json` — a seção
  "Relevos" da Wikipédia da Liga de Ascenso 2026 lista Deportes Iquique
  (15º) e Unión Española (16º) como os 2 rebaixados da Liga de Primera
  2025 que passaram a disputar a Liga de Ascenso em 2026.
  `premiacao.rebaixamento_proxima_divisao: 2` preenchido.

## 2ª divisão CONMEBOL — Chile (Liga de Ascenso)

- **Correção de nome**: a competição chamada "Primera B" em pesquisas
  anteriores foi renomeada — a página da Wikipédia ES está em
  "Liga de Ascenso de Chile 2026" (redirecionada a partir de "Primera B
  de Chile 2026"), e o texto do artigo confirma "Liga de Ascenso 2026"
  como nome vigente. Usado esse nome em `nome` do JSON.
- **Fonte**: fetch direto do HTML da Wikipédia ES (tabela "Información"
  com técnico/estádio/capacidade por clube, e texto de "Sistema de
  competición"/"Relevos"/"Play-Offs") — evitei resumo por IA depois que
  rodadas anteriores (Argentina, Bolívia) tiveram erro de raspagem
  nessa abordagem.
- **Elenco 2026: 16 de 16 clubes confirmados**, batendo exatamente com
  os 16 já adicionados numa tentativa anterior que falhou por rate limit
  antes de commitar — conferido clube a clube contra a tabela oficial,
  nenhuma correção necessária. A seção "Relevos" explica por que dois
  nomes que aparecem como links na página (Universidad de Concepción,
  Deportes Concepción) NÃO estão nos 16: subiram para a Liga de Primera
  2026 (já corretamente cadastrados em `chile_primera.json`); e por que
  "Santiago Morning" também aparece mencionado sem estar nos 16: desceu
  da Liga de Ascenso para a Segunda División Profesional (3ª nível, não
  modelada) depois de 2025.
- **Formato real 2026, alta confiança** (texto do regulamento na própria
  Wikipédia): 30 rodadas, turno e returno (`pontos_corridos`). O campeão
  (1º colocado) sobe direto à Liga de Primera 2027. A 2ª vaga de acesso
  vai a uma "liguilla" de ida e volta entre 2º-8º colocados: 3º-8º jogam
  quartas de final (3x8, 4x7, 5x6), o 2º colocado entra direto na
  semifinal (bye), e o vencedor da final leva a 2ª vaga — modelado como
  `mata_mata.fases: ["quartas_liguilla", "semifinal_liguilla",
  "final_liguilla"]`, `ida_e_volta: true`; o bye do 2º colocado não é
  representável no schema atual (mesma classe de aproximação já usada no
  "Reduzido" argentino) — documentado aqui, não modelado em `etapas`
  porque os confrontos dependem da posição final (o campeonato 2026 real
  ainda está em andamento, 22 de 30 rodadas jogadas até 31/08/2026 — não
  dá pra cravar quem ocupa cada posição ainda).
- **Rebaixamento**: 1 clube desce à Segunda División Profesional (3ª
  nível, não modelada) — `rebaixamento_proxima_divisao: 1`.

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

## Expansão CONMEBOL — Bolívia (1ª divisão)

- **Fonte**: Wikipédia ES ("Primera División de Bolivia 2026"), cruzada
  com busca agregada sobre os cupos continentais de 2026 (que descreve o
  mesmo padrão de critério, ainda que aplicado à temporada 2025→
  Libertadores/Sul-Americana 2026 — usado só pra confirmar o formato do
  critério, não os clubes específicos daquele ano).
- **Correção de formato**: ao contrário do que a modelagem inicial
  assumia, a Bolívia **não** usa Apertura/Clausura em 2026 — é um único
  torneio de pontos corridos, todos-contra-todos, ida e volta (30
  rodadas com 16 times). O bloco `pontos_corridos` já estava certo na
  estrutura, só a contagem de rodadas estava errada (26 em vez de 30) —
  corrigida.
- **Elenco confirmado**: os 16 clubes já cadastrados batem exatamente com
  a fonte, incluindo o retorno do Real Potosí ao profissionalismo após 4
  temporadas fora. Vaga de acesso à elite veio do campeão da Copa Simón
  Bolívar 2025 (2ª divisão).
- **Rebaixamento**: 1 clube desce por temporada, mas por **tabela
  acumulada/histórica plurianual** (sistema de médias, como Argentina e
  Uruguai), não simples último colocado da temporada corrente — mecanismo
  exato (quantos anos entram na média) não foi encontrado com precisão;
  `rebaixamento_proxima_divisao: 1` reflete só o número, não o critério.
- **Vagas CONMEBOL bem confirmadas**: 4 de Libertadores (campeão, vice,
  campeão da Copa Bolívia, 3º colocado da tabela) e 4 de Sul-Americana
  (vice da Copa Bolívia, 4º, 5º e 6º colocados da tabela).
- **Clássicos**: Superclásico Paceño (Bolívar x The Strongest) já estava
  cadastrado; adicionado o Clásico Cruceño (Oriente Petrolero x Blooming,
  rivalidade de Santa Cruz de la Sierra desde 1970), bem confirmado por
  múltiplas fontes de imprensa esportiva boliviana.

## 2ª divisão CONMEBOL — Bolívia (Copa Simón Bolívar)

- **Fonte**: Wikipédia ES "Copa Simón Bolívar 2026 (Bolivia)" — a edição já
  está em andamento no mundo real (fase departamental e fase de grupos
  nacional já disputadas), com tabelas de resultado real por grupo. A
  primeira tentativa de extrair o conteúdo via fetch resumido por IA
  pareceu suspeita (times com nomes coincidindo com clubes famosos de
  outros países, ex: "F.C. Juan Aurich", que também é o nome de um clube
  peruano famoso) — **verificado por raw HTML da própria Wikipédia que o
  nome é real**, é um clube boliviano pequeno de Potosí distinto, mera
  coincidência de nome. Fica registrado como lição: desconfiar de nomes
  "importados" de outro país mesmo quando o fetch resumido parece
  plausível, e confirmar contra o HTML bruto quando suspeitar.
- **Formato real**: 3 fases — (1) fase departamental/preliminar, times
  agrupados por associação (9 associações: Beni, Chuquisaca, Cochabamba,
  La Paz, Oruro, Pando, Potosí, Santa Cruz, Tarija), turno e returno,
  melhores de cada série avançam; (2) fase de grupos nacional, 24
  classificados em 6 grupos de 4 (turno e returno), 2 melhores de cada
  grupo + os 4 melhores terceiros avançam às oitavas; (3) mata-mata
  (oitavas, quartas, semifinal, final) em ida e volta — formato exato da
  final (jogo único ou ida e volta) não confirmado.
- **Elenco modelado — só o corpo principal (24 clubes)**: a fonte cita
  "69 clubes" no resumo mas depois "72 equipos" na seção "Clubes
  clasificados" (inconsistência da própria fonte, não nossa) — a fase
  departamental/preliminar completa (todos os ~69-72 clubes) **não foi
  modelada**, só os **24 clubes confirmados na fase de grupos nacional**
  (extraídos das tabelas reais de resultado, alta confiança). `times[]`
  de `bolivia_segunda.json` reflete só esses 24; a fase preliminar fica
  como pendência (mesmo padrão de simplificação já aplicado à Copa do
  Brasil/Libertadores/Sul-Americana antes de termos `etapas` — aqui nem
  chegamos a criar `etapas`, o "corpo principal" é a fase de grupos, não
  o mata-mata, então a estrutura é diferente).
- **Cidade de vários clubes por aproximação**: o schema exige `cidade`
  obrigatória, mas a fonte só confirma o departamento pra vários clubes
  (ex: `ingenieros_bo`, `veintiseis_de_febrero`, `hiska_nacional` — só
  "La Paz" o departamento, não a cidade/bairro exata) — usei a capital do
  departamento como aproximação razoável em ~10 dos 24 clubes; confiança
  moderada, não alta, nesses casos.
- **Acesso à 1ª divisão**: confirmado por duas fontes — o campeão sobe
  direto; o vice disputa um **playoff de ida e volta contra o
  penúltimo colocado da Divisão Profissional** da mesma temporada
  (mecanismo de promoção/rebaixamento cruzado entre divisões que o
  schema não representa — só `premiacao.acesso_proxima_divisao: 1`
  reflete o acesso direto do campeão, o playoff do vice fica documentado
  aqui sem campo correspondente).
- **Rebaixamento**: não modelado — não pesquisado nesta rodada (a 2ª
  divisão não desce pra lugar nenhum que estejamos modelando).

## Expansão CONMEBOL — Equador (1ª divisão)

- **Fonte**: Wikipédia ES ("Serie A de Ecuador 2026"), cruzada com Cancha
  Ecuador ("LigaPro cambia su formato para 2026...") e Primicias
  (cobertura da reta final da temporada, incluindo os hexagonais de
  título/rebaixamento já definidos, já que a temporada 2026 real está em
  andamento/perto do fim na data de hoje).
- **Formato real, mais complexo que o já modelado**: Fase Inicial de
  pontos corridos, turno e returno (30 rodadas, 16 times) — isso já
  estava certo na modelagem anterior. O que faltava: depois da Fase
  Inicial, os 16 times se dividem por faixa de classificação em **3
  grupos de turno único** com propósitos diferentes — hexagonal do
  título (1º-6º), quadrangular internacional (7º-10º, disputa vaga extra
  de Sul-Americana) e hexagonal de rebaixamento (11º-16º, define os 2
  descensos). O schema não tem um bloco pra "3 grupos de tamanhos e
  propósitos diferentes alimentados pela faixa de classificação da fase
  anterior" — aproximei descrevendo tudo em texto livre no campo
  `final_estadual.criterio` (reaproveitando o bloco, que não é literalmente
  uma final), sem representar estruturalmente os 3 grupos nem o número
  exato de jogos de cada um.
- **Rebaixamento**: 2 clubes descem (últimos 2 colocados do hexagonal de
  rebaixamento) — confirmado por duas fontes independentes.
- **Vagas CONMEBOL — parcialmente confirmadas, com uma contradição entre
  fontes que não foi possível resolver com confiança total**: Libertadores
  2027 tem 4 vagas do Equador, sendo 3 diretas do campeonato (campeão,
  vice, 3º colocado do hexagonal do título) e a 4ª vinda da Copa Equador
  (competição separada, não modelada neste arquivo). Sul-Americana 2027
  também tem 4 vagas — aqui uma fonte (resumo de busca) e outra (fetch
  direto da Wikipédia) descreveram os critérios de forma contraditória,
  ambas dizendo que os "3 primeiros do hexagonal do título" também
  definem as vagas de Sul-Americana, o que duplicaria as posições já
  usadas pra Libertadores. **Modelei por inferência** (pra evitar a
  sobreposição, que não faz sentido esportivo) que a Sul-Americana pega o
  4º, 5º e 6º colocado do hexagonal do título mais o 1º colocado do
  quadrangular internacional — mas isso é uma suposição de boa fé pra
  resolver a contradição das fontes, não uma confirmação direta. Vale
  reconfirmar contra o regulamento oficial da FEF/CONMEBOL antes de
  considerar definitivo (`vaga_sulamericana_criterio` documenta essa
  incerteza no próprio JSON).
- **El Nacional**: confirmado que foi **rebaixado para a Serie B 2026**
  por sanção administrativa da FEF (dívidas/descumprimento financeiro,
  perda de 6 pontos), a segunda vez em 5 anos — por isso o clube já
  estava corretamente fora de `times[]` de `equador_primera.json` mesmo
  antes desta rodada (a inconsistência identificada era só um alerta pra
  conferir, não um erro real). Ele continua cadastrado em
  `src/data/clubes/equador.json` sem `divisao_nacional`, já que a Serie B
  do Equador não é modelada neste projeto — mantido assim.
- **Clássicos**: mantidos os 2 já cadastrados (Clásico del Astillero,
  Superclásico de Quito); não adicionei um terceiro por falta de fonte
  boa o suficiente dentro do tempo desta pesquisa.

## Expansão CONMEBOL — Paraguai (1ª divisão)

- **Fonte**: busca cruzada com Wikipédia ES/EN ("Primera División de
  Paraguay", "2026 Copa de Primera"), APF (site oficial, páginas dos
  torneos Apertura/Clausura) e ABC Color (fetch direto de matéria sobre
  a definição das vagas de Libertadores 2026).
- **Formato**: a modelagem anterior (Apertura + Clausura, 12 times, 11
  rodadas cada, turno único — `classificam_proxima_fase: 0` nos dois —
  mais `tabela_acumulada` somando os pontos dos dois torneios) já estava
  correta e foi confirmada por fonte — não há playoff interno em nenhum
  dos dois torneios, o campeão de cada um é só quem termina em 1º na
  tabela daquele torneio. Não precisou de bloco `mata_mata`/`final_estadual`
  adicional.
- **Rebaixamento**: 2 clubes, pela tabela de médias de pontos das **3
  últimas temporadas** (não só a atual) — confirmado por fonte, batendo
  exatamente com o texto que já estava em `tabela_acumulada.criterio`.
- **Vagas CONMEBOL**: Libertadores tem 4 vagas — campeão do Apertura +
  campeão do Clausura + campeão da Copa Paraguay (competição separada,
  não modelada neste arquivo) + melhor posição restante na tabela
  acumulada anual ainda não classificada. Sul-Americana tem 4 vagas — os
  4 melhores da tabela acumulada anual ainda não classificados pra
  Libertadores. Ambos os critérios bem confirmados por fonte específica
  (matéria da ABC Color detalhando exatamente como os 4 classificados de
  2026 se encaixaram em cada critério).
- **General Caballero JLM**: confirmado que foi **rebaixado à División
  Intermedia ao fim de 2025** (11º de 12 na tabela de médias) — por isso
  já estava corretamente fora de `times[]` (a inconsistência identificada
  era só um alerta pra conferir, não um erro real). Caso real e específico
  interessante: o clube tinha vencido a Copa Paraguay 2025, o que
  normalmente lhe daria uma vaga de Libertadores 2026 — mas por estar
  rebaixado, a vaga passou pro vice-campeão da copa (2 de Mayo), que por
  isso está entre os 4 clubes paraguaios na Libertadores 2026 apesar de
  não ter vencido nada na liga. Ele segue cadastrado em
  `src/data/clubes/paraguai.json` sem `divisao_nacional` (a División
  Intermedia não é modelada neste projeto) — mantido assim.
- **Clássicos**: mantido o Superclásico Paraguayo (Cerro Porteño x
  Olimpia); adicionado o Clásico del Barrio Obrero (Cerro Porteño x
  Nacional, os dois clubes mais tradicionais do bairro Barrio Obrero em
  Assunção) — confirmado por múltiplas fontes de imprensa paraguaia
  (ADN Digital, Agencia IP, Versus/VS Sports) cobrindo a edição real de
  2026. Cuidado: a pesquisa inicial chegou a supor "Libertad x Nacional"
  pra esse clássico, o que é **errado** — foi corrigido antes de gravar.

## Expansão CONMEBOL — Peru (1ª divisão) — auditoria de modelagem prévia

Diferente de Bolívia/Equador/Paraguai (primeira modelagem completa), o Peru já
tinha um `formato` razoável de uma correção anterior ("fix: model Peru 2026
league format") — esta rodada foi auditoria (conferir o que já existia) mais
preenchimento do que faltava (`premiacao` estava vazia), não reconstrução do
zero.

- **Formato**: a base já estava certa (Apertura + Clausura, 18 clubes, 17
  rodadas cada). Precisou correção o `final_estadual`: a Liguilla final tem
  **4 times** — os campeões do Apertura e do Clausura (só se também
  estiverem entre os 7 primeiros da tabela acumulada) + os 2 melhores da
  tabela acumulada geral. Caso especial confirmado: se o mesmo clube vencer
  Apertura e Clausura, ele é **campeão direto, sem disputar a Liguilla**.
  Fonte: América TV e Depor (formato oficial 2026). Se semifinal/final da
  Liguilla são jogo único ou ida e volta **não foi especificado em nenhuma
  fonte encontrada** — mantido `ida_e_volta: true` como estava antes, sem
  confirmação real; fica como pendência.
- **Rebaixamento**: **2 clubes** (17º e 18º da tabela acumulada), confirmado
  pela Wikipédia ES da edição 2026 — sem sistema de médias plurianuais,
  diferente de Bolívia/Argentina/Uruguai. Uma busca anterior sugeria "3
  descensos", mas essa era uma referência à transição 2025→2026 (de 19 pra
  18 clubes), não à regra vigente em 2026 — descartada em favor da fonte
  mais específica.
- **Vagas CONMEBOL**: 4 de Libertadores (Peru 1 = campeão da Liguilla
  nacional; Peru 2/3/4 definidos por uma repescagem entre 2º, 3º e 4º
  colocados da tabela acumulada — mecanismo de mata-mata entre esses 3
  times não é representado em detalhe no schema, só o total e o critério
  geral em texto livre) e 2 de Sul-Americana (7º e 8º colocados da tabela
  acumulada, entre os que ainda não se classificaram para a Libertadores) —
  fonte: RPP e Infobae. Nota: essas mesmas fontes mencionam Melgar,
  Garcilaso, Alianza Atlético e Cienciano já qualificados pra Sul-Americana
  2026 por outra via (resultado da temporada 2025, mesmo descompasso de
  temporada já documentado pra Série D/Copa do Brasil) — isso não faz parte
  do mecanismo de vagas da Liga 1 2026 em si, por isso não entrou em
  `premiacao`.
- **Elenco**: os 18 clubes já cadastrados foram conferidos contra a
  Wikipédia ES da edição 2026 e batem exatamente (incluindo `sport_huancayo`,
  que uma extração de página malfeita chegou a duplicar "Comerciantes
  Unidos" no lugar dele — confirmado como erro de raspagem, não um clube
  a menos). Nenhuma mudança em `times[]` ou em `src/data/clubes/peru.json`.
- **Clássicos**: adicionado o "Clásico del Sur" (Cienciano x Melgar,
  peso_midia 3) — rivalidade bem documentada entre os dois clubes mais
  tradicionais fora de Lima, com cruzamentos até internacionais (Copa
  Sul-Americana 2022 e 2026). Mantidos os 2 clássicos de Lima já existentes.

## Expansão CONMEBOL — Venezuela (1ª divisão) — auditoria de modelagem prévia

Diferente de Bolívia/Equador/Paraguai, a Venezuela já tinha sido marcada como
"corrigida" numa rodada anterior ("fix: model Venezuela 2026 league format"),
com `formato` detalhado e `premiacao` já preenchida — mas, como nos outros
países auditados (mesmo os "já corrigidos"), a conferência contra fonte
primária achou pelo menos um erro real, não só detalhes faltando.

- **Formato**: a estrutura de blocos já modelada estava correta e não
  precisou de mudança estrutural — confirmado por múltiplas fontes
  independentes (Wikipédia ES da edição 2026, e ao menos 5 portais
  esportivos venezuelanos — Balonazos, Líder en Deportes, Sports Venezuela,
  Pasión x el Deporte, Noticia al Día — descrevendo o mesmo formato pro
  sorteio dos cuadrangulares 2026). 14 clubes, Apertura e Clausura idênticos:
  fase 1 de 13 rodadas todos-contra-todos (`turno`/`returno`,
  `classificam_proxima_fase: 8`), top 8 avançam a 2 cuadrangulares de 4
  times cada, ida e volta (`fase_grupos`), os 2 vencedores de cuadrangular
  disputam a final do torneio corto em jogo único (`mata_mata`). Os
  campeões do Apertura e do Clausura disputam depois a "Final Absoluta" em
  jogo único (`final_estadual`) — **exceto se o mesmo clube vencer os dois
  torneios, caso em que é proclamado Campeão Absoluto automaticamente sem
  jogar a final** (nuance agora registrada no texto de `final_estadual`).
- **Vagas CONMEBOL — erro real corrigido**: a modelagem anterior tinha só
  **2 vagas de Libertadores e 2 de Sul-Americana** (4 no total); a fonte
  primária (Wikipédia ES, seção "Formato" da edição 2026, texto direto da
  Assembleia Geral da Liga FUTVE) deixa claro que são **4 de Libertadores
  e 4 de Sul-Americana** (8 no total, bastante pras 14 vagas da liga) —
  `premiacao` estava subestimada pela metade. Critério exato: Libertadores
  = campeão + vice da "Liga FUTVE" (a Final Absoluta entre campeões do
  Apertura/Clausura) + os 2 melhores da tabela acumulada; o campeão vai
  direto à fase de grupos da Libertadores, o vice entra na fase 2 (detalhe
  de fase de entrada guardado no texto do critério, schema não modela fase
  de entrada — mesmo padrão já usado pra Copa do Brasil). Sul-Americana =
  vice-campeão do Apertura + vice-campeão do Clausura (perdedores da final
  de cada cuadrangular, diferente do "vice da Liga FUTVE" usado na
  Libertadores) + 3º e 4º melhores da tabela acumulada ainda não
  classificados pra Libertadores.
- **Rebaixamento**: confirmado **1 clube** (último da tabela acumulada,
  soma dos resultados da fase 1 de cada torneio corto) — já estava correto
  na modelagem anterior, agora preenchido explicitamente em
  `premiacao.rebaixamento_proxima_divisao` (campo ausente antes, apesar do
  texto de `tabela_acumulada.criterio` já mencionar rebaixamento).
- **Elenco**: os 14 clubes já cadastrados batem exatamente com a Wikipédia
  ES 2026 (confere inclusive a movimentação real: Trujillanos subiu como
  campeão da Segunda División 2025 no lugar do Yaracuyanos, rebaixado —
  Trujillanos já estava certo em `times[]`). Nenhuma mudança.
- **Clássicos**: mantido o Clásico del Fútbol Venezolano (Caracas FC x
  Deportivo Táchira); adicionado o "Clásico Añejo" (Portuguesa FC x
  Estudiantes de Mérida, peso_midia 3) — um dos clássicos mais antigos do
  país, iniciado em 1972, confirmado pela página dedicada da Wikipédia
  "Rivalidades de fútbol en Venezuela". Não adicionado o Clásico Andino
  (Estudiantes de Mérida x Deportivo Táchira, 1975) nem os Derbis da
  Capital (Caracas/La Guaira/Metropolitanos/UCV) por já ter 2 clássicos
  bem confirmados e não forçar mais do que o pedido.

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
