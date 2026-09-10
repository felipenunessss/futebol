/**
 * Escudo/emblema (clube ou competição) — puramente visual. `url` vem de
 * `Club.escudo_url`/`CampeonatoEstadual|CampeonatoNacional.escudo_url`
 * (populados por `scripts/buscar-escudos.ts`, nem sempre presentes — ver
 * `docs/dados-a-verificar.md`). Sem `url` (ou se a imagem falhar ao
 * carregar), mostra um placeholder neutro (círculo sutil) em vez de nada —
 * evita "buraco" no layout enquanto a cobertura real de escudos não
 * melhora; não tenta adivinhar/inventar um escudo de verdade.
 */
export function Escudo({ url, alt, tamanho = 20 }: { url: string | undefined; alt: string; tamanho?: number }) {
  if (!url) return <PlaceholderDeEscudo tamanho={tamanho} />;
  return (
    <img
      src={url}
      alt={alt}
      width={tamanho}
      height={tamanho}
      loading="lazy"
      className="inline-block object-contain shrink-0"
      style={{ width: tamanho, height: tamanho }}
      onError={(evento) => {
        evento.currentTarget.replaceWith(criarPlaceholderDeEscudo(tamanho));
      }}
    />
  );
}

function PlaceholderDeEscudo({ tamanho }: { tamanho: number }) {
  return <span className="inline-block rounded-full border border-current opacity-30 shrink-0" style={{ width: tamanho, height: tamanho }} />;
}

/** Equivalente DOM puro de `PlaceholderDeEscudo`, usado no `onError` de `<img>` (não dá pra trocar por um componente React ali, só manipular o DOM direto). */
function criarPlaceholderDeEscudo(tamanho: number): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "inline-block rounded-full border border-current opacity-30 shrink-0";
  span.style.width = `${tamanho}px`;
  span.style.height = `${tamanho}px`;
  return span;
}
