// 原料產出與加工鏈：同一 tick 內先結算原料、後結算加工
import { DEFS, GameState } from './state';
import { add, gatherRate, processInput, recipeRatio, storageCap, weaponShare, weaponRatio } from './formulas';

export function produce(s: GameState, dt: number, eff = 1) {
  const cap = storageCap(s);
  for (const d of DEFS) {
    if (!d.produce) continue;
    const r = gatherRate(s, d.id);
    if (r > 0) add(s, d.produce.res, r * dt * eff, cap);
  }
  for (const d of DEFS) {
    if (!d.recipe) continue;
    const want = processInput(s, d.id) * dt * eff;
    if (want <= 0) continue;
    const ratio = recipeRatio(s, d.id), ws = weaponShare(s, d.id);
    // 產品倉庫滿了就停工（武器與工具分開看）
    const roomOut = ws < 1 ? Math.max(0, cap - s.res[d.recipe.out]) / (ratio * (1 - ws)) : Infinity;
    const roomW = ws > 0 ? Math.max(0, cap - s.res.weapon) / (weaponRatio(s) * ws) : Infinity;
    const used = Math.min(want, s.res[d.recipe.in], roomOut, roomW);
    if (used <= 0) continue;
    s.res[d.recipe.in] -= used;
    if (ws < 1) add(s, d.recipe.out, used * (1 - ws) * ratio, cap);
    if (ws > 0) add(s, 'weapon', used * ws * weaponRatio(s), cap);
  }
}
