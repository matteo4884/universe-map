import { MILKY_WAY, CelestialBody } from "../data";

// Lookup tables over the whole body tree, built once
const byId = new Map<number, CelestialBody>();
const bySlug = new Map<string, CelestialBody>();
const parents = new Map<number, CelestialBody>();

(function index(body: CelestialBody, parent: CelestialBody | null) {
  byId.set(body.id, body);
  bySlug.set(body.map, body);
  if (parent) parents.set(body.id, parent);
  for (const child of body.children) index(child, body);
})(MILKY_WAY, null);

/** Every body in the tree, depth-first (galaxy first) */
export const ALL_BODIES: CelestialBody[] = [...byId.values()];

export function getBody(id: number): CelestialBody | undefined {
  return byId.get(id);
}

export function getBodyBySlug(slug: string): CelestialBody | undefined {
  return bySlug.get(slug);
}

export function getParent(body: CelestialBody): CelestialBody | undefined {
  return parents.get(body.id);
}

/** Bodies rendered in the 3D scene (everything but the galaxy) */
export const SCENE_BODIES = ALL_BODIES.filter((b) => b.type !== "galaxy");

export const SUN = getBodyBySlug("sun")!;

/** The body and its ancestors, from the galaxy down */
export function breadcrumb(body: CelestialBody): CelestialBody[] {
  const chain: CelestialBody[] = [];
  for (let b: CelestialBody | undefined = body; b; b = getParent(b)) chain.unshift(b);
  return chain;
}
