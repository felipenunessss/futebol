import type { Atributo, Atributos } from "@motor/schemas/player.js";

const VALOR_MAXIMO = 99;
const ALTURA = 280;
/**
 * Mais larga que alta de propósito — o círculo em si fica perfeitamente redondo (mesmo raio em X
 * e Y, `preserveAspectRatio` só escala uniformemente), a largura extra é margem morta nas laterais
 * pros rótulos mais longos não serem cortados pelo viewBox. Posições com mais atributos (ex:
 * atacante, 13) são o caso que mais precisa dessa margem.
 */
const LARGURA = 460;
const CENTRO_X = LARGURA / 2;
const CENTRO_Y = ALTURA / 2;
/** Deixa espaço pros rótulos, que ficam um pouco além do raio máximo. */
const RAIO_MAXIMO = CENTRO_Y - 60;
const RAIO_DO_ROTULO = RAIO_MAXIMO + 40;
const ANEIS = [0.25, 0.5, 0.75, 1];

/** Encurta o 1º termo de rótulos compostos (ex: "posicionamento ofensivo" → "posic. ofensivo") só pra caber no radar sem sobrepor rótulos vizinhos. */
function rotuloCurto(atributo: Atributo): string {
  const [primeira, ...resto] = atributo.replaceAll("_", " ").split(" ");
  if (resto.length === 0 || primeira.length <= 6) return [primeira, ...resto].join(" ");
  return [`${primeira.slice(0, 5)}.`, ...resto].join(" ");
}

/** Gráfico de radar (hexágono/octógono, etc — N pontas conforme a posição) dos atributos 0-99 do jogador, SVG puro (sem lib de gráfico). */
export function RadarDeAtributos({ atributos, atributosDaPosicao }: { atributos: Atributos; atributosDaPosicao: Atributo[] }) {
  const n = atributosDaPosicao.length;

  function anguloDoEixo(indice: number): number {
    return (Math.PI * 2 * indice) / n - Math.PI / 2;
  }

  function ponto(indice: number, valor: number, raio: number = RAIO_MAXIMO) {
    const r = (valor / VALOR_MAXIMO) * raio;
    const angulo = anguloDoEixo(indice);
    return { x: CENTRO_X + r * Math.cos(angulo), y: CENTRO_Y + r * Math.sin(angulo) };
  }

  function caminhoPoligono(pontos: { x: number; y: number }[]): string {
    return pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  }

  const pontosDoJogador = atributosDaPosicao.map((atributo, i) => ponto(i, atributos[atributo] ?? 0));

  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full max-w-lg mx-auto">
      {ANEIS.map((fracao) => (
        <path key={fracao} d={caminhoPoligono(atributosDaPosicao.map((_, i) => ponto(i, fracao * VALOR_MAXIMO)))} fill="none" stroke="rgb(51 65 85)" strokeWidth={1} />
      ))}
      {atributosDaPosicao.map((_, i) => {
        const ponta = ponto(i, VALOR_MAXIMO);
        return <line key={i} x1={CENTRO_X} y1={CENTRO_Y} x2={ponta.x} y2={ponta.y} stroke="rgb(51 65 85)" strokeWidth={1} />;
      })}
      <path d={caminhoPoligono(pontosDoJogador)} fill="rgb(16 185 129 / 0.35)" stroke="rgb(16 185 129)" strokeWidth={2} />
      {pontosDoJogador.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="rgb(16 185 129)" />
      ))}
      {atributosDaPosicao.map((atributo, i) => {
        const rotulo = ponto(i, VALOR_MAXIMO, RAIO_DO_ROTULO);
        const angulo = anguloDoEixo(i);
        const cosseno = Math.cos(angulo);
        const alinhamento = cosseno > 0.15 ? "start" : cosseno < -0.15 ? "end" : "middle";
        return (
          <text key={atributo} x={rotulo.x} y={rotulo.y} textAnchor={alinhamento} dominantBaseline="middle" fontSize={8.5} className="fill-slate-400">
            {rotuloCurto(atributo)} ({atributos[atributo] ?? 0})
          </text>
        );
      })}
    </svg>
  );
}
