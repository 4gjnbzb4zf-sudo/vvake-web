/**
 * A pre-sized image from /public/home in AVIF with a WebP fallback (made for the size it's shown at, so no
 * resizing service is needed on the static site). Lazy by default; pass `eager` for above-the-fold pictures.
 */
export function Shot({
  name,
  width,
  height,
  alt,
  className,
  eager = false,
}: {
  /** File name in /public/home without extension (both .avif and .webp exist). */
  name: string;
  width: number;
  height: number;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    // `contents`: the <img> itself is the layout box (flex sizing, margins), the <picture> only picks the format.
    <picture className="contents">
      <source srcSet={`/home/${name}.avif`} type="image/avif" />
      <img
        src={`/home/${name}.webp`}
        width={width}
        height={height}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
