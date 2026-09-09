/**
 * Escudo/emblema (clube ou competição) — puramente visual. `url` vem de
 * `Club.escudo_url`/`CampeonatoEstadual|CampeonatoNacional.escudo_url`
 * (populados por `scripts/buscar-escudos.ts`, nem sempre presentes — ver
 * `docs/dados-a-verificar.md`). Sem `url`, não renderiza nada (sem
 * placeholder/fallback visual) — o nome ao lado já identifica o clube.
 * Esconde a própria imagem em `onError` (link externo quebrado/CORS).
 */
export function Escudo({ url, alt, tamanho = 20 }: { url: string | undefined; alt: string; tamanho?: number }) {
  if (!url) return null;
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
        evento.currentTarget.style.display = "none";
      }}
    />
  );
}
