import { useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { CHAPTERS, currentChapter, goalDone } from '../engine/story';
import { endingChapter } from '../engine/dialog';
import { chapterText, t } from '../i18n';

export function QuestLog() {
  useGame((st) => st.v);
  const [open, setOpen] = useState(() => window.innerWidth > 640);
  const s = game.s, ending = endingChapter(s);
  // 章末對話還沒播完：任務欄繼續顯示剛結束的那一章（標成完成），播完才換到下一章
  const closing = ending < Math.min(s.stage, CHAPTERS.length);
  const ch = closing ? CHAPTERS[ending - 1] : currentChapter(s);
  if (!ch) return null;
  const done = ch.goals.filter((g) => goalDone(s, g)).length, tx = chapterText(ch);
  return (
    <div className="quest px">
      <button type="button" className="quest-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chip-ch">{t('ch.n', { n: ch.chapter })}</span>
        <b>{tx.title}</b>
        <span className="quest-count">{s.finished || closing ? t('ql.done') : `${done}/${ch.goals.length}`}</span>
      </button>
      {open && (
        <ul>
          {ch.goals.map((g, i) => {
            const ok = goalDone(s, g);
            return <li key={g.gid} className={ok ? 'ok' : ''}><i aria-hidden="true">{ok ? '✓' : ''}</i>{tx.goals[i]}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
