// 第 1 章引導（v0.70.8）：手指一路帶到第一棟建築。殘骸堆的採集按鈕 → 快捷列的氧氣再生器 → 面板的建造按鈕；蓋好就消失。
// 電腦與手機都顯示（CrazyGames 電腦版玩家常常不知道第一步要做什麼）。
import type { GameState } from '../engine/state';
import { built } from '../engine/formulas';
import { levelBlock } from '../engine/actions';

export type Ch1Hint = 'scrap' | 'quickbar' | 'build' | null;

export function ch1Hint(s: GameState, selected: string | null): Ch1Hint {
  if (s.stage !== 1 || built(s, 'o2_scrubber')) return null;
  if ((s.stats?.clicks ?? 0) === 0) return 'scrap';
  const why = levelBlock(s, 'o2_scrubber');
  // 廢料還不夠蓋：手指回到殘骸堆
  if (why) return why.k === 'why.afford' ? 'scrap' : null;
  return selected === 'o2_scrubber' ? 'build' : 'quickbar';
}
