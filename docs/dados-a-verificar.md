# Dados a verificar

Rastreamento das pendências de qualidade de dados abertas durante o povoamento dos
clubes e estaduais (Tier 1: SP, RJ, MG, RS, BA, PE). Critério aplicado: só entra na
base um clube/fato confirmado por pelo menos uma fonte razoável; qualquer coisa
duvidosa fica de fora dos arquivos de dados e listada aqui.

## Resolvidos

- **"EC São Bernardo"** vs **"São Bernardo FC"**: confirmados como dois clubes
  distintos e reais, ambos de São Bernardo do Campo — Wikipédia inglesa tem
  páginas separadas e a página do São Bernardo FC diz explicitamente "Not to
  be confused with Esporte Clube São Bernardo". EC São Bernardo (fundado
  1928, estádio 1º de Maio) disputa a A3; São Bernardo FC (fundado 2004,
  também joga a Série B nacional) disputa a A1. Ambos adicionados à base.
- **União Suzano** (fundado 1969, estádio Francisco Marques Figueira) e
  **XV de Jaú** (fundado 1924, estádio Zezinho Magalhães) — confirmados por
  múltiplas fontes (Wikipédia, Futebol Interior) disputando a A3 2026.
  Adicionados; a A3 agora tem os 16 times reais da divisão.

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
`rj_estadual.json` tem `fundacao` e `estadio` ausentes — não foram
verificados individualmente nesta rodada (confirmei só nome/cidade). Exceções
já confirmadas: União Barbarense, ECUS, VOCEM (SP) e Bangu, Madureira, Nova
Iguaçu, Portuguesa-RJ, Sampaio Corrêa-RJ, Volta Redonda (RJ).

- **Maricá Futebol Clube**: fundação incerta (fontes divergem entre 2001 e
  2003) — campo `fundacao` deixado de fora de propósito.
- **Boavista Sport Club**: história de fundação complexa (refundado em 2004,
  origem em 1961 como outro nome) — campo `fundacao` deixado de fora até
  decidir qual ano usar.

## Minas Gerais — detalhes pendentes

- **Betim Futebol Clube** (Módulo I): há duas histórias de fundação conflitantes
  nas fontes — um "Betim Futebol Clube" fundado em 2006, e uma entidade fundada
  em 2008 como "Associação Mineira de Desenvolvimento Humano" que se tornou
  "Betim Futebol" em 2019 e subiu ao Módulo I em 2024/2025. A existência e
  participação atual do clube estão confirmadas; o campo `fundacao` foi
  deixado de fora por não haver consenso de qual é o ano correto.
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

- **Monsoon Futebol Clube** (1ª divisão): clube real (fundado 2021), mas mudou
  a sede de Porto Alegre para Capão da Canoa em 2026 — o estádio atual não
  foi confirmado, campo `estadio` deixado de fora.
- **8 clubes da Série A2** (Apafut, Brasil-Farroupilha, Esportivo Bento
  Gonçalves, Sport Clube Gaúcho, Glória, Gramadense, Guarani-VA, União
  Frederiquense): existência e participação na temporada 2026 confirmadas
  pela Wikipédia oficial da competição, mas `fundacao`/`estadio` não foram
  pesquisados individualmente ainda.
- **Gauchão (1ª divisão)**: vagas de Copa do Brasil/Libertadores não
  pesquisadas — `premiacao` só tem o rebaixamento confirmado (2 times).
- Nenhum clube com risco real de duplicata/identidade ambígua foi encontrado
  nesta rodada (diferente dos casos São Bernardo/Patrocinense).

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
