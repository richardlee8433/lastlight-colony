import { useGame, game } from '../store/gameStore';
import { CHARTER_DEFS, charterSlots, taxIncome } from '../engine/formulas';
import { charterBlock } from '../engine/governance';
import { fmt } from './common';
import { charterText, t, tm } from '../i18n';

// 行政中心：稅率（0–4 級，每級士氣 −5）與殖民憲章（GDD §11）
export function Governance() {
  useGame((st) => st.v);
  const s = game.s, act = useGame.getState(), g = s.gov, slots = charterSlots(s);
  return (
    <>
      <section className="block">
        <h3>{t('gv.tax')}</h3>
        <div className="tax" role="radiogroup" aria-label={t('gv.taxRate')}>
          {[0, 1, 2, 3, 4].map((lv) => (
            <button key={lv} type="button" role="radio" aria-checked={g.tax === lv} className={'btn' + (g.tax === lv ? '' : ' alt')} onClick={() => act.setTax(lv)}>
              {lv === 0 ? t('gv.taxFree') : t('gv.taxLv', { n: lv })}
            </button>
          ))}
        </div>
        <p className="muted small">{t('gv.taxInfo', { n: fmt(taxIncome(s)), m: g.tax * 5 })}</p>
      </section>
      <section className="block">
        <h3>{t('gv.charters', { n: g.charters.length, m: slots })}</h3>
        <ul className="nodes">
          {CHARTER_DEFS.map((c) => {
            const on = g.charters.includes(c.id), why = on ? null : charterBlock(s, c.id), [cn, cd, cc] = charterText(c.id);
            return (
              <li key={c.id} className={on ? 'active' : ''}>
                <div className="node-main"><b>{cn}</b><span>{cd}</span><span className="warn">{t('gv.cost', { c: cc })}</span></div>
                <button type="button" className={'btn' + (on ? ' alt' : '')} disabled={!!why} onClick={() => act.toggleCharter(c.id)}>{on ? t('gv.repeal') : why ? tm(why) : t('gv.pass')}</button>
              </li>
            );
          })}
        </ul>
        <p className="muted small">{t('gv.hint')}</p>
      </section>
    </>
  );
}
