import { useGame, game } from '../store/gameStore';
import { RES_KEYS, RES_UNLOCK, ResKey } from '../engine/state';
import { resName, t, tm } from '../i18n';
import { PRICE, Partner, SIGNAL_LIMIT, SIGNAL_RATE, TRADE_LOT, partnerOpen, rates, signalLeft, signalOpen, tradeBlock } from '../engine/governance';
import { Icon, fmt, fmtTime } from './common';

// 貿易（GDD §13）：赫利昂企業（交易站）、自由殖民地聯盟（太空港）、神秘訊號（太空港＋異星研究院）
export function TradeModal() {
  useGame((st) => st.v);
  const tab = useGame((st) => st.trade);
  const act = useGame.getState();
  if (!tab) return null;
  const s = game.s, g = s.gov;
  const tabs: [typeof tab, string, boolean][] = [['corp', t('tr.corp'), partnerOpen(s, 'corp')], ['alliance', t('tr.alliance'), partnerOpen(s, 'alliance')], ['signal', t('tr.signal'), signalOpen(s)]];
  const goods = RES_KEYS.filter((k) => PRICE[k] && RES_UNLOCK[k] <= s.stage) as ResKey[];
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) act.openTrade(null); }}>
      <div className="modal px trade" role="dialog" aria-modal="true" aria-label={t('tr.title')}>
        <header className="trade-head">
          <h2>{t('tr.title')}</h2>
          <span className="credits"><Icon k="credit" size={20} /> {fmt(s.res.credit)}</span>
          <button type="button" className="close" onClick={() => act.openTrade(null)} aria-label={t('close')}>×</button>
        </header>
        <div className="tabs" role="tablist">
          {tabs.map(([id, label, open]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={'tab' + (tab === id ? ' on' : '')} disabled={!open} onClick={() => act.openTrade(id)}>
              {label}{!open && <small>{t('paren', { x: t(id === 'corp' ? 'why.tradePost' : id === 'alliance' ? 'why.spaceport' : 'tr.needSignal') })}</small>}
            </button>
          ))}
        </div>
        {tab === 'signal' ? (
          <section className="block">
            <p>{t('tr.signalText')}</p>
            <p className="muted small">{t('tr.signalInfo', { r: SIGNAL_RATE, t: fmtTime(600), n: SIGNAL_LIMIT, m: signalLeft(s) })}</p>
            <button type="button" className="btn wide" disabled={signalLeft(s) <= 0 || s.res.scrap < SIGNAL_RATE * 5} onClick={() => act.signal()}>
              {t('tr.signalBtn', { n: SIGNAL_RATE * 5 })}
            </button>
          </section>
        ) : (
          <>
            <p className="muted small">
              {tab === 'corp'
                ? t('tr.corpInfo', { n: g.corp.relation, m: g.corp.refusals }) + (g.corp.refusals >= 3 ? t('tr.commando') : '')
                : t('tr.allianceInfo', { n: g.alliance.rep })}
            </p>
            {tab === 'alliance' && <Contract />}
            <table className="market">
              <thead><tr><th>{t('tr.res')}</th><th>{t('tr.stock')}</th><th>{t('tr.sell', { n: TRADE_LOT })}</th><th>{t('tr.buy', { n: TRADE_LOT })}</th></tr></thead>
              <tbody>
                {goods.map((k) => {
                  const r = rates(s, tab as Partner, k);
                  const sb = tradeBlock(s, tab as Partner, k, 'sell'), bb = tradeBlock(s, tab as Partner, k, 'buy');
                  return (
                    <tr key={k}>
                      <td><Icon k={k} size={16} /> {resName(k)}</td>
                      <td>{fmt(s.res[k])}</td>
                      <td><button type="button" className="btn" disabled={!!sb} title={tm(sb)} onClick={() => act.doTrade(tab as Partner, k, 'sell')}>+{Math.floor(r.sell * TRADE_LOT)}</button></td>
                      <td><button type="button" className="btn alt" disabled={!!bb} title={tm(bb)} onClick={() => act.doTrade(tab as Partner, k, 'buy')}>−{Math.ceil(r.buy * TRADE_LOT)}</button></td>
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
  if (!c) return <p className="muted small">{t('tr.nextContract', { t: fmtTime(Math.max(0, s.gov.alliance.nextContract - s.t)) })}</p>;
  return (
    <div className="contract">
      <div><b>{t('tr.contract', { n: c.amount, r: resName(c.res) })}</b><span className="muted">{t('tr.reward', { n: c.reward, t: fmtTime(c.until - s.t) })}</span></div>
      <button type="button" className="btn" disabled={s.res[c.res] < c.amount} onClick={act.fulfill}>{t('tr.deliver')}</button>
    </div>
  );
}
