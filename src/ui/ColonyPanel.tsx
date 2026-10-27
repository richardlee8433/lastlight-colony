import { useGame, game } from '../store/gameStore';
import { arrivalInterval, foodSafety, hurtCivilians, idle, moraleMult, netRates, popCap, rescueWorkers } from '../engine/formulas';
import { Bar, fmtTime } from './common';
import { resName, t } from '../i18n';
import { useMobile, useMobilePanel, useShort } from './mobile';
import { AIR_ENABLED } from '../engine/state';
import { COLLAPSE_EVERY, HYPOXIA_FAIL, HYPOXIA_GRACE, LIFE_SUPPORT, airSafety, lifeSupportLeft, lifeSupportRate } from '../engine/air';

export function ColonyPanel() {
  useGame((st) => st.v);
  const s = game.s, cap = popCap(s), fs = foodSafety(s);
  const full = s.pop >= cap;
  const eta = full || s.starving ? null : (1 - s.arrival) * arrivalInterval(s);
  const rates = netRates(s), food = rates.nutrient, oxy = rates.oxygen, as = airSafety(s), a = s.air;
  const ls = lifeSupportLeft(s);
  // 第 1 章只有逃生艙的三個人、不會有人抵達：不顯示住房上限（「3/4」看起來像還有一個人會來）
  const capText = s.stage >= 2 ? `/${cap}` : '';
  const mobile = useMobile(), short = useShort(), panel = useMobilePanel();
  // 手機：平常收成一條膠囊（人口・閒置・最急的警告），點一下才展開完整面板。
  // 矮畫面的電腦版：平常完整顯示，任務清單展開時才暫時收成膠囊（不然兩個疊在一起）
  if ((mobile && panel.open !== 'colony') || (!mobile && short && panel.open === 'quest')) {
    const warn = AIR_ENABLED && a.hypoxic ? `${resName('oxygen')} 0`
      : s.starving ? `${resName('nutrient')} 0`
      : AIR_ENABLED && oxy < -0.01 ? `${resName('oxygen')} ${fmtTime(s.res.oxygen / -oxy)}`
      : food < -0.01 ? `${resName('nutrient')} ${fmtTime(s.res.nutrient / -food)}`
      : AIR_ENABLED && ls > 0 && ls < 120 ? fmtTime(ls) : '';
    const urgent = (AIR_ENABLED && a.hypoxic) || s.starving;
    return (
      <button type="button" className={'colony-chip px' + (urgent ? ' urgent' : '')} onClick={() => panel.toggle('colony')} aria-expanded={false} aria-label={t('cp.colonists')}>
        <span>👥 <b>{s.pop}</b><small>{capText}</small></span>
        {idle(s) > 0 && <span className="hl">{t('cp.idle')} {idle(s)}</span>}
        {warn && <span className="warn">⚠ {warn}</span>}
        <i aria-hidden="true">▴</i>
      </button>
    );
  }
  return (
    <div className="colony px" onClick={mobile ? () => panel.toggle('colony') : undefined}>
      <div className="row"><span>{t('cp.colonists')}</span><b>{s.pop}<small>{capText}</small></b></div>
      <div className="row"><span>{t('cp.idle')}</span><b className={idle(s) > 0 ? 'hl' : ''}>{idle(s)}</b></div>
      {hurtCivilians(s) > 0 && <div className="row"><span>{t('cp.hurt')}</span><b className="warn">{hurtCivilians(s)}</b></div>}
      {rescueWorkers(s) > 0 && <div className="row"><span>{t('cp.rescue')}</span><b>{rescueWorkers(s)}</b></div>}
      {(s.exp?.team ?? 0) > 0 && <div className="row"><span>{t('cp.exp')}</span><b>{s.exp!.team}</b></div>}
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
      {/* 人口已滿的提示要蓋生活艙；第 1 章不會有人抵達（只有逃生艙的三個人），下一位殖民者與人口已滿都不顯示 */}
      {(s.starving || s.stage >= 2) && (
        <div className="arrival">
          {s.starving ? <span className="warn">{s.starveTime < 60 ? t('cp.starve1', { n: Math.floor(s.starveTime), m: Math.ceil(60 - s.starveTime) }) : t('cp.starve2')}</span>
            : full ? <span className="muted">{t('cp.full')}</span>
            : <span className="muted">{t('cp.next', { t: fmtTime(eta!) })}</span>}
        </div>
      )}
    </div>
  );
}
