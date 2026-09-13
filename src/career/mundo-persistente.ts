import type { Premiacao } from "../schemas/championship.js";
import type { LinhaTabela } from "../simulation/season.js";

/**
 * Promoção/rebaixamento entre temporadas — sem isso, toda temporada nova recarregava a MESMA lista
 * estática de `times` por competição (`src/data/estaduais/*.json`/`campeonatos-nacionais/*.json`),
 * então nenhum clube subia/descia de verdade entre temporadas simuladas (bug relatado pelo usuário:
 * "não estou vendo os rebaixamentos/promoções/premiações funcionarem"). Este módulo calcula as
 * mudanças de divisão a partir da classificação final de cada competição e aplica isso na
 * composição efetiva da temporada seguinte — sem tocar nos arquivos de dado (que continuam sendo a
 * referência "ano X" original), só numa sobreposição (`EstadoDeCarreira.composicaoDasCompeticoes`)
 * carregada entre temporadas da mesma carreira.
 *
 * **Escopo desta 1ª versão, de propósito**: só cobre promoção/rebaixamento ENTRE DIVISÕES DA MESMA
 * hierarquia (ligadas por `nivel` dentro da mesma `chaveDeHierarquia` — quem chama monta essa
 * chave: estado, pro Brasil, ou país, pra competições nacionais) E só quando as DUAS divisões do
 * par conseguem expor uma `tabelaFinal` (hoje só `pontos_corridos` puro, sem mata-mata — ver
 * `simulation/incremental.ts` `ContextoDePrograma.tabelaFinal`); se só uma das duas suportar,
 * nenhuma troca acontece nesse par (evita drenar/inchar uma divisão ao longo de várias temporadas
 * recebendo de um lado sem nunca devolver do outro). Confirmado funcionando: Brasileirão Série A ↔
 * B (as duas são `pontos_corridos` puro). **Ainda não cobre**: a maioria dos estaduais (fase_suica/
 * fase_grupos/turno-retorno não têm `tabelaFinal` ainda) nem Brasileirão B↔C↔D (Série C/D usam
 * fase_grupos+mata-mata). Também não cobre vagas de Copa do Brasil/Libertadores/Sul-Americana/
 * Série D concedidas a um estadual (`Premiacao.vaga_copa_do_brasil`/`vaga_libertadores`/
 * `vaga_sulamericana`/`vaga_serie_d`) — são inserções cross-competição em competições já complexas
 * (fases escalonadas, sorteio de grupos), fora de escopo por ora; fica documentado como pendência,
 * não implementado nem simulado.
 */

export interface CompeticaoParaMundoPersistente {
  id: string;
  /** Chave de agrupamento hierárquico — competições da MESMA chave promovem/rebaixam entre si por
   * `nivel` adjacente (ex: `"estadual:MG"` pro Mineiro Módulo I/II, `"nacional:BR"` pro Brasileirão
   * A/B/C/D). Quem monta a chave decide o que conta como "mesma hierarquia" — este módulo só agrupa
   * por igualdade de string. */
  chaveDeHierarquia: string;
  nivel: number;
  premiacao: Premiacao;
  /** Classificação final desta temporada, do 1º ao último colocado — `undefined` quando o formato
   * não suporta extração ainda (ver docs no topo do arquivo). Sem isso, a competição não participa
   * de nenhuma mudança de divisão nesta rodada (nem como origem nem como destino). */
  tabelaFinal?: LinhaTabela[];
}

export interface MudancaDeDivisao {
  competicaoId: string;
  /** Club.id[] que passam a fazer parte desta competição na temporada seguinte. */
  entram: string[];
  /** Club.id[] que saem desta competição na temporada seguinte. */
  saem: string[];
}

function adicionar(mapa: Map<string, { entram: Set<string>; saem: Set<string> }>, id: string, campo: "entram" | "saem", times: string[]): void {
  let atual = mapa.get(id);
  if (!atual) {
    atual = { entram: new Set(), saem: new Set() };
    mapa.set(id, atual);
  }
  for (const time of times) atual[campo].add(time);
}

/**
 * Calcula quem sobe/desce a partir da classificação final desta temporada — pura, não aplica nada
 * sozinha (ver `aplicarMudancasDeDivisao`). `rebaixamento_proxima_divisao: N` manda os N últimos
 * colocados pra divisão de `nivel + 1` da mesma `chaveDeHierarquia` (se existir); `acesso_proxima_divisao: N`
 * manda os N primeiros colocados pra divisão de `nivel - 1`. As duas regras podem coexistir na
 * mesma competição (ex: uma 2ª divisão sobe alguns times pra 1ª E desce outros pra 3ª).
 */
export function calcularMudancasDeDivisao(competicoes: CompeticaoParaMundoPersistente[]): MudancaDeDivisao[] {
  const porChave = new Map<string, CompeticaoParaMundoPersistente[]>();
  for (const competicao of competicoes) {
    const lista = porChave.get(competicao.chaveDeHierarquia) ?? [];
    lista.push(competicao);
    porChave.set(competicao.chaveDeHierarquia, lista);
  }

  const mudancas = new Map<string, { entram: Set<string>; saem: Set<string> }>();

  for (const grupo of porChave.values()) {
    const porNivel = new Map(grupo.map((competicao) => [competicao.nivel, competicao] as const));
    for (const competicao of grupo) {
      if (!competicao.tabelaFinal || competicao.tabelaFinal.length === 0) continue;

      // A divisão VIZINHA também precisa ter `tabelaFinal` (mesmo requisito de formato suportado)
      // pra uma troca ser aplicada num sentido — sem essa checagem, uma divisão suportada podia
      // mandar times pra uma vizinha não suportada (ou receber dela) só nesse UM sentido, drenando/
      // inchando a vizinha ao longo de várias temporadas (ex: Série B rebaixando 4/ano pra Série C
      // pra sempre, sem nunca receber de volta os 4 que a Série C promoveria).
      const rebaixamento = competicao.premiacao.rebaixamento_proxima_divisao ?? 0;
      const divisaoDeBaixo = porNivel.get(competicao.nivel + 1);
      if (rebaixamento > 0 && divisaoDeBaixo?.tabelaFinal) {
        const times = competicao.tabelaFinal.slice(-rebaixamento).map((linha) => linha.clubeId);
        adicionar(mudancas, competicao.id, "saem", times);
        adicionar(mudancas, divisaoDeBaixo.id, "entram", times);
      }

      const acesso = competicao.premiacao.acesso_proxima_divisao ?? 0;
      const divisaoDeCima = porNivel.get(competicao.nivel - 1);
      if (acesso > 0 && divisaoDeCima?.tabelaFinal) {
        const times = competicao.tabelaFinal.slice(0, acesso).map((linha) => linha.clubeId);
        adicionar(mudancas, competicao.id, "saem", times);
        adicionar(mudancas, divisaoDeCima.id, "entram", times);
      }
    }
  }

  return [...mudancas.entries()].map(([competicaoId, { entram, saem }]) => ({ competicaoId, entram: [...entram], saem: [...saem] }));
}

/**
 * Aplica as mudanças calculadas por `calcularMudancasDeDivisao` sobre a composição atual (Club.id[]
 * por campeonatoId — já com qualquer sobreposição de temporadas anteriores refletida, ver
 * `EstadoDeCarreira.composicaoDasCompeticoes`), devolvendo a composição da PRÓXIMA temporada. Pura —
 * não muta `composicaoAtual`.
 */
export function aplicarMudancasDeDivisao(composicaoAtual: Map<string, string[]>, mudancas: MudancaDeDivisao[]): Map<string, string[]> {
  const nova = new Map(composicaoAtual);
  for (const { competicaoId, entram, saem } of mudancas) {
    const atuais = nova.get(competicaoId) ?? [];
    const saemSet = new Set(saem);
    const restantes = atuais.filter((id) => !saemSet.has(id));
    nova.set(competicaoId, [...restantes, ...entram]);
  }
  return nova;
}
