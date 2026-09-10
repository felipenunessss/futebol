import type { Opcao, EscolhaResolvida } from "../progression/scenarios.js";
import { foraDeCombatePorIncidente, PROBABILIDADE_CARTAO_AMARELO, PROBABILIDADE_CARTAO_VERMELHO, PROBABILIDADE_LESAO, type IncidenteDeJogador } from "./match.js";

/**
 * Constrói uma `EscolhaResolvida` sintética pra um `IncidenteDeJogador` JÁ sorteado (por
 * `sortearIncidenteDeJogador`) — não sorteia de novo, só empacota o resultado já decidido no mesmo
 * formato usado pelo catálogo de cenários (`progression/scenarios.ts`), pra reaproveitar 100% da
 * animação de "spin" que já existe pra cenários fora de campo (`TelaDeTemporada.tsx`
 * `PainelAnimacaoDeEscolha`) sem duplicar nenhuma lógica de UI nova — as opções que aparecem girando
 * antes de parar são as 4 possibilidades reais (nada, amarelo, lesão, vermelho), cada uma com a
 * probabilidade de verdade usada no sorteio, e a que "ganha" é sempre a que já foi decidida.
 */
export function escolhaResolvidaDoIncidente(incidente: IncidenteDeJogador): EscolhaResolvida {
  const probabilidadeDeNadaAcontecer = 1 - PROBABILIDADE_CARTAO_VERMELHO - PROBABILIDADE_LESAO - PROBABILIDADE_CARTAO_AMARELO;

  const narrativaDaLesao =
    incidente.tipo === "lesao"
      ? `Você sente uma lesão ${incidente.gravidade === "leve" ? "leve" : incidente.gravidade === "media" ? "de gravidade média" : "grave"} e precisa sair de campo — fora por ${incidente.partidasFora} partida(s).`
      : "Você sente uma lesão e precisa sair de campo.";

  const opcao: Opcao = {
    id: "incidente_de_jogo",
    texto: "O que acontece com você nesse lance?",
    resultados: [
      { probabilidade: probabilidadeDeNadaAcontecer, impacto: { narrativa: "Nada de grave — você segue tranquilo em campo." } },
      { probabilidade: PROBABILIDADE_CARTAO_AMARELO, impacto: { narrativa: "Cartão amarelo pra você, num lance mais duro." } },
      { probabilidade: PROBABILIDADE_LESAO, impacto: { narrativa: narrativaDaLesao, foraDeCombate: incidente.tipo === "lesao" ? foraDeCombatePorIncidente(incidente) : undefined } },
      {
        probabilidade: PROBABILIDADE_CARTAO_VERMELHO,
        impacto: {
          narrativa: "Cartão vermelho direto! Você está fora do resto da partida — e suspenso para o próximo jogo.",
          foraDeCombate: incidente.tipo === "cartao_vermelho" ? foraDeCombatePorIncidente(incidente) : undefined,
        },
      },
    ],
  };

  const indicePorTipo: Record<IncidenteDeJogador["tipo"], number> = { cartao_amarelo: 1, lesao: 2, cartao_vermelho: 3 };
  return { opcao, resultado: opcao.resultados[indicePorTipo[incidente.tipo]] };
}
