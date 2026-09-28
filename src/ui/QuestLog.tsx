import { useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { currentChapter, goalDone } from '../engine/story';

export function QuestLog() {
  useGame((st) => st.v);
  const [open, setOpen] = useState(() => window.innerWidth > 640);
  const s = game.s, ch = currentChapter(s);
  if (!ch) return null;
  const done = ch.goals.filter((g) => goalDone(s, g)).length;
  return (
    <div className="quest px">
      <button type="button" className="quest-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chip-ch">第 {ch.chapter} 章</span>
        <b>{ch.title}</b>
        <span className="quest-count">{s.finished ? '完成' : `${done}/${ch.goals.length}`}</span>
      </button>
      {open && (
        <ul>
          {ch.goals.map((g) => {
            const ok = goalDone(s, g);
            return <li key={g.label} className={ok ? 'ok' : ''}><i aria-hidden="true">{ok ? '✓' : ''}</i>{g.label}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
