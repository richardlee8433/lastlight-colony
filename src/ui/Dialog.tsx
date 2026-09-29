import { useEffect, useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { SCENES } from '../data/dialogs';
import { portraitURL } from '../art/portraitArt';
import { t, useLang } from '../i18n';
import { sfx } from '../audio/audio';

const CPS = { zh: 28, en: 55 };   // 每秒打出幾個字

// 劇情對話框：左下半身立繪壓在文字框上、名字標籤、逐字打字。點一下跳完這句，再點下一句。不暫停遊戲。
export function Dialog() {
  useGame((st) => st.v);
  const s = game.s, head = s.story.queue?.[0];
  if (!head || s.failed || !SCENES[head.id]) return null;
  return <Scene key={`${head.id}@${head.d}`} id={head.id} day={head.d} />;
}

function Scene({ id, day }: { id: string; day: number }) {
  const lang = useLang(), act = useGame.getState();
  const lines = SCENES[id].lines;
  const [i, setI] = useState(0), [shown, setShown] = useState(0);
  const [who, zh, en] = lines[i];
  const text = (lang === 'zh' ? zh : en).replace('{day}', String(day));
  const typing = shown < text.length;

  useEffect(() => { sfx('ui'); }, []);
  useEffect(() => {
    if (!typing) return;
    const step = setInterval(() => setShown((n) => Math.min(text.length, n + 1)), 1000 / CPS[lang]);
    return () => clearInterval(step);
  }, [typing, text, lang]);

  const next = () => {
    if (typing) return setShown(text.length);
    if (i + 1 < lines.length) { setI(i + 1); setShown(0); } else act.dialogNext();
  };
  const art = portraitURL(who);
  return (
    <div className={'dlg who-' + who} role="dialog" aria-label={t('dlg.label')}>
      <img key={who} className={'dlg-art' + (art.pixel ? ' pixel' : '')} src={art.url} alt="" draggable={false} />
      <div className="dlg-box px" onClick={next} role="button" tabIndex={0} aria-label={t('dlg.next')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } }}>
        <span className="dlg-name">{t('who.' + who)}</span>
        <p aria-live="polite">{text.slice(0, shown)}<span className="dlg-rest" aria-hidden="true">{text.slice(shown)}</span></p>
        {!typing && <i className="dlg-arrow" aria-hidden="true">▼</i>}
        <span className="dlg-count">{i + 1}/{lines.length}</span>
      </div>
      <button type="button" className="dlg-skip" onClick={act.dialogNext}>{t('dlg.skip')} ▸▸</button>
    </div>
  );
}
