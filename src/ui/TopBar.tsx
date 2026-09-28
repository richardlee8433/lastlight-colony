import { useGame, game } from '../store/gameStore';
import { RES_KEYS, RES_UNLOCK, UNCAPPED } from '../engine/state';
import { resName, t } from '../i18n';
import { netRates, storageCap } from '../engine/formulas';
import { Icon, fmt } from './common';

export function TopBar() {
  useGame((st) => st.v);
  const s = game.s, cap = storageCap(s), rates = netRates(s);
  return (
    <div className="topbar px">
      {RES_KEYS.filter((k) => RES_UNLOCK[k] <= s.stage).map((k) => {
        const uncapped = UNCAPPED.includes(k);
        const full = !uncapped && s.res[k] >= cap - 0.01, r = rates[k];
        return (
          <div className="res" key={k} title={uncapped ? `${resName(k)}: ${fmt(s.res[k])}` : `${resName(k)}: ${fmt(s.res[k])} / ${cap}`}>
            <Icon k={k} size={20} />
            <div className="res-num">
              <b className={full ? 'full' : ''}>{fmt(s.res[k])}{!uncapped && <small>/{fmt(cap)}</small>}</b>
              <span className={r < -0.001 ? 'neg' : r > 0.001 ? 'pos' : ''}>{r > 0.001 ? '+' : ''}{t('perSec', { n: Math.abs(r) < 0.001 ? '0' : r.toFixed(1) })}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
