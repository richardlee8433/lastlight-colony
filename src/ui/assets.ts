import { renderIcon, renderBuilding, paintedCount } from '../art/art.js';

const cache = new Map<string, string>();
// 手繪圖示（src/assets/icons/資源.webp，已去背、縮到 64×64）優先，沒有就用程式畫的像素圖示
const files = import.meta.glob('../assets/icons/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const PAINTED: Record<string, string> = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));
export const paintedIcon = (k: string) => k in PAINTED;
export function iconURL(k: string) {
  if (PAINTED[k]) return PAINTED[k];
  if (!cache.has('i:' + k)) cache.set('i:' + k, renderIcon(k).toDataURL());
  return cache.get('i:' + k)!;
}
export function buildingURL(id: string, level: number) {
  const tier = level >= 5 ? 3 : level >= 3 ? 2 : 1, key = `b:${id}:${tier}:${paintedCount()}`;
  if (!cache.has(key)) cache.set(key, renderBuilding(id, Math.max(1, level)).canvas.toDataURL());
  return cache.get(key)!;
}
