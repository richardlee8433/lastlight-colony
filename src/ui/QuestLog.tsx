import { useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { CHAPTERS, currentChapter, goalDone, goalVisible } from '../engine/story';
import { endingChapter } from '../engine/dialog';
import { chapterText, t } from '../i18n';
import { useMobile, useMobilePanel, useShort } from './mobile';

export function QuestLog() {
  useGame((st) => st.v);
  const [own, setOwn] = useState(() => window.innerWidth > 640 && window.innerHeight > 640);
  // 手機：任務欄和殖民地面板同時只展開一個（橫式時兩個疊在一起會蓋住彼此）
  const mobile = useMobile(), short = useShort(), panel = useMobilePanel();
  const shared = mobile || short;   // 手機與矮畫面：跟殖民地面板共用「同時只展開一個」
  const open = shared ? panel.open === 'quest' : own;
  const setOpen = (v: boolean) => (shared ? panel.toggle('quest') : setOwn(v));
  const s = game.s, ending = endingChapter(s);
  // 章末對話還沒播完：任務欄繼續顯示剛結束的那一章（標成完成），播完才換到下一章
  const closing = ending < Math.min(s.stage, CHAPTERS.length);
  const ch = closing ? CHAPTERS[ending - 1] : currentChapter(s);
  if (!ch) return null;
  // 還沒出現的目標不算在分母裡（例如第 4 章第一次襲擊前的營區、醫療艙）
  const shown = ch.goals.filter((g) => goalVisible(s, g));
  const done = shown.filter((g) => goalDone(s, g)).length, tx = chapterText(ch);
  const next = s.finished || closing ? undefined : shown.find((g) => !goalDone(s, g));
  return (
    <div className="quest px">
      <button type="button" className="quest-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chip-ch">{t('ch.n', { n: ch.chapter })}</span>
        <b>{tx.title}</b>
        <span className="quest-count">{s.finished || closing ? t('ql.done') : `${done}/${shown.length}`}</span>
      </button>
      {/* 收起時（v0.70.8）：下面固定顯示一行目前該做的目標，點一下展開整張清單 */}
      {!open && next && (
        <button type="button" className="quest-next" onClick={() => setOpen(true)}>{tx.goals[ch.goals.indexOf(next)]}</button>
      )}
      {open && (
        <ul>
          {ch.goals.map((g, i) => {
            if (!goalVisible(s, g)) return null;
            const ok = goalDone(s, g);
            return <li key={g.gid} className={ok ? 'ok' : ''}><i aria-hidden="true">{ok ? '✓' : ''}</i>{tx.goals[i]}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
