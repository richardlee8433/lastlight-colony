import { useEffect, useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { SCENES } from '../data/dialogs';
import { endOfChapter, lineOk } from '../engine/dialog';
import { CHARACTERS, CharacterId, portraitURL } from '../art/portraitArt';
import { sceneLine, t, useLang } from '../i18n';
import { sfx, playVoice } from '../audio/audio';
import { voiceFile } from '../data/voices';
import { lineMood } from '../data/moods';

const CPS = { zh: 28, en: 55 };   // 每秒打出幾個字

// 劇情對話框：左下半身立繪壓在文字框上、名字標籤、逐字打字。點一下跳完這句，再點下一句。
// 對話期間遊戲暫停（見 gameStore 的時間累加器），畫面稍微變暗、點任何地方都能翻頁；播完自動繼續。
export function Dialog() {
  useGame((st) => st.v);
  const title = useGame((st) => st.title);
  const s = game.s, head = s.story.queue?.[0];
  if (title || !head || s.failed || !SCENES[head.id]) return null;
  return <Scene key={`${head.id}@${head.d}`} id={head.id} day={head.d} />;
}

function Scene({ id, day }: { id: string; day: number }) {
  const lang = useLang(), act = useGame.getState();
  // 只播符合目前路線的台詞（第 5～6 章的分支）
  const lines = SCENES[id].lines.filter((l) => lineOk(game.s, l[3]));
  const [i, setI] = useState(0), [shown, setShown] = useState(0);
  const [who] = lines[i];
  // 原始台詞編號（路線過濾掉的不影響）：翻譯與配音都用它對應
  const idx = SCENES[id].lines.indexOf(lines[i]);
  const text = sceneLine(id, idx, lang).replace('{day}', String(day));
  const typing = shown < text.length;

  useEffect(() => { sfx('ui'); }, []);
  // 有配音的台詞：換到這句時播，翻頁、跳過或關掉對話時停（用原始台詞編號，路線過濾掉的不影響）
  useEffect(() => { playVoice(voiceFile(id, idx, lang)); return () => playVoice(null); }, [id, idx, lang]);
  useEffect(() => {
    if (!typing) return;
    const step = setInterval(() => setShown((n) => Math.min(text.length, n + 1)), 1000 / CPS[lang]);
    return () => clearInterval(step);
  }, [typing, text, lang]);

  const next = () => {
    if (typing) return setShown(text.length);
    if (i + 1 < lines.length) { setI(i + 1); setShown(0); } else act.dialogNext();
  };
  // 主要角色有立繪；一般殖民者和旁白（narr）沒有立繪，用旁白樣式
  const hasArt = (CHARACTERS as readonly string[]).includes(who);
  const art = hasArt ? portraitURL(who as CharacterId, lineMood(id, idx)) : null;
  return (
    <>
    <div className="dlg-veil" onClick={next} aria-hidden="true" />
    <div className={'dlg who-' + who + (hasArt ? '' : ' plain')} role="dialog" aria-label={t('dlg.label')}>
      {art && <img key={who} className={'dlg-art' + (art.pixel ? ' pixel' : '')} src={art.url} alt="" draggable={false} />}
      <div className="dlg-box px" onClick={next} role="button" tabIndex={0} aria-label={t('dlg.next')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } }}>
        {who !== 'narr' && <span className="dlg-name">{t('who.' + who)}</span>}
        {endOfChapter(id) > 0 && <span className="dlg-ch">{t('dlg.chEnd', { n: endOfChapter(id) })}</span>}
        <p aria-live="polite">{text.slice(0, shown)}<span className="dlg-rest" aria-hidden="true">{text.slice(shown)}</span></p>
        {!typing && <i className="dlg-arrow" aria-hidden="true">▼</i>}
        <span className="dlg-count">{i + 1}/{lines.length}</span>
      </div>
      <button type="button" className="dlg-skip" onClick={act.dialogNext}>{t('dlg.skip')} ▸▸</button>
    </div>
    </>
  );
}
