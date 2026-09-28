import { useGame, game } from '../store/gameStore';
import { CHARTER_DEFS, charterSlots, taxIncome } from '../engine/formulas';
import { charterBlock } from '../engine/governance';
import { fmt } from './common';

// 行政中心：稅率（0–4 級，每級士氣 −5）與殖民憲章（GDD §11）
export function Governance() {
  useGame((st) => st.v);
  const s = game.s, act = useGame.getState(), g = s.gov, slots = charterSlots(s);
  return (
    <>
      <section className="block">
        <h3>稅制</h3>
        <div className="tax" role="radiogroup" aria-label="稅率">
          {[0, 1, 2, 3, 4].map((lv) => (
            <button key={lv} type="button" role="radio" aria-checked={g.tax === lv} className={'btn' + (g.tax === lv ? '' : ' alt')} onClick={() => act.setTax(lv)}>
              {lv === 0 ? '免稅' : `${lv} 級`}
            </button>
          ))}
        </div>
        <p className="muted small">每秒 +{fmt(taxIncome(s))} 信用點（人口 × 0.02 × 稅率），士氣 −{g.tax * 5}。</p>
      </section>
      <section className="block">
        <h3>殖民憲章（{g.charters.length}/{slots}）</h3>
        <ul className="nodes">
          {CHARTER_DEFS.map((c) => {
            const on = g.charters.includes(c.id), why = on ? null : charterBlock(s, c.id);
            return (
              <li key={c.id} className={on ? 'active' : ''}>
                <div className="node-main"><b>{c.name}</b><span>{c.desc}</span><span className="warn">代價：{c.cost}</span></div>
                <button type="button" className={'btn' + (on ? ' alt' : '')} disabled={!!why} onClick={() => act.toggleCharter(c.id)}>{on ? '廢止' : why ?? '通過'}</button>
              </li>
            );
          })}
        </ul>
        <p className="muted small">憲章可以隨時廢止，換成別條。行政中心的升級線「議會擴編」能多開一個欄位。</p>
      </section>
    </>
  );
}
