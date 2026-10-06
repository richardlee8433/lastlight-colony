import { game } from '../store/gameStore';
import { Cost, ResKey } from '../engine/state';
import { lang, resName, t } from '../i18n';
import { storageCap } from '../engine/formulas';
import { iconURL, paintedIcon } from './assets';

export const fmt = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  if (a >= 100 || Number.isInteger(n)) return String(Math.floor(n));
  return n.toFixed(1);
};
export const fmtTime = (sec: number) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (lang() === 'ja') return h ? `${h}時間${m}分` : m ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
  if (lang() === 'zh') return h ? `${h} 小時 ${m} 分` : m ? `${m} 分 ${String(s).padStart(2, '0')} 秒` : `${s} 秒`;
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
};

export function Icon({ k, size = 18 }: { k: string; size?: number }) {
  return <img className={'icon' + (paintedIcon(k) ? ' painted' : '')} src={iconURL(k)} width={size} height={size} alt="" />;
}

export function CostList({ cost }: { cost: Cost }) {
  const s = game.s, cap = storageCap(s);
  const entries = Object.entries(cost).filter(([, v]) => v) as [ResKey, number][];
  const over = entries.some(([, v]) => v > cap);
  return (
    <div className="cost">
      {entries.map(([k, v]) => (
        <span key={k} className={'cost-item' + (s.res[k] >= v ? '' : ' short')} title={resName(k)}>
          <Icon k={k} size={14} />{fmt(v)}
        </span>
      ))}
      {over && <span className="cost-warn">{t('cost.over', { n: cap })}</span>}
    </div>
  );
}

export function Bar({ value, tone }: { value: number; tone?: string }) {
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} className={tone} /></div>;
}
