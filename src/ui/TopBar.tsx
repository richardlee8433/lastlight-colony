import { useEffect, useRef } from 'react';
import { useGame, game } from '../store/gameStore';
import { RES_KEYS, RES_UNLOCK, UNCAPPED } from '../engine/state';
import { resName, t } from '../i18n';
import { netRates, storageCap } from '../engine/formulas';
import { Icon, fmt } from './common';

export function TopBar() {
  useGame((st) => st.v);
  const s = game.s, cap = storageCap(s), rates = netRates(s);
  const bar = useRef<HTMLDivElement>(null);
  // 右上角的按鈕（科技、暫停、日誌、選單）寬度會變：量好寫進 --set-w，資源列的右邊界避開它，放不下的部分橫向捲動
  useEffect(() => {
    const el = document.querySelector('.settings') as HTMLElement | null, root = bar.current?.parentElement;
    if (!el || !root) return;
    const fit = () => root.style.setProperty('--set-w', `${Math.ceil(el.getBoundingClientRect().width)}px`);
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 滑鼠滾輪（上下）也能左右捲動資源列
  const wheel = (e: React.WheelEvent) => { const el = bar.current; if (el && el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY; };
  return (
    <div className="topbar px" ref={bar} onWheel={wheel}>
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
