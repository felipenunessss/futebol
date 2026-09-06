# Dados a verificar

Rastreamento das pendências de qualidade de dados **ainda abertas**. Critério
aplicado: só entra na base um clube/fato confirmado por pelo menos uma fonte
razoável; qualquer coisa duvidosa fica de fora dos arquivos de dados e
listada aqui até ser resolvida. Itens já resolvidos/confirmados foram
removidos deste arquivo (histórico completo no `git log` de cada arquivo de
dado, se precisar recuperar o raciocínio).

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
- **Vagas de Libertadores/Sul-Americana da Série A (Brasil)**: não
  modeladas — o número varia ano a ano pelo ranking CBF, não é posição fixa
  simples, e isso não foi apurado com precisão ainda.
- **Rebaixamento da Série B (Brasil)**: mantido `4` por padrão histórico
  conhecido, mas não reconfirmado especificamente pra 2026.
- **Copa do Brasil — 3 estaduais sem pesquisa dedicada de vaga_serie_d**
  (`paulistao_a1`, `candangao_1`, `capixaba_1`): usam a regra padrão (1
  vaga, melhor colocado sem competição nacional) em vez de critério
  pesquisado — vale revisar, especialmente São Paulo, que provavelmente tem
  mais de 1 vaga por ser estado grande.
- **Peru (1ª divisão)**: se a semifinal/final da Liguilla de acesso são jogo
  único ou ida e volta não foi especificado em nenhuma fonte encontrada —
  mantido `ida_e_volta: true` sem confirmação real.
- **Paraguai (2ª divisão, División Intermedia)**: a tabela anota "Ascienden
  a Primera División" no plural ao lado do 1º colocado, sugerindo mais de um
  acesso, mas não achamos confirmação explícita de que o 2º sobe direto ou
  se há repechaje — modelado como aproximação (`acesso_proxima_divisao: 2`).
- **Copas regionais (Nordeste, Verde, Sul-Sudeste)**: campeão vs. vice não
  distinguido na maioria das vagas (exceto MG/PR/SC na Copa Sul-Sudeste);
  formato da Copa do Nordeste após a fase de grupos pareados (mata-mata?
  outra fase de grupos?) não confirmado; se as 3 copas dão vaga direta de
  Sul-Americana/Libertadores ao campeão (além da vaga já confirmada na Copa
  do Brasil) não é 100% certo.
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
- **Paranaense**: "Torneio da Morte" (grupo de 4 à parte da fase principal)
  não representado, só o resultado final (2 rebaixados).
- **Catarinense**: rebaixamento real é um quadrangular especial com bônus de
  1 ponto pro 5º colocado de uma das chaves — não representado.
- **Cearense**: 2ª fase de reclassificação (top 3 de cada grupo formam
  novos grupos) simplificada pra `fase_grupos` direto a `mata_mata`.
- **Goiano**: playoff condicional 10º×11º (só se diferença de pontos ≤ 6)
  não representado, só `rebaixamento_proxima_divisao: 2`.
- **Argentina 1ª divisão**: zonas internas de cada torneio (Apertura/
  Clausura) e tamanho exato do chaveamento de playoff não modelados
  (`classificam_proxima_fase: 16` é estimativa).
- **Argentina 2ª divisão**: chaveamento exato dos 15 times do "Reduzido"
  não fechado (torneio real ainda em andamento).
- ~~Uruguai 1ª divisão: schema não amarra explicitamente qual fase
  alimenta qual etapa do mata-mata final~~ **resolvida** (confirmado via
  Wikipedia/AUF): "Torneo Intermedio" é uma competição À PARTE, só de vaga
  internacional, sem relação com o título — removido do formato (não
  modelado, ver `simulation/engine.ts` `receitaUruguaiPrimeira`). O título
  ("Campeón Uruguayo") é: campeão automático se o mesmo clube vencer
  Apertura e Clausura; senão, semifinal entre os 2 campeões de torneio; se
  o líder da Tabla Anual (soma Apertura+Clausura) for um dos 2
  semifinalistas, quem vencer a semifinal já é campeão; senão, o vencedor
  ainda enfrenta o líder numa final. Fonte: [Campeonato Uruguayo de
  Primera División 2025 (Wikipedia)](https://es.wikipedia.org/wiki/Campeonato_Uruguayo_de_Primera_Divisi%C3%B3n_2025).
- ~~Uruguai 2ª divisão: não representa como o Torneo Competencia se soma
  à fase regular, nem a condicional "vaga garantida"~~ **parcialmente
  resolvida**: confirmado que o campeão da divisão é sempre o líder da
  fase regular (`pontos_corridos`), não do Torneo Competencia — este roda
  à parte (`receitaUruguaiSegunda`). A condicional exata do playoff pelo
  3º acesso (só inclui o campeão do Torneo Competencia se ele não estiver
  já em zona de acesso direto nem de descenso) continua **não
  representada** — a receita usa sempre as posições 3ª-6ª da tabela
  regular, sem essa condicional (não afeta quem é campeão, só o detalhe
  de quem disputa a vaga extra). Fonte: [Campeonato Uruguayo de Segunda
  División 2025 (Wikipedia)](https://es.wikipedia.org/wiki/Campeonato_Uruguayo_de_Segunda_Divisi%C3%B3n_2025).
- **Colômbia 1ª divisão**: em 2026 o Apertura usa playoff direto e o
  Finalización usa cuadrangulares — modelados de forma uniforme
  (`fase_quadrangular`), perdendo a diferença. (Pendente confirmar com
  fonte oficial — pesquisa anterior travou num limite de sessão antes de
  concluir.)
- **Colômbia 2ª divisão**: acesso condicional (2 campeões semestrais sobem
  direto só se estiverem nas 2 primeiras posições da tabela anual, senão
  repechaje) não representado.
- **Chile 2ª divisão**: bye do 2º colocado na liguilla de acesso (só
  3º-8º jogam quartas) não representável.
- ~~Equador 1ª e 2ª divisão: sem bloco pra "grupos de tamanhos/propósitos
  diferentes por classificação"~~ **resolvida**: novo bloco de schema
  `FaseFinalPorClassificacao` (`schemas/championship.ts`) — grupos em
  ordem (do melhor colocado ao pior), com `pontos_carregados` opcional
  (soma os pontos da fase anterior em vez de zerar). **Achado
  adicional**: o dado antigo de `equador_segunda` (2 grupos de 6 desde o
  início) não batia com o formato real 2025 — corrigido pra
  `pontos_corridos` único de 12 times (22 rodadas) seguido de 2
  hexagonais (ascenso 1º-6º, descenso 7º-12º) por classificação, pontos
  carregados. `equador_primera`: 3 grupos por classificação (hexagonal do
  título 1º-6º, quadrangular internacional 7º-10º, hexagonal de
  rebaixamento 11º-16º), pontos carregados. Fontes: [¿Cómo se jugará la
  LigaPro 2025?](https://www.primicias.ec/deportes/nuevo-formato-sistema-campeonato-ligapro2025-85954/),
  [2025 LigaPro Serie A (Wikipedia)](https://en.wikipedia.org/wiki/2025_LigaPro_Serie_A),
  [¿Cómo será la Serie B de Ecuador de 2025?](https://www.primicias.ec/deportes/serie-b-ecuador-equipos-formato-ascenso-descenso-clubes-calendario-partidos-91404/),
  [2025 Ecuadorian Serie B (Wikipedia)](https://en.wikipedia.org/wiki/2025_Ecuadorian_Serie_B).
- ~~Venezuela 1ª/2ª divisão: estrutura em 2 níveis não confirmada~~
  **resolvida**: confirmado (Wikipedia/El Universal) que cada torneio
  (Apertura/Clausura) tem sua própria mini-competição interna — os
  classificados do turno/returno entram numa `fase_grupos` própria
  daquele torneio (cuadrangulares), que alimenta um `mata_mata` que
  decide o "campeão daquele torneio"; só depois os 2 campeões de torneio
  se enfrentam no `final_estadual` da temporada (mesmo clube campeão dos
  dois = campeão automático). Ver `simulation/engine.ts`
  `receitaTurnoRetornoComGrupoEMataMataEFinal`. **Bug de dado corrigido**:
  `venezuela_primera.json` tinha `final_estadual.ida_e_volta: false`,
  deveria ser `true` (final 2025 foi ida e volta, UCV 3-1 sobre Carabobo
  no agregado). Pra Venezuela 2ª divisão especificamente, os grupos reais
  continuam assimétricos (8 Oriental + 9 Occidental, aqui modelado como
  2×8 por aproximação) e não foi possível confirmar se a Final Absoluta é
  jogo único ou ida e volta (mantido ida e volta, plausível mas não
  confirmado) — a última fase do `mata_mata` (`quartas`/`semifinal`/
  jogo único na final) também precisaria de `etapas` com `ida_e_volta`
  por etapa em vez do campo único atual, não fizemos essa correção ainda.
  Fontes: [Primera División de Venezuela 2025](https://es.wikipedia.org/wiki/Primera_Divisi%C3%B3n_de_Venezuela_2025),
  [UCV FC campeón Liga FUTVE 2025 (El Universal)](https://www.eluniversal.com/deportes/221884/ucv-fc-se-consagra-como-campeon-la-liga-futve-2025),
  [Segunda División de Venezuela 2025](https://es.wikipedia.org/wiki/Segunda_Divisi%C3%B3n_de_Venezuela_2025).
- **Peru 2ª divisão (Liga 2)**: a mais elaborada de todas — 2 grupos
  regionais de 9 → 3 "Grupos Campeonato" de 4 com pontos de bônus
  carregados → playoffs de 3 etapas. Modelado só o corpo principal (2
  grupos de 9) + mata-mata genérico como placeholder.
- **Copa Sul-Americana**: só o 1º colocado de cada grupo avança direto às
  oitavas, o 2º vai pra repescagem — modelado como `classificam_por_grupo: 2`
  uniforme, perdendo a distinção das duas rotas. **Achado adicional ao
  tentar implementar a receita de simulação** (`simulation/engine.ts`
  `receitaFaseGruposComPreClassificatorioEMataMata`): a contagem de times
  do `mata_mata.etapas` ("primeira_fase" 32 entrantes + "repescagem" 8
  entrantes) somada aos 16 diretos (times que não aparecem em nenhum
  `entrantes`) não fecha em NENHUM ponto com o tamanho esperado da fase de
  grupos (32, = 8 grupos × 4) — testado em todo corte possível entre as
  etapas, incluindo antes/depois da repescagem se juntar aos classificados
  da fase de grupos. A Libertadores (mesmo formato de blocos, `etapas`
  igualmente detalhado) fecha exatamente (28 diretos + 4 sobreviventes do
  pré-classificatório = 32) — então o problema não é o motor, é a
  contagem/nomeação das etapas da Sul-Americana especificamente: possível
  que "repescagem" dependa de um mecanismo cross-competição (times
  eliminados da fase preliminar da Libertadores caindo pra Sul-Americana,
  não modelado — o motor só enxerga o `times[]` de uma competição por
  vez) que os dados atuais não capturam. Por ora a Sul-Americana continua
  sem simulação automática (erro claro, não crash da temporada).

## Clássicos não pesquisados (baixa prioridade — só imersão)

PE, RN, PB, AL, PI, AM, TO, RO, AC, RR, AP: nenhum clássico
pesquisado/confirmado por falta de fonte do nome oficial da rivalidade
(exceção: Re-Pa do Pará, já adicionado). Argentina: só os 2 mais óbvios
(Superclásico, Avellaneda) — existem vários outros clássicos regionais não
pesquisados. Equador: mantidos só os 2 já existentes, sem 3º por falta de
fonte boa o suficiente.

## Como resolver

Cada item acima deveria ser confirmado contra a fonte primária (site da
federação de cada país/estado) antes de ser promovido de "a verificar" para
os arquivos de dados definitivos. Itens na seção de arquitetura de schema
exigem decisão de design antes de qualquer pesquisa adicional.
