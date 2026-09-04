// TODO: loop de simulação — percorre o calendário mestre (src/data/loaders/calendario.ts)
// e dispara a simulação de cada competição ativa em cada período.
//
// O que já existe pra montar isso:
// - `simulation/season.ts` (`simularTemporadaPontosCorridos`): gera confrontos e tabela
//   completos pro formato `pontos_corridos` (ver `schemas/championship.ts`) — cobre
//   Brasileirão A/B, Chile, Bolívia, etc.
// - `simulation/match.ts` (`simularPartida`): resolve uma partida isolada, com ou sem
//   `ParticipacaoJogador`.
// - `simulation/rating.ts` (`obterRating`/`atualizarElo`): força dos times, antes e
//   depois de cada partida.
//
// O que ainda falta:
// - Gerador de confronto pra `fase_grupos`/`fase_quadrangular`/`mata_mata`/`turno`+
//   `returno` — hoje só pontos_corridos tem gerador. A maioria dos campeonatos
//   modelados (estaduais, CONMEBOL) combina vários desses blocos, então o motor
//   completo depende de cobrir cada bloco, não só pontos_corridos.
// - Orquestração entre competições simultâneas de um mesmo período do calendário
//   (ex: estadual + Copa do Brasil rodando ao mesmo tempo em fevereiro).
// - Estado de carreira (calendário da temporada em andamento, clube atual do
//   jogador) que esse loop precisa consumir pra saber quando resolver a partida
//   dele com `ParticipacaoJogador` em vez de simulação agregada — ver
//   src/career/career-loop.ts.
export {};
