# Dados a verificar

Rastreamento das pendências de qualidade de dados **ainda abertas**. Critério
aplicado: só entra na base um clube/fato confirmado por pelo menos uma fonte
razoável; qualquer coisa duvidosa fica de fora dos arquivos de dados e
listada aqui até ser resolvida. Itens já resolvidos/confirmados foram
removidos deste arquivo (histórico completo no `git log` de cada arquivo de
dado e deste próprio arquivo, se precisar recuperar o raciocínio).

## Divisões não modeladas / listas incompletas

- **Campeonato Carioca — Série B1, B2 e C** (3ª-5ª divisões do RJ): não
  modeladas — B1 sem lista oficial completa 2025 encontrada; B2 só achamos
  lista de 2026 (ano errado) e não sabemos quais 9 dos 12 clubes originais
  seguem na disputa; C (Taça Waldir Amaral, 13 clubes) sem lista de clubes
  encontrada. Não há evidência de uma "Série D" carioca ativa.
- **Capixaba 1ª divisão**: 9 dos 10 times reais — 1 clube excluído por
  `cidade` não confirmada com segurança.
- **Estádio ausente** em vários clubes (não afeta simulação, só imersão):
  maioria dos clubes novos de `sp_estadual.json`/`rj_estadual.json`;
  Itabirito FC e Sport Club Aymorés (MG, nomes de estádio conflitantes entre
  fontes); Coimbra EC (MG, manda jogos ora no Independência-BH ora em
  Contagem); Monsoon FC (RS, mudou de sede pra Capão da Canoa em 2026); 8
  clubes da Série A2 do RS (Apafut, Brasil-Farroupilha, Esportivo Bento
  Gonçalves, SC Gaúcho, Glória, Gramadense, Guarani-VA, União Frederiquense);
  ECPP, Fluminense de Feira, Redenção, SSA FC (BA, Série B); 6 clubes da
  Série A2 de PE (Águia de Cumaru, América-PE, Caruaru City, Ipojuca, Porto,
  Ypiranga-PE).
- **Copa do Brasil — 2ª fase (74 clubes)**: nenhuma fonte trouxe a lista
  nominal completa dessa fase — os 74 foram atribuídos por subtração
  matemática (as outras 4 fases já confirmadas nominalmente somam 52 dos
  126, e a contagem de 74 pra 2ª fase bate em 3 fontes independentes), sem
  confirmação individual de que cada um dos 74 específicos entra ali.
- **Paraense**: duas fontes divergem em 2 dos 12 clubes (uma citou "Caeté" e
  "Independente" em vez de "São Raimundo" e "Amazônia") — usamos a fonte que
  citava "Parazão 2026" explicitamente, mas vale checar contra o site
  oficial da FPF.

## Riscos de erro factual (não é só lacuna — pode estar errado)

- **Carlos Renaux x Brusque FC** (SC): o Brusque nasceu de fusão em 1987
  entre o antigo Carlos Renaux e o Paysandu de Brusque, mas a fonte da lista
  2026 trata os dois como clubes distintos e ativos — incluímos os dois por
  estarem confirmados como participantes separados, mas não investigamos a
  fundo como o Carlos Renaux voltou a existir separadamente.
- **Águilas Doradas** (Colômbia): fontes divergem entre Medellín e Rionegro
  como cidade-sede — usamos Rionegro (sede tradicional) por ser mais
  específico, vale confirmar.
- **Tombense** (MG): não foi possível confirmar em que competição nacional
  (se alguma) o clube está atualmente — ficou sem `divisao_nacional` e de
  fora dos arquivos de campeonato nacional, exceto na Série D e na Copa do
  Brasil (participação 2026 confirmada nessas duas, origem da vaga não).
- **Amapaense "Cristal"**: cidade inferida por contexto (rivalidade com o
  Oratório, também de Macapá), não confirmada explicitamente por fonte
  direta — confiança moderada, não alta.
- **Série D — vagas do Distrito Federal**: fontes citam "Metropolitano-DF"
  como origem das vagas de `gama`/`capital_cf`, não "Campeonato Brasiliense"
  (`candangao_1`, o que modelamos) — pode ser uma competição diferente
  (talvez de base/amadora). Por precaução, `candangao_1.premiacao` não
  recebeu `vaga_serie_d`.
- **Série D — `portuguesa` (SP) e `real_noroeste` (ES)**: participação 2026
  confirmada, mas não está claro se a vaga veio do respectivo estadual —
  não contam em `vaga_serie_d` de `paulistao_a1`/`capixaba_1`.
- **Argentina — 7ª vaga de Libertadores 2026**: o critério documentado
  (Apertura + Clausura + Copa Argentina + 3 melhores da Tabela Anual) só
  soma 6, mas os 7 clubes argentinos confirmados em `libertadores.json`
  mostram uma 7ª vaga real cujo mecanismo não foi reconfirmado por fonte
  específica.

## Vagas/premiação vazias ou não confirmadas

- **Mineiro Módulo I, RS Gauchão, Baiano A1**: vagas de Copa do
  Brasil/Libertadores não pesquisadas — `premiacao` só tem o rebaixamento.
- **Matogrossense**: número de rebaixados não encontrado em nenhuma fonte —
  `premiacao` vazio.
- **Acreano e Amapaense**: número de rebaixados não confirmado — `premiacao`
  vazio (Roraimense já está confirmado: 1 rebaixado).
- **Colômbia (1ª e 2ª divisão)**: rebaixamento não confirmado em nenhuma
  fonte consultada — `premiacao` sem `rebaixamento_proxima_divisao`.
- **Sergipano**: campeão e 3º colocado ganham vaga na Série D nacional
  2027 — fato real, mas o schema não tem campo pra "vaga em competição
  nacional a partir de estadual" fora do já existente `vaga_serie_d`
  (que é especificamente pra Série D do ano corrente).
- **Vagas de Libertadores/Sul-Americana da Série A (Brasil)**: modeladas
  como aproximação posicional (`vaga_libertadores: 7`, `vaga_sulamericana:
  7`) — o critério real varia ano a ano pelo ranking CBF, não é posição fixa
  simples, e isso não foi apurado com precisão ainda; os números escolhidos
  só batem com o TOTAL de clubes brasileiros na composição estática 2026 de
  Libertadores/Sul-Americana (8 e 7 respectivamente, contando a vaga da
  Copa do Brasil), pra `career/mundo-persistente.ts` `calcularMudancasContinentais`
  poder atualizar a fatia brasileira de verdade a partir da temporada 2 (ver
  `docs/regras-competicoes.md`) em vez de deixá-la sempre estática.
- **`vaga_libertadores` removida de Carioca A e Paulistão A1**: os dados
  tinham `vaga_libertadores: 1` em cada um, o que está incorreto pra era
  moderna do futebol brasileiro (bug relatado pelo usuário) — clubes se
  classificam pra Libertadores via Brasileirão/Copa do Brasil, não via
  campeonato estadual, desde que a CBF centralizou o critério (décadas
  atrás). Removido sem substituto (os dois estaduais continuam sem vaga
  continental nenhuma, correto).
- **Rebaixamento da Série B (Brasil)**: mantido `4` por padrão histórico
  conhecido, mas não reconfirmado especificamente pra 2026.
- **Série D `acesso_proxima_divisao`: 6 → 4** (bug relatado pelo usuário:
  "os semifinalistas deveriam subir pra série C e não funcionou"). O real
  critério de acesso da Série D é "os 4 semifinalistas sobem" (confiança
  boa, é regra estável e conhecida) — o `6` anterior não batia com isso
  (nem com nenhuma etapa nomeada do mata-mata: oitavas=8, quartas=4/
  semifinal=4/final=2, nenhuma dá 6) e bloqueava a implementação de
  `career/mundo-persistente.ts` (`semifinalistas.length` nunca ia bater com
  um `acesso` que não fosse 4). Corrigido pra `4`.
- **Série C `rebaixamento_proxima_divisao`: 2 → 4**: mudado pra CASAR
  exatamente com a promoção da Série D (4 semifinalistas) — sem isso, a
  Série D perderia 4 clubes/temporada pra cima sem receber os 4 de volta
  (só 2), quebrando a contagem de 96 times (16 grupos × 6) já na 2ª
  temporada simulada (erro de validação em `dividirEmGruposValidado`,
  bug crítico — travaria a Série D de vez pra aquela carreira). Confiança
  **moderada, não fonte-confirmada** — decisão tomada por necessidade de
  manter a simulação estável, não por pesquisa direta contra o critério
  real de 2026 da Série C (que pode legitimamente ser diferente de 4). Se
  alguém confirmar o número real, ajustar aqui — só lembrar que qualquer
  valor diferente de 4 volta a quebrar a simetria com a Série D enquanto
  `vaga_serie_d` (preenchimento por estaduais, ver
  `docs/regras-competicoes.md`) não estiver implementado como reposição
  alternativa.
- **Copa do Brasil — 3 estaduais sem pesquisa dedicada de vaga_serie_d**
  (`paulistao_a1`, `candangao_1`, `capixaba_1`): usam a regra padrão (1
  vaga, melhor colocado sem competição nacional) em vez de critério
  pesquisado — vale revisar, especialmente São Paulo, que provavelmente tem
  mais de 1 vaga por ser estado grande.
- **Paraguai (2ª divisão, División Intermedia)**: a tabela anota "Ascienden
  a Primera División" no plural ao lado do 1º colocado, sugerindo mais de um
  acesso, mas não achamos confirmação explícita de que o 2º sobe direto ou
  se há repechaje — modelado como aproximação (`acesso_proxima_divisao: 2`).
- **Copas regionais (Nordeste, Verde, Sul-Sudeste)**: campeão vs. vice não
  distinguido na maioria das vagas (exceto MG/PR/SC na Copa Sul-Sudeste);
  se as 3 copas dão vaga direta de Sul-Americana/Libertadores ao campeão
  (além da vaga já confirmada na Copa do Brasil) não é 100% certo. A Copa do
  Nordeste real (2025, confirmado via Olympics.com/CBF) usa 16 times em 2
  grupos de 8 com jogos DENTRO do próprio grupo, top 4 de cada grupo em
  cruzamento olímpico pras quartas (jogo único), semifinal (jogo único),
  final (ida e volta) — mas o dado atual do projeto modela `fase_suica` (4
  potes de 5 = 20 times), uma contagem/estrutura DIFERENTE da confirmada.
  Não sabemos se o formato mudou entre a edição modelada e 2025, ou se o
  dado atual já era uma aproximação — não implementamos a receita nem
  corrigimos o dado até reconfirmar a contagem exata de times/grupos da
  edição que o projeto pretende modelar. A estrutura pós-grupos (quartas/
  semi jogo único, final ida e volta) está bem confirmada e reaproveitável
  assim que a contagem for resolvida. A Copa Verde também muda de formato a
  partir de **2026** (vira uma "supercopa": 24 clubes em 2 blocos de 12 —
  Copa Norte e Copa Centro-Oeste —, cada bloco decidindo seu próprio
  campeão antes da final entre os 2, o que bate estruturalmente com
  `dupla_chave_regional` já modelado), mas o formato EXATO de cada bloco
  (quantas fases dentro dos 12 times) não foi confirmado. Fontes:
  [Olympics.com — Copa do Nordeste 2025 formato](https://www.olympics.com/pt/noticias/copa-do-nordeste-2025-formato-classificados-datas),
  [ecbahia — formato Nordestão 2025](https://www.ecbahia.com/nordestao/formato-da-copa-do-nordeste-2025),
  [CBF — Copa Verde em novo formato 2026](https://www.cbf.com.br/futebol-brasileiro/noticias/supercopa/sub20/copa-verde-em-novo-formato-tem-inicio-nesta-terca-24),
  [Band — Copa Verde/Supercopa](https://www.band.com.br/esportes/futebol/noticias/copa-verde-supercopa-copa-norte-copa-centro-oeste-202510011247).
- **Libertadores/Sul-Americana — premiação entre competições irmãs**: nenhum
  campo do schema cobre vaga direta na Copa Intercontinental FIFA/Recopa/
  Mundial de Clubes (campeão da Libertadores) nem a vaga do campeão da
  Sul-Americana na Libertadores seguinte — fica só documentado aqui.

## Formatos que o schema não representa bem (decisão de arquitetura)

Casos onde o mecanismo real da competição é mais complexo do que os blocos
de `FormatoEstadual` conseguem expressar hoje — modelados por aproximação,
resultado final bate mas o mecanismo intermediário não é representado:

- **Mineiro Módulo II**: classificação cruzada entre os 2 grupos (8 melhores
  no geral), não 4 de cada grupo.
- **Pernambucano A1**: 1º/2º do turno único avançam direto à semifinal, só
  3º-6º disputam quartas — perde-se a passagem direta. Além disso, a
  **fusão A1+A2 num campeonato de 31 clubes a partir de outubro/2026** ainda
  não foi modelada.
- **Gauchão**: Troféu Farroupilha (5º-8º colocados disputam um mini-torneio
  à parte, fora do mata-mata principal, por vaga na Copa do Brasil) não
  modelado.
- **Paranaense**: "Torneio da Morte" (grupo de 4 à parte da fase principal)
  não representado, só o resultado final (2 rebaixados).
- **Catarinense**: rebaixamento real é um quadrangular especial com bônus de
  1 ponto pro 5º colocado de uma das chaves — não representado.
- **Cearense**: 2ª fase de reclassificação (top 3 de cada grupo formam
  novos grupos) simplificada pra `fase_grupos` direto a `mata_mata` — **e essa
  simplificação está QUEBRADA hoje, não é só imprecisa**: `classificam_por_grupo: 3`
  em 2 grupos manda 6 times direto pro mata-mata `["semifinal", "final"]`,
  e a semifinal (6→3) sempre sobra um número ímpar de sobreviventes pra
  final — sem a fase de reclassificação real de verdade (que reduziria 6
  pra 4 antes do mata-mata), a competição não conclui (erro isolado,
  "não simulada" no resumo de temporada; confirmado com
  `criarCompeticoesIncrementaisDaTemporada` rodando a temporada inteira).
  Correção pendente: implementar a 2ª fase de reclassificação de verdade
  (precisa confirmar a fonte de como os "novos grupos" são formados a
  partir do top 3 de cada grupo original antes de codar).
- **Goiano**: playoff condicional 10º×11º (só se diferença de pontos ≤ 6)
  não representado, só `rebaixamento_proxima_divisao: 2`.
- **Argentina 1ª divisão**: zonas internas de cada torneio (Apertura/
  Clausura) e tamanho exato do chaveamento de playoff não modelados
  (`classificam_proxima_fase: 16` é estimativa).
- **Colômbia 2ª divisão**: acesso condicional (2 campeões semestrais sobem
  direto só se estiverem nas 2 primeiras posições da tabela anual, senão
  repechaje) não representado — a receita (mesma de Colômbia 1ª) resolve
  o campeão dos 2 semestres corretamente, mas não modela essa 2ª vaga de
  acesso condicional (contagem exata de participantes do repechaje não
  confirmada por fonte). Rebaixamento da própria 2ª divisão também não
  confirmado.
- **Chile 2ª divisão**: bye do 2º colocado na liguilla de acesso (só
  3º-8º jogam quartas) não representável.
- **Uruguai 2ª divisão**: condicional exata do playoff pelo 3º acesso (só
  inclui o campeão do Torneo Competencia se ele não estiver já em zona de
  acesso direto nem de descenso) não representada — a receita
  (`receitaUruguaiSegunda`) usa sempre as posições 3ª-6ª da tabela regular,
  sem essa condicional (não afeta quem é campeão, só o detalhe de quem
  disputa a vaga extra).
- **Venezuela 2ª divisão**: os grupos reais são assimétricos (8 Oriental +
  9 Occidental), aqui modelado como 2×8 por aproximação; não foi possível
  confirmar se a Final Absoluta é jogo único ou ida e volta (mantido ida e
  volta, plausível mas não confirmado); a última fase do `mata_mata`
  (quartas/semifinal/final) usa um único campo `ida_e_volta` pra todas as
  etapas quando precisaria de `ida_e_volta` por etapa — não implementado.
- **Peru 2ª divisão (Liga 2)**: a mais elaborada de todas — 2 grupos
  regionais de 9 → 3 "Grupos Campeonato" de 4 com pontos de bônus
  carregados → playoffs de 3 etapas. Modelado só o corpo principal (2
  grupos de 9) + mata-mata genérico como placeholder.

## Clássicos não pesquisados (baixa prioridade — só imersão)

PE, RN, PB, AL, PI, AM, TO, RO, AC, RR, AP: nenhum clássico
pesquisado/confirmado por falta de fonte do nome oficial da rivalidade
(exceção: Re-Pa do Pará, já adicionado). Argentina: só os 2 mais óbvios
(Superclásico, Avellaneda) — existem vários outros clássicos regionais não
pesquisados. Equador: mantidos só os 2 já existentes, sem 3º por falta de
fonte boa o suficiente.

## Escudos e cores de clube/competição (`escudo_url`/`cor_primaria`/`cor_secundaria`)

Populado por `scripts/buscar-escudos.ts` (API pública TheSportsDB) +
`scripts/buscar-escudos-wikipedia.ts` (imagem principal de artigo na
Wikipédia pt/es, pra quem o TheSportsDB não achou). Cobertura atual:
**641/678 clubes** e **42/62 competições** com escudo; cores (`cor_primaria`/
`cor_secundaria`) só vêm quando a fonte trazia essa informação junto — bem
mais raro que o escudo em si. Reexecutar os scripts é seguro (idempotente,
só atualiza o que a busca achar de novo — pula quem já tem `escudo_url` pra
não gastar requisição à toa, e busca de novo pelo nome completo do clube
quando o nome popular abreviado com sufixo de UF, ex: "Atlético-MG", não bate
com o cadastro do TheSportsDB). Os ~37 clubes ainda sem escudo são casos que
o TheSportsDB genuinamente não tem cadastrado (clubes pequenos/regionais),
mesmo tentando nome popular e nome completo.

**Risco aberto, não fechado no código**: um clube com apelido genérico (uma
ou duas palavras, sem cidade/estado no nome popular) pode "perder" pra um
clube homônimo mais famoso — a busca rankeia por relevância/notoriedade, e
nenhuma checagem automática detecta isso (o resultado batido É um clube de
futebol de verdade, só que o errado). Já foram feitas 2 rodadas de auditoria
manual (amostragem + busca dirigida por nomes de clubes famosos, depois uma
rodada extra dirigida especificamente a apelidos genéricos como "porto",
"vitória", "atlético", "internacional", "santos", "sport", "central",
"independente", "nacional") e todos os casos encontrados foram corrigidos
(`escudo_url` removido, junto com cor quando veio da mesma fonte errada),
mas não há garantia de cobertura 100% — a auditoria foi por amostragem +
busca dirigida, não verificação individual de cada um dos 641 clubes/42
competições (os ~80 clubes preenchidos na rodada mais recente, incluindo os
achados via nome completo, ainda não passaram por essa auditoria dirigida).
Se notar outro escudo claramente errado no jogo, documente aqui e remova só
esse registro específico (não precisa reverter o resto).

## Taças/troféus de competição (`taca_url`)

Populado por `scripts/buscar-tacas.ts` (mesma API pública TheSportsDB de
`buscar-escudos.ts`, mas endpoint diferente — `lookupleague.php?id=`, não
busca por nome). Cobertura atual: **só 3 competições** — Campeonato
Brasileiro Série A/B/D. O endpoint de busca por nome
(`search_all_leagues.php`) sob a chave de teste devolve uma amostra
pequena e fixa por país que não inclui a maioria das competições
conhecidas (Copa do Brasil, Série C, Libertadores, Sul-Americana, nenhum
estadual) — só dá pra confirmar um `idLeague` manualmente contra o
`strLeague` retornado, um por um. Os 3 ids usados (4351/4404/5079) foram
confirmados assim, batendo o nome. Sem confirmação, não dá pra advinhar o
id de uma competição (arriscaria pegar a taça errada) — fica como
pendência aberta, não implementada por enquanto. Se alguém achar o
`idLeague` certo de outra competição (por lookup manual ou outra fonte
confiável), adicionar em `ID_LEAGUE_POR_CAMPEONATO` e reexecutar o script
(idempotente). Competições sem `taca_url` mostram um ícone genérico de
troféu na sala de troféus (`web/src/features/temporada/TelaDeTemporada.tsx`
`TrofeuDaCompeticao`), nunca ficam "sem nada".

## Como resolver

Cada item acima deveria ser confirmado contra a fonte primária (site da
federação de cada país/estado) antes de ser promovido de "a verificar" para
os arquivos de dados definitivos. Itens na seção de arquitetura de schema
exigem decisão de design antes de qualquer pesquisa adicional.
