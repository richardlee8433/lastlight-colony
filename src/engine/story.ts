// 主線章節與目標（GDD §2，MVP 第 1–3 章）
import STORY from '../data/story.json';
import { GameState } from './state';
import { built } from './formulas';

export interface Goal { gid: string; type: 'resource' | 'build' | 'pop' | 'assign' | 'raids' | 'charter' | 'envoy' | 'credits'; res?: string; id?: string; amount?: number; label: string }
export interface Chapter { chapter: number; title: string; subtitle: string; intro: string[]; goals: Goal[] }
export const CHAPTERS = (STORY as unknown as Chapter[]).map((c) => ({ ...c, goals: c.goals.map((g, i) => ({ ...g, gid: `${c.chapter}-${i}` })) }));

/** 舊存檔的 story.done 存的是中文目標文字，換成 id */
export function migrateStoryDone(done: string[]): string[] {
  const out = new Set<string>();
  for (const x of done) {
    const g = CHAPTERS.flatMap((c) => c.goals).find((g) => g.label === x);
    out.add(g ? g.gid : x);
  }
  return [...out];
}

function liveDone(s: GameState, g: Goal): boolean {
  switch (g.type) {
    case 'build': return built(s, g.id!);
    case 'pop': return s.pop >= g.amount!;
    case 'resource': return (s.res as Record<string, number>)[g.res!] >= g.amount!;
    case 'assign': return s.story.assigned;
    case 'raids': return s.raid.won >= g.amount!;
    case 'charter': return s.gov.charters.length > 0;
    case 'envoy': return s.gov.corp.envoys > 0;
    case 'credits': return s.gov.creditsEarned >= g.amount!;
  }
}
/** 目標達成一次就算完成（資源花掉後不會取消勾選） */
export const goalDone = (s: GameState, g: Goal) => s.story.done.includes(g.gid) || liveDone(s, g);
export const currentChapter = (s: GameState) => CHAPTERS[Math.min(s.stage, CHAPTERS.length) - 1];
export function updateStory(s: GameState) {
  const ch = currentChapter(s);
  if (!ch) return;
  for (const g of ch.goals) if (!s.story.done.includes(g.gid) && liveDone(s, g)) s.story.done.push(g.gid);
}
