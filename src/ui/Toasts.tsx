import { useEffect, useRef, useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { Notice } from '../engine/state';
import { tm } from '../i18n';

export function Toasts() {
  const v = useGame((st) => st.v);
  const [list, setList] = useState<Notice[]>([]);
  const seen = useRef(0);
  useEffect(() => {
    const fresh = game.s.notices.filter((n) => n.id > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((n) => n.id));
    setList((l) => [...l, ...fresh].slice(-4));
    for (const n of fresh) setTimeout(() => setList((l) => l.filter((x) => x.id !== n.id)), 4200);
  }, [v]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((n) => <div key={n.id} className={'toast px ' + (n.tone ?? '')}>{tm(n.msg)}</div>)}
    </div>
  );
}
