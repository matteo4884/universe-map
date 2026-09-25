import { CelestialBody } from "../../data";

/**
 * The body's picture: a photo when there is one, otherwise its surface map
 * shaded like a sphere (so every moon gets an image), or a glyph for spacecraft.
 */
export default function BodyImage({ body, size = 112 }: { body: CelestialBody; size?: number }) {
  if (body.image) {
    return (
      <img
        key={body.image}
        src={`/images/${body.image}`}
        alt={body.name}
        width={size}
        height={size}
        className="object-contain flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  if (body.texture) {
    const d = size * 0.8;
    return (
      <div className="flex-shrink-0 flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={body.name}>
        <div
          className="rounded-full"
          style={{
            width: d,
            height: d,
            backgroundImage: `url(/textures/low/${body.texture})`,
            backgroundSize: "200% 100%",
            backgroundPosition: "center",
            boxShadow: `inset -${d * 0.18}px -${d * 0.1}px ${d * 0.3}px rgba(0,0,0,0.85), inset ${d * 0.04}px ${d * 0.04}px ${d * 0.1}px rgba(255,255,255,0.12), 0 0 ${d * 0.15}px rgba(255,255,255,0.08)`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={body.name}>
      <div
        className="rotate-45"
        style={{ width: size * 0.22, height: size * 0.22, background: body.color, boxShadow: `0 0 ${size * 0.2}px ${body.color}` }}
      />
    </div>
  );
}
