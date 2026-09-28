import { useGame, game } from '../store/gameStore';
import { defense, enemyStats } from '../engine/combat';
import { fmtTime } from './common';

// 襲擊預警：階段 4 起顯示下一次襲擊倒數；預警期間變成紅色警報，並比較雙方戰力
export function RaidBanner() {
  useGame((st) => st.v);
  const s = game.s, r = s.raid;
  if (s.stage < 4 || s.finished || r.nextAt < 0) return null;
  const inc = r.incoming, d = defense(s);
  const e = inc ?? { ...enemyStats(r.won), at: r.nextAt };
  const eAtk = e.enemies * e.atk, eHp = e.enemies * e.hp;
  const odds = d.ready === 0 ? '沒有保全迎戰' : d.atk * 3 >= eHp && d.hp >= eAtk * 1.5 ? '我方佔優勢' : d.atk * 5 >= eHp ? '勢均力敵' : '我方劣勢';
  return (
    <div className={'raid px' + (inc ? ' alert' : '')} role={inc ? 'alert' : 'status'}>
      <b>{inc ? `異星生物來襲：${inc.enemies} 隻，${Math.ceil(inc.at - s.t)} 秒後抵達` : `下一次襲擊約 ${fmtTime(r.nextAt - s.t)} 後（預計 ${e.enemies} 隻）`}</b>
      <span>保全 {d.ready}/{d.guards}（武裝 {d.armedReady}）· 攻 {Math.round(d.atk)} 血 {Math.round(d.hp)} ／ 敵方 攻 {Math.round(eAtk)} 血 {Math.round(eHp)} · {odds}</span>
    </div>
  );
}
