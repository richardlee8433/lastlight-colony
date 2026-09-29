import { useGame, game } from '../store/gameStore';
import { arrivalInterval, foodSafety, hurtCivilians, idle, moraleMult, netRates, popCap, rescueWorkers } from '../engine/formulas';
import { Bar, fmtTime } from './common';
import { t } from '../i18n';
import { AIR_ENABLED } from '../engine/state';
import { COLLAPSE_EVERY, HYPOXIA_FAIL, HYPOXIA_GRACE, LIFE_SUPPORT, airSafety, lifeSupportLeft, lifeSupportRate } from '../engine/air';

export function ColonyPanel() {
  useGame((st) => st.v);
  const s = game.s, cap = popCap(s), fs = foodSafety(s);
  const full = s.pop >= cap;
  const eta = full || s.starving ? null : (1 - s.arrival) * arrivalInterval(s);
  const rates = netRates(s), food = rates.nutrient, oxy = rates.oxygen, as = airSafety(s), a = s.air;
  const ls = lifeSupportLeft(s);
  return (
    <div className="colony px">
      <div className="row"><span>{t('cp.colonists')}</span><b>{s.pop}<small>/{cap}</small></b></div>
      <div className="row"><span>{t('cp.idle')}</span><b className={idle(s) > 0 ? 'hl' : ''}>{idle(s)}</b></div>
      {hurtCivilians(s) > 0 && <div className="row"><span>{t('cp.hurt')}</span><b className="warn">{hurtCivilians(s)}</b></div>}
      {rescueWorkers(s) > 0 && <div className="row"><span>{t('cp.rescue')}</span><b>{rescueWorkers(s)}</b></div>}
      <div className="meter"><span>{t('cp.food', { n: Math.round(fs * 100) })}</span><Bar value={fs} tone={fs < 0.25 ? 'bad' : fs < 0.6 ? 'mid' : 'good'} /></div>
      {AIR_ENABLED && <div className="meter"><span>{t('cp.air', { n: Math.round(as * 100) })}</span><Bar value={as} tone={as < 0.25 ? 'bad' : as < 0.6 ? 'mid' : 'air'} /></div>}
      {AIR_ENABLED && ls > 0 && (
        <div className="meter"><span className={ls < 120 ? 'warn' : ''}>{a.pause > 0 ? t('cp.lsPause', { n: Math.ceil(a.pause) }) : t('cp.ls', { t: fmtTime(ls), n: lifeSupportRate(s).toFixed(2) })}</span><Bar value={ls / LIFE_SUPPORT.duration} tone="mid" /></div>
      )}
      <div className="meter"><span>{t('cp.morale', { n: Math.round(s.morale), m: moraleMult(s).toFixed(2) })}</span><Bar value={s.morale / 100} tone="morale" /></div>
      {AIR_ENABLED && a.hypoxic && (
        <div className="arrival"><span className="warn">{a.hypoxiaTime < HYPOXIA_GRACE
          ? t('cp.hypoxia1', { n: Math.floor(a.hypoxiaTime), m: Math.ceil(HYPOXIA_GRACE - a.hypoxiaTime) })
          : t('cp.hypoxia2', { n: COLLAPSE_EVERY, t: fmtTime(HYPOXIA_FAIL - a.hypoxiaTime) })}</span></div>
      )}
      {AIR_ENABLED && !a.hypoxic && oxy < -0.01 && (
        <div className="arrival"><span className="warn">{t('cp.airOut', { n: oxy.toFixed(2), t: fmtTime(s.res.oxygen / -oxy) })}</span></div>
      )}
      {!s.starving && food < -0.01 && (
        <div className="arrival"><span className="warn">{t('cp.foodOut', { n: food.toFixed(1), t: fmtTime(s.res.nutrient / -food) })}</span></div>
      )}
      <div className="arrival">
        {s.starving ? <span className="warn">{s.starveTime < 60 ? t('cp.starve1', { n: Math.floor(s.starveTime), m: Math.ceil(60 - s.starveTime) }) : t('cp.starve2')}</span>
          : full ? <span className="muted">{t('cp.full')}</span>
          : <span className="muted">{t('cp.next', { t: fmtTime(eta!) })}</span>}
      </div>
    </div>
  );
}
