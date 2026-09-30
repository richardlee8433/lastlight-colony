import { renderIcon, renderBuilding, paintedCount } from '../art/art.js';

const cache = new Map<string, string>();
export function iconURL(k: string) {
  if (!cache.has('i:' + k)) cache.set('i:' + k, renderIcon(k).toDataURL());
  return cache.get('i:' + k)!;
}
export function buildingURL(id: string, level: number) {
  const tier = level >= 5 ? 3 : level >= 3 ? 2 : 1, key = `b:${id}:${tier}:${paintedCount()}`;
  if (!cache.has(key)) cache.set(key, renderBuilding(id, Math.max(1, level)).canvas.toDataURL());
  return cache.get(key)!;
}
