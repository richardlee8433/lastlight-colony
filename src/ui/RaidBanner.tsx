import { useGame, game } from '../store/gameStore';
import { defense, raidFor } from '../engine/combat';
import { raidName, t } from '../i18n';
import { fmtTime } from './common';

// 襲擊預警：階段 4 起顯示下一次襲擊倒數；預警期間變成紅色警報，並比較雙方戰力
export function RaidBanner() {
  useGame((st) => st.v);
  const s = game.s, r = s.raid;
  if (s.stage < 4 || s.finished || r.nextAt < 0) return null;
  const inc = r.incoming, d = defense(s);
  const e = inc ?? { ...raidFor(s), at: r.nextAt };
  const kind = e.kind ?? 'alien', p = { kind: raidName(kind), unit: t('unit.' + kind) };
  const eAtk = e.enemies * e.atk, eHp = e.enemies * e.hp;
  const odds = t(d.ready === 0 && !d.turrets ? 'rb.noGuards' : d.atk * 3 >= eHp && d.hp >= eAtk * 1.5 ? 'rb.ahead' : d.atk * 5 >= eHp ? 'rb.even' : 'rb.behind');
  return (
    <div className={'raid px' + (inc ? ' alert' : '')} role={inc ? 'alert' : 'status'}>
      <b>{inc ? t('rb.incoming', { ...p, n: inc.enemies, s: Math.ceil(inc.at - s.t) }) : t('rb.next', { ...p, n: e.enemies, t: fmtTime(r.nextAt - s.t) })}</b>
      {inc && <button type="button" className="btn raid-look" onClick={() => useGame.getState().lookAtRaid()}>{t('rb.show')}</button>}
      <span>{t('rb.ours', { r: d.ready, g: d.guards, a: d.armedReady })}{d.turrets ? t('rb.turrets', { n: d.turrets }) : ''} · {t('rb.power', { a: Math.round(d.atk), h: Math.round(d.hp), ea: Math.round(eAtk), eh: Math.round(eHp) })} · {odds}</span>
    </div>
  );
}
