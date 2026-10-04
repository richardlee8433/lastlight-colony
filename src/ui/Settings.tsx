import { LangPicker } from './LangPicker';
import { useEffect, useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { CHAPTERS } from '../engine/story';
import { built } from '../engine/formulas';
import { t, useLang, useSettings } from '../i18n';
import { fmtTime } from './common';
import { Modal } from './Modals';
import { sfx, useAudio } from '../audio/audio';

export const VERSION = '0.69.3';

// 設定頁：語言、存檔、重新開始、關於
export function Settings() {
  useGame((st) => st.v);
  useLang();   // 換語言時重畫
  const dayNight = useSettings((st) => st.dayNight), setDayNight = useSettings((st) => st.setDayNight);
  const analytics = useSettings((st) => st.analytics), setAnalytics = useSettings((st) => st.setAnalytics);
  const open = useGame((st) => st.settings), [confirm, setConfirm] = useState(false);
  const act = useGame.getState(), s = game.s;
  const audio = useAudio();
  const close = () => { act.openSettings(false); setConfirm(false); };
  const paused = useGame((st) => st.paused);
  // P 或空白鍵：暫停／繼續（焦點在按鈕或輸入框上時空白鍵照原本的用途）
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement?.tagName;
      if (e.key === 'p' || e.key === 'P' || (e.key === ' ' && el !== 'BUTTON' && el !== 'INPUT' && el !== 'TEXTAREA')) {
        if (useGame.getState().title) return;
        e.preventDefault(); act.setPaused(!useGame.getState().paused);
      }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [act]);
  return (
    <>
      <div className="settings">
        {built(s, 'databank') && <button type="button" className="btn tech-btn" onClick={() => act.openTech(true)} title={t('tt.title')}>{t('tt.short')}{s.research.active ? ' ●' : ''}</button>}
        <button type="button" className={'btn sq pause-btn' + (paused ? ' on' : '')} onClick={() => act.setPaused(!paused)}
          aria-label={t(paused ? 'pause.resume' : 'pause.pause')} aria-pressed={paused} title={t(paused ? 'pause.resume' : 'pause.pause') + ' (P)'}>{paused ? '▶' : '❚❚'}</button>
        <button type="button" className="btn tech-btn" onClick={() => act.openJournal(true)} title={t('log.title')}>{t('log.short')}</button>
        <button type="button" className="btn sq gear" onClick={() => act.openSettings(true)} aria-label={t('set.title')} title={t('set.title')}>≡</button>
      </div>
      {paused && (
        <>
          {/* 暫停時整個畫面蓋一層薄黑幕，擋住採集、點建築等所有操作；點任何地方就繼續 */}
          <div className="paused-veil" onClick={() => act.setPaused(false)} aria-hidden="true" />
          <button type="button" className="paused-banner px" onClick={() => act.setPaused(false)}>
            <b>{t('pause.banner')}</b><small>{t('pause.hint')}</small>
          </button>
        </>
      )}
      {open && (
        <Modal label={t('set.title')} className="settings-page">
          <header className="trade-head">
            <h2>{t('set.title')}</h2>
            <button type="button" className="close" onClick={close} aria-label={t('close')}>×</button>
          </header>

          <section className="block">
            <h3>{t('set.lang')}</h3>
            <LangPicker />
          </section>

          <section className="block">
            <h3>{t('set.audio')}</h3>
            <label className="slider"><span>{t('set.music')}</span>
              <input type="range" min={0} max={100} value={Math.round(audio.music * 100)} onChange={(e) => audio.set({ music: +e.target.value / 100 })} aria-label={t('set.music')} />
              <b>{Math.round(audio.music * 100)}</b></label>
            <label className="slider"><span>{t('set.sfx')}</span>
              <input type="range" min={0} max={100} value={Math.round(audio.sfx * 100)} onChange={(e) => audio.set({ sfx: +e.target.value / 100 })} onPointerUp={() => sfx('collect')} aria-label={t('set.sfx')} />
              <b>{Math.round(audio.sfx * 100)}</b></label>
            <label className="slider"><span>{t('set.voice')}</span>
              <input type="range" min={0} max={100} value={Math.round(audio.voice * 100)} onChange={(e) => audio.set({ voice: +e.target.value / 100 })} aria-label={t('set.voice')} />
              <b>{Math.round(audio.voice * 100)}</b></label>
            <label className="check"><input type="checkbox" checked={audio.muted} onChange={(e) => audio.set({ muted: e.target.checked })} /> {t('set.mute')}</label>
          </section>

          <section className="block">
            <h3>{t('set.display')}</h3>
            <label className="check"><input type="checkbox" checked={dayNight} onChange={(e) => setDayNight(e.target.checked)} /> {t('set.dayNight')}</label>
            <p className="muted small">{t('set.dayNightHint')}</p>
          </section>

          <section className="block">
            <h3>{t('set.privacy')}</h3>
            <label className="check"><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> {t('set.analytics')}</label>
            <p className="muted small">{t('set.analyticsHint')}</p>
          </section>

          <section className="block">
            <h3>{t('set.save')}</h3>
            <dl className="stats">
              <div><dt>{t('set.chapter')}</dt><dd>{t('ch.n', { n: Math.min(s.stage, CHAPTERS.length) })}</dd></div>
              <div><dt>{t('fin.time')}</dt><dd>{fmtTime(s.t)}</dd></div>
              <div><dt>{t('set.lastSaved')}</dt><dd>{t('set.ago', { t: fmtTime((Date.now() - s.lastSaved) / 1000) })}</dd></div>
            </dl>
            <p className="muted small">{t('set.saveInfo')}</p>
            <button type="button" className="btn wide alt" onClick={act.saveNow}>{t('set.saveNow')}</button>
          </section>

          <section className="block">
            <h3>{t('set.restart')}</h3>
            {!confirm
              ? <button type="button" className="btn wide alt" onClick={() => setConfirm(true)}>{t('set.restartBtn')}</button>
              : <>
                  <p className="warn">{t('set.confirm')}</p>
                  <div className="choices">
                    <button type="button" className="btn wide danger" onClick={() => { act.reset(); close(); }}>{t('set.confirmYes')}</button>
                    <button type="button" className="btn wide alt" onClick={() => setConfirm(false)}>{t('cancel')}</button>
                  </div>
                </>}
          </section>

          <section className="block about">
            <h3>{t('set.about')}</h3>
            <p className="small">{t('set.aboutText', { v: VERSION })}</p>
            <p className="small"><a href="https://github.com/richardlee8433/lastlight-colony" target="_blank" rel="noreferrer">github.com/richardlee8433/lastlight-colony</a></p>
          </section>
        </Modal>
      )}
    </>
  );
}
