// 手動點擊：暴擊、點擊 buff（GDD §6）
import { DEF, GameState, ResKey } from './state';
import { add, built, clickAmount, critChance, critMult, disabled, nodeEffect, recipeRatio, weaponShare, weaponRatio } from './formulas';

export interface ClickResult { res: ResKey; amount: number; crit: boolean; bonus?: ResKey; bonusAmount?: number }

export function click(s: GameState, id: string, rng = Math.random): ClickResult | null {
  const d = DEF[id];
  if (!d.clickable || !built(s, id) || disabled(s, id)) return null;
  const crit = rng() < critChance(s, id);
  const n = clickAmount(s, id) * (crit ? critMult(s, id) : 1);
  s.b[id].lastClick = s.t;
  s.stats.clicks++;
  if (crit) s.stats.crits++;
  if (d.produce) {
    add(s, d.produce.res, n);
    // 金屬礦井「晶脈感應」：點擊時有機率掉異晶碎片
    const pc = nodeEffect(s, id, 'clickCrystal');
    if (pc && rng() < pc) { add(s, 'crystal', 1); return { res: 'crystal', amount: 1, crit: false, bonus: d.produce.res, bonusAmount: n }; }
    return { res: d.produce.res, amount: n, crit };
  }
  if (d.recipe) {
    const used = Math.min(n, s.res[d.recipe.in]);
    if (used <= 0) return { res: d.recipe.out, amount: 0, crit: false };
    s.res[d.recipe.in] -= used;
    // 鍛造廠有工人改做武器時，點擊也依比例產出武器（全部改做武器就只出武器）
    if (weaponShare(s, id) >= 1) { const w = used * weaponRatio(s); add(s, 'weapon', w); return { res: 'weapon', amount: w, crit }; }
    const out = used * recipeRatio(s, id);
    add(s, d.recipe.out, out);
    return { res: d.recipe.out, amount: out, crit };
  }
  return null;
}
