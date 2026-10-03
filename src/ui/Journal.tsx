import { useLayoutEffect, useRef } from 'react';
import { useGame, game } from '../store/gameStore';
import { CHAPTERS } from '../engine/story';
import { Msg } from '../engine/state';
import { portraitURL } from '../art/portraitArt';
import { chapterText, sceneLog, t, tm, useLang } from '../i18n';
import { Modal } from './Modals';

type Entry = Msg & { d: number };

/** 一則日誌的文字；沒有日誌段落的對話場景回傳 null */
function entryText(e: Entry): string | null {
  const p = e.p ?? {};
  if (e.k === 'scene') {
    const log = sceneLog(String(p.id));
    return log ? log.replace('{day}', String(e.d)) : null;
  }
  if (e.k === 'log.built') return tm({ k: 'log.built' + (p.v ?? 0), p: { b: p.b } });
  if (e.k === 'log.chapter') {
    const ch = CHAPTERS[Number(p.n) - 1];
    return ch ? t('log.chapter', { n: p.n, title: chapterText(ch).title }) : null;
  }
  return tm(e);
}

// 殖民地日誌：朱諾的口吻，按天數分段
export function Journal() {
  useGame((st) => st.v);
  const open = useGame((st) => st.journal);
  useLang();   // 換語言時重畫
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (open && box.current) box.current.scrollTop = box.current.scrollHeight; }, [open]);
  if (!open) return null;
  const act = useGame.getState();
  const days: { d: number; items: { text: string; head: boolean }[] }[] = [];
  for (const e of game.s.journal?.entries ?? []) {
    const text = entryText(e);
    if (!text) continue;
    if (days.at(-1)?.d !== e.d) days.push({ d: e.d, items: [] });
    days.at(-1)!.items.push({ text, head: e.k === 'log.chapter' });
  }
  return (
    <Modal label={t('log.title')} className="journal">
      <header className="journal-head">
        <img src={portraitURL('juno').url} alt="" />
        <div><h2>{t('log.title')}</h2><small>{t('log.by')}</small></div>
        <button type="button" className="close" onClick={() => act.openJournal(false)} aria-label={t('close')}>×</button>
      </header>
      <div className="journal-body" ref={box}>
        {!days.length && <p className="muted">{t('log.empty')}</p>}
        {days.map((g) => (
          <section key={g.d}>
            <h3>{t('log.day', { n: g.d })}</h3>
            {g.items.map((x, i) => <p key={i} className={x.head ? 'chapter' : ''}>{x.text}</p>)}
          </section>
        ))}
      </div>
    </Modal>
  );
}
