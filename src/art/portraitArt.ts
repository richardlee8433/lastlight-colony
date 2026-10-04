// 角色立繪：有手繪圖就用手繪（src/assets/portraits/角色.webp，已去背、裁邊、縮到高 720），
// 還沒有的角色先用程序化像素頭像（portraits.js）代替。
import { renderPortrait } from './portraits.js';

const files = import.meta.glob('../assets/portraits/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const ART: Record<string, string> = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]));

export const CHARACTERS = ['mara', 'teo', 'juno', 'ines', 'sefa', 'voss', 'calder'] as const;
export type CharacterId = (typeof CHARACTERS)[number];

const pixelCache = new Map<string, string>();
/** 立繪圖片網址與是否為像素暫代圖；有表情圖（角色-表情.webp）就用，沒有退回預設立繪 */
export function portraitURL(id: CharacterId, mood?: string): { url: string; pixel: boolean } {
  if (mood && ART[`${id}-${mood}`]) return { url: ART[`${id}-${mood}`], pixel: false };
  if (ART[id]) return { url: ART[id], pixel: false };
  if (!pixelCache.has(id)) pixelCache.set(id, (renderPortrait(id, false) as HTMLCanvasElement).toDataURL());
  return { url: pixelCache.get(id)!, pixel: true };
}
