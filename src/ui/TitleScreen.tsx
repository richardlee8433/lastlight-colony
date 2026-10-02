import { useEffect, useMemo, useState } from 'react';
import { trackStart } from '../analytics';
import { useGame, game } from '../store/gameStore';
import { CHAPTERS } from '../engine/story';
import { dayOf } from '../engine/dialog';
import { LANGS, chapterText, t, useLang, useSettings } from '../i18n';
import { Modal } from './Modals';
import { VERSION } from './Settings';
import bg from '../assets/title.webp';
import { setMood, setTitleMusic } from '../audio/audio';

const W = 1672, H = 941;          // 背景圖原始尺寸（光點位置用圖上的百分比）
const FOCUS_X = 0.6, FOCUS_Y = 0.59;   // 營地在圖上的位置（手機直式畫面裁切時以它為中心）
// 會呼吸的光：晶簇（紫）、營地（橘）、末光號上的信號燈（紅）
const GLOWS: { x: number; y: number; r: number; c: string; d: number }[] = [
  { x: 97, y: 44, r: 7, c: 'violet', d: 0 }, { x: 96, y: 72, r: 8, c: 'violet', d: 1.3 }, { x: 77, y: 52, r: 5, c: 'violet', d: 2.1 },
  { x: 22, y: 57, r: 5, c: 'violet', d: 0.7 }, { x: 65, y: 35, r: 4, c: 'violet', d: 1.8 }, { x: 85, y: 32, r: 4, c: 'violet', d: 2.6 },
  { x: 59, y: 59, r: 9, c: 'amber', d: 0.4 },
];

// 首頁：繼續遊戲／新遊戲／殖民地日誌／設定／關於。開著時遊戲暫停。
export function TitleScreen() {
  useGame((st) => st.v);
  const open = useGame((st) => st.title);
  // 首頁主題曲：首頁開著時播放，進入遊戲後淡出（瀏覽器規定第一次點擊後才會出聲）
  useEffect(() => {
    if (!open) setMood({ stage: Math.min(6, game.s.stage), raid: !!game.s.raid?.incoming, finished: game.s.finished });
    setTitleMusic(open);
  }, [open]);
  const lang = useLang(), setLang = useSettings((st) => st.setLang);
  const [confirm, setConfirm] = useState(false), [about, setAbout] = useState(false);
  const box = useCover();
  const stars = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ x: (i * 37.7) % 100, y: ((i * 53.3) % 38) + 1, s: 1 + (i % 3), d: (i * 0.61) % 4 })), []);
  if (!open) return null;
  const s = game.s, act = useGame.getState();
  const hasSave = s.t > 5 || s.story.seenIntro > 0;
  const ch = CHAPTERS[Math.min(s.stage, CHAPTERS.length) - 1];
  const start = () => { trackStart(game.s, !hasSave); act.closeTitle(); };
  const fresh = () => { act.reset(); trackStart(game.s, true); act.closeTitle(); };

  return (
    <div className="title-screen">
      <div className="title-bg" style={box} aria-hidden="true">
        <img src={bg} alt="" draggable={false} />
        {stars.map((st, i) => <i key={i} className="star" style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animationDelay: `${st.d}s` }} />)}
        {GLOWS.map((g, i) => <i key={'g' + i} className={'glow ' + g.c} style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.r}%`, animationDelay: `${g.d}s` }} />)}
        <i className="beacon-light" style={{ left: '92.2%', top: '15.6%' }} />
      </div>
      <div className="title-shade" aria-hidden="true" />

      <div className="title-lang" role="radiogroup" aria-label={t('set.lang')}>
        {LANGS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={lang === l.id} className={lang === l.id ? 'on' : ''}
            lang={l.id === 'zh' ? 'zh-Hant' : 'en'} onClick={() => { setLang(l.id); act.bump(); }}>{l.id === 'zh' ? '中文' : 'EN'}</button>
        ))}
      </div>

      <div className="title-main">
      <header className="title-logo">
        <h1>Lastlight Colony</h1>
        <p>{t('title.tagline')}</p>
      </header>

      <nav className="title-menu" aria-label={t('title.menu')}>
        {hasSave && (
          <button type="button" className="tm-btn main" onClick={start} autoFocus>
            {t('title.continue')}
            <small>{t('ch.n', { n: ch.chapter })} {chapterText(ch).title} · {t('log.day', { n: dayOf(s.t) })} · {t('title.pop', { n: s.pop })}</small>
          </button>
        )}
        {!confirm
          ? <button type="button" className={'tm-btn' + (hasSave ? '' : ' main')} onClick={() => (hasSave ? setConfirm(true) : start())} autoFocus={!hasSave}>{t('title.new')}</button>
          : <div className="tm-confirm px">
              <p>{t('title.overwrite')}</p>
              <div className="row">
                <button type="button" className="btn danger" onClick={fresh}>{t('title.newYes')}</button>
                <button type="button" className="btn alt" onClick={() => setConfirm(false)}>{t('cancel')}</button>
              </div>
            </div>}
        {hasSave && <button type="button" className="tm-btn" onClick={() => act.openJournal(true)}>{t('log.title')}</button>}
        <button type="button" className="tm-btn" onClick={() => act.openSettings(true)}>{t('set.title')}</button>
        <button type="button" className="tm-btn" onClick={() => setAbout(true)}>{t('set.about')}</button>
      </nav>
      </div>
      <span className="title-ver">v{VERSION}</span>

      {about && (
        <Modal label={t('set.about')} className="settings-page">
          <header className="trade-head">
            <h2>{t('set.about')}</h2>
            <button type="button" className="close" onClick={() => setAbout(false)} aria-label={t('close')}>×</button>
          </header>
          <p>{t('title.about')}</p>
          <p className="small">{t('set.aboutText', { v: VERSION })}</p>
          <p className="small"><a href="https://github.com/richardlee8433/lastlight-colony" target="_blank" rel="noreferrer">github.com/richardlee8433/lastlight-colony</a></p>
          <button type="button" className="btn wide" onClick={() => setAbout(false)}>{t('ok')}</button>
        </Modal>
      )}
    </div>
  );
}

/** 背景圖鋪滿畫面（像 object-fit: cover），手機直式時以營地為中心裁切；光點跟著圖一起縮放 */
function useCover() {
  const [vp, setVp] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: innerWidth, h: innerHeight });
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  // 直式畫面：圖放大一點並往上移，讓營地落在標題和選單之間
  const portrait = vp.w < vp.h;
  const k = Math.max(vp.w / W, vp.h / H) * (portrait ? 1.2 : 1), w = W * k, h = H * k;
  const left = Math.min(0, Math.max(vp.w - w, vp.w / 2 - w * FOCUS_X));
  const top = portrait ? Math.min(0, Math.max(vp.h - h, vp.h * 0.4 - h * FOCUS_Y)) : (vp.h - h) / 2;
  return { width: w, height: h, left, top };
}
