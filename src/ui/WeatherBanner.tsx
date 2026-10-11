import { useGame, game } from '../store/gameStore';
import { t } from '../i18n';
import { CLEAR_CLICKS, dustClogged } from '../engine/weather';

// 天氣：預告（開始前 30 秒）與進行中（剩幾秒、效果）；放在襲擊預警下面
export function WeatherBanner() {
  useGame((st) => st.v);
  const s = game.s, w = s.weather;
  if (!w || s.finished) return null;
  if (w.k) {
    const eff = w.k === 'dust' ? (dustClogged(s) ? t('wb.eff.dust', { n: w.cleared ?? 0, m: CLEAR_CLICKS }) : t('wb.eff.dustOk')) : t('wb.eff.' + w.k);
    return (
      <div className={'weather px w-' + w.k} role="status">
        <b>{t('wb.now', { w: t('wb.name.' + w.k), s: Math.max(0, Math.ceil(w.until - s.t)) })}</b>
        <span>{eff}</span>
      </div>
    );
  }
  if (w.pending) return (
    <div className={'weather px soon w-' + w.pending} role="status">
      <b>{t('wb.soon', { w: t('wb.name.' + w.pending), s: Math.max(0, Math.ceil(w.next - s.t)) })}</b>
    </div>
  );
  return null;
}
