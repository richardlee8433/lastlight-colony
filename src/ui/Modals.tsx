import { useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { DEF, RES_KEYS, RES_NAME, ResKey } from '../engine/state';
import { canAfford, idle } from '../engine/formulas';
import { CHAPTERS } from '../engine/story';
import EVENTS from '../data/events.json';
import { Icon, fmt, fmtTime } from './common';

function Modal({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="modal-bg"><div className="modal px" role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}

export function Modals() {
  useGame((st) => st.v);
  const offline = useGame((st) => st.offline);
  const [finishSeen, setFinishSeen] = useState(false);
  const s = game.s, act = useGame.getState();
  const chIdx = Math.min(s.stage, 4);

  if (s.failed) {
    return (
      <Modal label="殖民地瓦解">
        <p className="eyebrow">殖民地瓦解</p>
        <h2>最後一盞燈熄了</h2>
        <p>糧食斷了太久，殖民者一個接一個收拾行李，往荒原深處去找別的出路。逃生艙的廣播還在重複同一句話，但已經沒有人在聽。</p>
        <ul className="gains">
          <li>撐了 <b>{fmtTime(s.t)}</b></li>
          <li>走到 <b>第 {Math.min(s.stage, 4)} 章</b></li>
        </ul>
        <div className="choices">
          <button type="button" className="btn wide" onClick={act.restoreCheckpoint}>回到本章開頭</button>
          <button type="button" className="btn wide alt" onClick={act.reset}>重新開始</button>
        </div>
      </Modal>
    );
  }

  if (offline) {
    const gains = RES_KEYS.filter((k) => offline.gains[k] > 0.5) as ResKey[];
    return (
      <Modal label="離線收益">
        <p className="eyebrow">歡迎回來</p>
        <h2>你離開了 {fmtTime(offline.seconds)}</h2>
        <p>殖民者照常工作，效率 50%。</p>
        <ul className="gains">
          {gains.map((k) => <li key={k}><Icon k={k} /> {RES_NAME[k]} <b>+{fmt(offline.gains[k])}</b></li>)}
          {offline.pop > 0 && <li>新殖民者 <b>+{offline.pop}</b></li>}
          {!gains.length && !offline.pop && <li className="muted">沒有工人在崗位上，所以沒有收益。</li>}
        </ul>
        <button type="button" className="btn wide" onClick={act.closeOffline}>收下</button>
      </Modal>
    );
  }

  if (!s.finished && s.story.seenIntro < chIdx) {
    const ch = CHAPTERS[chIdx - 1];
    return (
      <Modal label={`第 ${ch.chapter} 章`}>
        <p className="eyebrow">第 {ch.chapter} 章</p>
        <h2>{ch.title}<small>{ch.subtitle}</small></h2>
        {ch.intro.map((p) => <p key={p}>{p}</p>)}
        {ch.chapter === 1 && <p className="hint">操作：按住建築上方的資源按鈕可以手動採集，用下方的 − ／ + 派閒置的殖民者去工作。點建築本身可以看升級與詳細資訊。拖曳地面可以移動視角。</p>}
        <button type="button" className="btn wide" onClick={act.seenIntro}>{ch.chapter === 1 ? '開始' : '繼續'}</button>
      </Modal>
    );
  }

  if (s.finished && !finishSeen) {
    return (
      <Modal label="MVP 完成">
        <p className="eyebrow">第 4 章完成</p>
        <h2>殖民地核心啟動了</h2>
        <p>異晶反應爐的紫光從地底透上來，整座殖民地第一次在夜裡不用節約用電。遠方的通訊頻道裡，傳來一個陌生的企業標誌。</p>
        <ul className="gains">
          <li>遊玩時間 <b>{fmtTime(s.t)}</b></li>
          <li>人口 <b>{s.pop}</b></li>
          <li>點擊 <b>{s.stats.clicks}</b>，暴擊 <b>{s.stats.crits}</b></li>
        </ul>
        <p className="muted">第 5 章「企業的影子」（治理、貿易）開發中。你可以繼續經營殖民地。</p>
        <button type="button" className="btn wide" onClick={() => setFinishSeen(true)}>繼續經營</button>
      </Modal>
    );
  }

  const br = s.raid?.report;
  if (br) {
    return (
      <Modal label="戰報">
        <p className="eyebrow">戰報 · 第 {br.raid} 次襲擊</p>
        <h2>{br.won ? '擊退了異星生物' : br.guards ? '防線被突破了' : '沒有保全迎戰'}</h2>
        <p>{br.guards ? `${br.guards} 位保全（${br.armed} 位持武器）迎戰 ${br.enemies} 隻異星生物。` : `${br.enemies} 隻異星生物闖進了殖民地，沒有人擋得住牠們。`}</p>
        {br.rounds.length > 1 && (
          <ol className="rounds" aria-label="各回合雙方剩餘血量">
            {br.rounds.map((r, i) => (
              <li key={i}>
                <span>{i === 0 ? '開戰' : `第 ${i} 回合`}</span>
                <div className="duel">
                  <i className="ours" style={{ width: `${(r.ours / Math.max(1, r.oursMax)) * 100}%` }} />
                  <i className="theirs" style={{ width: `${(r.theirs / Math.max(1, r.theirsMax)) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
        {br.rounds.length > 1 && <p className="legend-duel"><i className="ours" />我方血量　<i className="theirs" />敵方血量</p>}
        <ul className="gains">{br.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <button type="button" className="btn wide" onClick={act.dismissBattle}>好</button>
      </Modal>
    );
  }

  const rep = s.events.report;
  if (rep) {
    return (
      <Modal label={rep.title}>
        <p className="eyebrow">事件結果</p>
        <h2>{rep.title}</h2>
        <p>{rep.text}</p>
        <ul className="gains">{rep.gains.map((g) => <li key={g}>{g}</li>)}</ul>
        <button type="button" className="btn wide" onClick={act.dismissReport}>好</button>
      </Modal>
    );
  }

  const ev = s.events.active;
  if (ev) {
    const E = (EVENTS as any)[ev.kind];
    const bname = ev.target ? DEF[ev.target].name : '';
    const fill = (t: string) => t.replace('{building}', bname).replace('{cost}', String(ev.cost ?? ''));
    const blocked = (i: number) => (ev.kind === 'meteor' && i === 0 && !canAfford(s, { rock: ev.cost! })) ? '岩材不足'
      : (ev.kind === 'rescue' && i === 0 && idle(s) < 2) ? '閒置殖民者不足 2 位' : null;
    return (
      <Modal label={E.title}>
        <p className="eyebrow">事件</p>
        <h2>{E.title}</h2>
        <p>{fill(E.text)}</p>
        <div className="choices">
          {E.options.map((o: string, i: number) => (
            <button key={o} type="button" className={'btn wide' + (i ? ' alt' : '')} disabled={!!blocked(i)} onClick={() => act.choose(i)}>
              {fill(o)}{blocked(i) ? `（${blocked(i)}）` : ''}
            </button>
          ))}
        </div>
      </Modal>
    );
  }
  return null;
}

export function Settings() {
  const [open, setOpen] = useState(false), [confirm, setConfirm] = useState(false);
  const reset = useGame((st) => st.reset);
  return (
    <div className="settings">
      <button type="button" className="btn sq gear" onClick={() => { setOpen(!open); setConfirm(false); }} aria-label="設定" aria-expanded={open}>≡</button>
      {open && (
        <div className="menu px">
          <p className="muted">進度每 10 秒自動存在這個瀏覽器裡。離線時殖民者照常工作（效率 50%，最多 8 小時）。</p>
          {!confirm
            ? <button type="button" className="btn wide alt" onClick={() => setConfirm(true)}>重新開始</button>
            : <>
                <p className="warn">確定要刪除存檔、從頭開始嗎？</p>
                <div className="choices">
                  <button type="button" className="btn wide danger" onClick={() => { reset(); setOpen(false); }}>刪除並重來</button>
                  <button type="button" className="btn wide alt" onClick={() => setConfirm(false)}>取消</button>
                </div>
              </>}
        </div>
      )}
    </div>
  );
}
