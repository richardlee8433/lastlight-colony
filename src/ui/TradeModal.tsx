import { useGame, game } from '../store/gameStore';
import { RES_KEYS, RES_NAME, RES_UNLOCK, ResKey } from '../engine/state';
import { PRICE, Partner, SIGNAL_LIMIT, SIGNAL_RATE, TRADE_LOT, partnerOpen, rates, signalLeft, signalOpen, tradeBlock } from '../engine/governance';
import { Icon, fmt, fmtTime } from './common';

// 貿易（GDD §13）：赫利昂企業（交易站）、自由殖民地聯盟（太空港）、神秘訊號（太空港＋異星研究院）
export function TradeModal() {
  useGame((st) => st.v);
  const tab = useGame((st) => st.trade);
  const act = useGame.getState();
  if (!tab) return null;
  const s = game.s, g = s.gov;
  const tabs: [typeof tab, string, boolean][] = [['corp', '赫利昂企業', partnerOpen(s, 'corp')], ['alliance', '自由殖民地聯盟', partnerOpen(s, 'alliance')], ['signal', '神秘訊號', signalOpen(s)]];
  const goods = RES_KEYS.filter((k) => PRICE[k] && RES_UNLOCK[k] <= s.stage) as ResKey[];
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) act.openTrade(null); }}>
      <div className="modal px trade" role="dialog" aria-modal="true" aria-label="貿易">
        <header className="trade-head">
          <h2>貿易</h2>
          <span className="credits"><Icon k="credit" size={20} /> {fmt(s.res.credit)}</span>
          <button type="button" className="close" onClick={() => act.openTrade(null)} aria-label="關閉">×</button>
        </header>
        <div className="tabs" role="tablist">
          {tabs.map(([id, label, open]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={'tab' + (tab === id ? ' on' : '')} disabled={!open} onClick={() => act.openTrade(id)}>
              {label}{!open && <small>（{id === 'corp' ? '需要交易站' : id === 'alliance' ? '需要太空港' : '需要太空港＋異星研究院'}）</small>}
            </button>
          ))}
        </div>
        {tab === 'signal' ? (
          <section className="block">
            <p>訊號來源不在任何星圖上。對方只要廢料，回傳的卻是純度極高的異晶，沒有人知道為什麼。</p>
            <p className="muted small">{SIGNAL_RATE} 廢料換 1 異晶。每 {fmtTime(600)} 最多 {SIGNAL_LIMIT} 個，目前還能換 {signalLeft(s)} 個。</p>
            <button type="button" className="btn wide" disabled={signalLeft(s) <= 0 || s.res.scrap < SIGNAL_RATE * 5} onClick={() => act.signal()}>
              用 {SIGNAL_RATE * 5} 廢料換 5 異晶
            </button>
          </section>
        ) : (
          <>
            <p className="muted small">
              {tab === 'corp'
                ? `匯率最好，但每 10 筆交易企業關係 +1。企業關係 ${g.corp.relation}，拒絕使者 ${g.corp.refusals} 次${g.corp.refusals >= 3 ? '（突擊隊會出動）' : ''}。`
                : `匯率普通。完成委託可以提高聲望，匯率跟著變好。聯盟聲望 ${g.alliance.rep}。`}
            </p>
            {tab === 'alliance' && <Contract />}
            <table className="market">
              <thead><tr><th>資源</th><th>庫存</th><th>賣出 {TRADE_LOT}</th><th>買進 {TRADE_LOT}</th></tr></thead>
              <tbody>
                {goods.map((k) => {
                  const r = rates(s, tab as Partner, k);
                  const sb = tradeBlock(s, tab as Partner, k, 'sell'), bb = tradeBlock(s, tab as Partner, k, 'buy');
                  return (
                    <tr key={k}>
                      <td><Icon k={k} size={16} /> {RES_NAME[k]}</td>
                      <td>{fmt(s.res[k])}</td>
                      <td><button type="button" className="btn" disabled={!!sb} title={sb ?? ''} onClick={() => act.doTrade(tab as Partner, k, 'sell')}>+{Math.floor(r.sell * TRADE_LOT)}</button></td>
                      <td><button type="button" className="btn alt" disabled={!!bb} title={bb ?? ''} onClick={() => act.doTrade(tab as Partner, k, 'buy')}>−{Math.ceil(r.buy * TRADE_LOT)}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function Contract() {
  const s = game.s, c = s.gov.alliance.contract, act = useGame.getState();
  if (!c) return <p className="muted small">下一份委託 {fmtTime(Math.max(0, s.gov.alliance.nextContract - s.t))} 後送達。</p>;
  return (
    <div className="contract">
      <div><b>委託：交付 {c.amount} {RES_NAME[c.res]}</b><span className="muted">報酬 {c.reward} 信用點、聲望 +1 · 剩 {fmtTime(c.until - s.t)}</span></div>
      <button type="button" className="btn" disabled={s.res[c.res] < c.amount} onClick={act.fulfill}>交付</button>
    </div>
  );
}
