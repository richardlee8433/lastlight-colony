import { useEffect, useRef, useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { Notice } from '../engine/state';
import { tm } from '../i18n';
import { Sfx, sfx } from '../audio/audio';

// 通知對應的音效；沒列在這裡的依語氣（好消息／警告）
const SOUND: Record<string, Sfx> = {
  'n.raidWarn': 'alarm', 'n.built': 'build', 'n.levelUp': 'build', 'n.node': 'build', 'n.cmdBuilt': 'stage',
  'n.research': 'research', 'n.raidWon': 'win', 'n.raidLost': 'lose', 'n.raidNoDef': 'lose', 'n.boost': 'boost',
  'n.beaconPhase': 'build', 'n.beaconDone': 'finale', 'n.hypoxia': 'alarm', 'n.airBack': 'good', 'n.collapsed': 'warn', 'n.lsGrace': 'alarm',
};

export function Toasts() {
  const v = useGame((st) => st.v);
  const [list, setList] = useState<Notice[]>([]);
  const seen = useRef(0);
  useEffect(() => {
    const fresh = game.s.notices.filter((n) => n.id > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((n) => n.id));
    setList((l) => [...l, ...fresh].slice(-4));
    const last = fresh[fresh.length - 1];
    sfx(SOUND[last.msg.k] ?? (last.tone === 'warn' ? 'warn' : 'good'));
    for (const n of fresh) setTimeout(() => setList((l) => l.filter((x) => x.id !== n.id)), 4200);
  }, [v]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((n) => <div key={n.id} className={'toast px ' + (n.tone ?? '')}>{tm(n.msg)}</div>)}
    </div>
  );
}
