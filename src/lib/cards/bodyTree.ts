import { CelestialBody } from "../../data";

/** Find the path (array of child indices) from root to a body with the given id */
export function findPathToBody(root: CelestialBody, targetId: number): number[] | null {
  if (root.id === targetId) return [];
  for (let i = 0; i < root.children.length; i++) {
    const result = findPathToBody(root.children[i], targetId);
    if (result !== null) return [i, ...result];
  }
  return null;
}

export function getBodyAtPath(root: CelestialBody, path: number[]): CelestialBody {
  let current = root;
  for (const index of path) {
    current = current.children[index];
  }
  return current;
}

export interface Crumb {
  name: string;
  path: number[];
}

export function getBreadcrumb(root: CelestialBody, path: number[]): Crumb[] {
  const crumbs: Crumb[] = [{ name: root.name, path: [] }];
  let current = root;
  for (let i = 0; i < path.length; i++) {
    current = current.children[path[i]];
    crumbs.push({ name: current.name, path: path.slice(0, i + 1) });
  }
  return crumbs;
}
