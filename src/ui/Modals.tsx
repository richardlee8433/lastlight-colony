import { useEffect, useState } from 'react';
import { useGame, game, modalHold } from '../store/gameStore';
import { RES_KEYS, ResKey } from '../engine/state';
import { canAfford, idle } from '../engine/formulas';
import { CHAPTERS } from '../engine/story';
import { chapterEndPending, endingQueued } from '../engine/dialog';
import { bName, chapterText, costText, eventText, raidName, resName, t, tm, useLang } from '../i18n';
import { Icon, fmt, fmtTime } from './common';
import { playVoice } from '../audio/audio';
import { introVoiceFile } from '../data/voices';
import { mods, shipReady } from '../engine/ship';
import { shipLabel } from './ShipPanel';

export function Modal({ children, label, className = '', pause = true }: { children: React.ReactNode; label: string; className?: string; pause?: boolean }) {
  // 訊息視窗開著時遊戲暫停；pause=false 的視窗（例如科技樹）開著時時間照常走
  useEffect(() => { if (!pause) return; modalHold.n++; return () => { modalHold.n--; }; }, [pause]);
  return <div className="modal-bg"><div className={'modal px ' + className} role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}

export function Modals() {
  useGame((st) => st.v);
  const offline = useGame((st) => st.offline);
  const title = useGame((st) => st.title);
  const [finishSeen, setFinishSeen] = useState(false);
  const s = game.s, act = useGame.getState();
  const chIdx = Math.min(s.stage, CHAPTERS.length);
  if (title) return null;

  if (s.failed) {
    return (
      <Modal label={t('fail.eyebrow')}>
        <p className="eyebrow">{t('fail.eyebrow')}</p>
        <h2>{t('fail.title')}</h2>
        <p>{t(s.failReason === 'air' ? 'fail.textAir' : 'fail.text')}</p>
        <ul className="gains">
          <li>{t('fail.lasted')} <b>{fmtTime(s.t)}</b></li>
          <li>{t('fail.reached')} <b>{t('ch.n', { n: Math.min(s.stage, CHAPTERS.length) })}</b></li>
        </ul>
        <div className="choices">
          <button type="button" className="btn wide" onClick={act.restoreCheckpoint}>{t('fail.checkpoint')}</button>
          <button type="button" className="btn wide alt" onClick={act.reset}>{t('fail.restart')}</button>
        </div>
      </Modal>
    );
  }

  if (offline) {
    const gains = RES_KEYS.filter((k) => offline.gains[k] > 0.5) as ResKey[];
    return (
      <Modal label={t('off.label')}>
        <p className="eyebrow">{t('off.eyebrow')}</p>
        <h2>{t('off.title', { t: fmtTime(offline.seconds) })}</h2>
        <p>{t('off.text')}</p>
        <ul className="gains">
          {gains.map((k) => <li key={k}><Icon k={k} /> {resName(k)} <b>+{fmt(offline.gains[k])}</b></li>)}
          {offline.pop > 0 && <li>{t('off.pop')} <b>+{offline.pop}</b></li>}
          {!gains.length && !offline.pop && <li className="muted">{t('off.none')}</li>}
        </ul>
        <button type="button" className="btn wide" onClick={act.closeOffline}>{t('off.ok')}</button>
      </Modal>
    );
  }

  if (!s.finished && s.story.seenIntro < chIdx && !chapterEndPending(s)) {
    const ch = CHAPTERS[chIdx - 1], tx = chapterText(ch);
    return (
      <Modal label={t('ch.n', { n: ch.chapter })}>
        <p className="eyebrow">{t('ch.n', { n: ch.chapter })}</p>
        <h2>{tx.title}<small>{tx.subtitle}</small></h2>
        <IntroVoice chapter={ch.chapter} />
        {tx.intro.map((p) => <p key={p}>{p}</p>)}
        {ch.chapter === 1 && <p className="hint">{t('intro.hint')}</p>}
        <button type="button" className="btn wide" onClick={act.seenIntro}>{t(ch.chapter === 1 ? 'intro.start' : 'intro.next')}</button>
      </Modal>
    );
  }

  if (s.finished && !finishSeen && endingQueued(s) && !chapterEndPending(s)) {
    return (
      <Modal label={t('fin.eyebrow')}>
        <p className="eyebrow">{t('fin.eyebrow')}</p>
        <h2>{t(s.story.choice6 === 'leave' ? 'fin.titleLeave' : 'fin.title')}</h2>
        <p>{t(s.story.choice6 === 'leave' ? 'fin.textLeave' : 'fin.text')}</p>
        <p className="fin-part">{t('fin.part')}</p>
        <ul className="gains">
          <li>{t('fin.time')} <b>{fmtTime(s.t)}</b></li>
          <li>{t('fin.pop')} <b>{s.pop}</b></li>
          <li>{t('fin.clicks', { n: s.stats.clicks, c: s.stats.crits })}</li>
        </ul>
        <p className="muted">{t('fin.more')}</p>
        <button type="button" className="btn wide" onClick={() => setFinishSeen(true)}>{t('fin.ok')}</button>
      </Modal>
    );
  }

  const br = s.raid?.report;
  if (br) {
    const kind = br.kind ?? 'alien', p = { kind: raidName(kind), unit: t('unit.' + kind), n: br.enemies };
    const fought = br.guards || br.turrets;
    return (
      <Modal label={t('br.label')}>
        <p className="eyebrow">{t('br.eyebrow', { n: br.raid })}</p>
        <h2>{br.won ? t('br.won', p) : fought ? t('br.lost') : t('br.noDef')}</h2>
        <p>{fought ? t('br.fought', { ...p, g: br.guards, a: br.armed }) + (br.turrets ? t('br.turrets', { t: br.turrets }) : '') + t('br.vs', p) : t('br.overrun', p)}</p>
        {br.rounds.length > 1 && (
          <ol className="rounds" aria-label={t('br.rounds')}>
            {br.rounds.map((r, i) => (
              <li key={i}>
                <span>{i === 0 ? t('br.start') : t('br.round', { n: i })}</span>
                <div className="duel">
                  <i className="ours" style={{ width: `${(r.ours / Math.max(1, r.oursMax)) * 100}%` }} />
                  <i className="theirs" style={{ width: `${(r.theirs / Math.max(1, r.theirsMax)) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
        {br.rounds.length > 1 && <p className="legend-duel"><i className="ours" />{t('br.oursHp')}　<i className="theirs" />{t('br.theirsHp')}</p>}
        <ul className="gains">{br.lines.map((l, i) => <li key={i}>{tm(l)}</li>)}</ul>
        <button type="button" className="btn wide" onClick={act.dismissBattle}>{t('ok')}</button>
      </Modal>
    );
  }

  const rep = s.events.report;
  if (rep) {
    // 提示類（例如第一次有人受傷）：多一個按鈕直接帶到相關建築
    const tip = typeof rep.title === 'object' && rep.title.k === 'tip.medTitle';
    return (
      <Modal label={tm(rep.title)}>
        <p className="eyebrow">{t(tip ? 'tip.eyebrow' : 'ev.result')}</p>
        <h2>{tm(rep.title)}</h2>
        <p>{tm(rep.text)}</p>
        {rep.gains.length > 0 && <ul className="gains">{rep.gains.map((g, i) => <li key={i}>{tm(g)}</li>)}</ul>}
        {tip ? (
          <div className="choices">
            <button type="button" className="btn wide" onClick={() => { act.dismissReport(); act.focusOn('med_bay'); }}>{t('tip.medGo')}</button>
            <button type="button" className="btn wide alt" onClick={act.dismissReport}>{t('ok')}</button>
          </div>
        ) : <button type="button" className="btn wide" onClick={act.dismissReport}>{t('ok')}</button>}
      </Modal>
    );
  }

  const ev = s.events.active;
  // 劇情對話播完才跳出事件（例如使者要答覆、第 6 章的抉擇），避免視窗蓋住對話
  if (ev && !s.story.queue?.length) {
    const E = eventText(ev.kind);
    const bname = ev.target ? bName(ev.target) : '';
    const dm = s.gov?.corp.demand;
    const demand = dm ? costText(dm) : '';
    const fill = (x: string) => x.replace(/\{building\}/g, bname).replace('{cost}', String(ev.cost ?? '')).replace(/\{demand\}/g, demand).replace('{refusals}', String(s.gov?.corp.refusals ?? 0));
    const blocked = (i: number) => (ev.kind === 'envoy' && i === 0 && dm && !canAfford(s, dm)) ? t('why.afford')
      : (ev.kind === 'meteor' && i === 0 && !canAfford(s, { rock: ev.cost! })) ? t('ev.noRock')
      : (ev.kind === 'rescue' && i === 0 && idle(s) < 2) ? t('ev.noIdle')
      : (ev.kind === 'choice6' && i === 0 && !shipReady(s)) ? t('ev.shipNotReady', { ship: shipLabel(s), n: mods(s) }) : null;
    return (
      <Modal label={E.title}>
        <p className="eyebrow">{t('ev.eyebrow')}</p>
        <h2>{E.title}</h2>
        <p>{fill(E.text)}</p>
        <div className="choices">
          {E.options.map((o, i) => (
            <button key={o} type="button" className={'btn wide' + (i ? ' alt' : '')} disabled={!!blocked(i)} onClick={() => act.choose(i)}>
              {fill(o)}{blocked(i) ? t('paren', { x: blocked(i) }) : ''}
            </button>
          ))}
        </div>
      </Modal>
    );
  }
  return null;
}

/** 章節開場說明出現時播旁白配音（有錄的章才有），按開始、關掉就停 */
function IntroVoice({ chapter }: { chapter: number }) {
  const lang = useLang();
  useEffect(() => { playVoice(introVoiceFile(chapter, lang)); return () => playVoice(null); }, [chapter, lang]);
  return null;
}
