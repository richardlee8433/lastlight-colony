import { useGame, game } from '../store/gameStore';
import { RES_KEYS, RES_UNLOCK, ResKey } from '../engine/state';
import { resName, t, tm } from '../i18n';
import { PRICE, Partner, SIGNAL_LIMIT, SIGNAL_RATE, TRADE_LOT, partnerOpen, rates, signalLeft, signalOpen, tradeBlock } from '../engine/governance';
import { Icon, fmt, fmtTime } from './common';
import { DROP_TIME, EXPORTS, EXPORT_LOT, GOODS, IMPORT_LOT, buyBlock, buyPrice, cargoCap, cargoUsed, partner, sellBlock, sellPrice, trend } from '../engine/market';

// 貿易：市場（交易站：喜鵲；合作路線後是赫利昂）、自由殖民地聯盟（太空港）、神秘訊號（太空港＋異星研究院）
export function TradeModal() {
  useGame((st) => st.v);
  const tab = useGame((st) => st.trade);
  const act = useGame.getState();
  if (!tab) return null;
  const s = game.s, g = s.gov;
  const tabs: [typeof tab, string, boolean][] = [['corp', t('tr.market'), partnerOpen(s, 'corp')], ['alliance', t('tr.alliance'), partnerOpen(s, 'alliance')], ['signal', t('tr.signal'), signalOpen(s)]];
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
        ) : tab === 'corp' ? <Market /> : (
          <>
            <p className="muted small">{t('tr.allianceInfo', { n: g.alliance.rep })}</p>
            <Contract />
            <Bulk who="alliance" goods={goods} />
          </>
                )}
      </div>
    </div>
  );
}

const ARROW = { up: '↑', down: '↓', flat: '—' } as const;
const TREND = { up: 'tr.trendUp', down: 'tr.trendDown', flat: 'tr.trendFlat' } as const;

/** 市場：賣給行商（出口品）、訂購進口品（貨櫃投下來放進貨艙）；第 5 章起底下還有原本的大宗資源買賣 */
function Market() {
  const s = game.s, g = s.gov, act = useGame.getState(), who = partner(s);
  const info = who === 'helion'
    ? t('tr.helionInfo', { n: g.corp.relation, m: g.corp.refusals }) + (g.corp.refusals >= 3 ? t('tr.commando') : '')
    : t('tr.magpieInfo', { t: fmtTime(DROP_TIME) }) + (s.story.route === 'resist' && s.b.spaceport.level > 0 ? t('tr.allianceTerms') : '');
  // 大宗資源：賣給赫利昂才看得到異晶（喜鵲不知道異晶的事）；出口品在上面的表賣
  const bulk = RES_KEYS.filter((k) => PRICE[k] && RES_UNLOCK[k] <= s.stage && (k !== 'crystal' || who === 'helion')) as ResKey[];
  return (
    <>
      <p className="muted small">{info}</p>
      <div className="cargo">
        <b>{t('tr.cargo', { n: cargoUsed(s), m: cargoCap(s) })}</b>
        {GOODS.map((k) => <span key={k}><Icon k={k} size={16} /> {fmt(s.cargo[k])}</span>)}
      </div>
      {s.market.pending.map((p, i) => <p key={i} className="muted small inbound">{t('tr.inbound', { n: p.n, r: resName(p.k), t: fmtTime(p.at - s.t) })}</p>)}
      <h3>{t('tr.exports')}</h3>
      <table className="market">
        <thead><tr><th>{t('tr.res')}</th><th>{t('tr.stock')}</th><th>{t('tr.price')}</th><th>{t('tr.sell', { n: EXPORT_LOT })}</th></tr></thead>
        <tbody>
          {EXPORTS.map((k) => {
            const p = sellPrice(s, k), tr = trend(s, k), b = sellBlock(s, k);
            return (
              <tr key={k}>
                <td><Icon k={k} size={16} /> {resName(k)}</td>
                <td>{fmt(s.res[k])}</td>
                <td><span className={'trend ' + tr} title={t(TREND[tr])}>{p.toFixed(p < 10 ? 2 : 1)} {ARROW[tr]}</span></td>
                <td><button type="button" className="btn" disabled={!!b} title={tm(b)} onClick={() => act.sellGood(k)}>+{Math.floor(p * EXPORT_LOT)}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>{t('tr.imports')}</h3>
      <table className="market">
        <thead><tr><th>{t('tr.res')}</th><th>{t('tr.stock')}</th><th>{t('tr.price')}</th><th>{t('tr.buy', { n: IMPORT_LOT })}</th></tr></thead>
        <tbody>
          {GOODS.map((k) => {
            const p = buyPrice(s, k), tr = trend(s, k), b = buyBlock(s, k);
            return (
              <tr key={k}>
                <td><Icon k={k} size={16} /> {resName(k)}</td>
                <td>{fmt(s.cargo[k])}</td>
                <td><span className={'trend ' + tr} title={t(TREND[tr])}>{p.toFixed(1)} {ARROW[tr]}</span></td>
                <td><button type="button" className="btn alt" disabled={!!b} title={tm(b)} onClick={() => act.buyGood(k)}>−{Math.ceil(p * IMPORT_LOT)}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {s.stage >= 5 && <><h3>{t('tr.bulk')}</h3><Bulk who="corp" goods={bulk} /></>}
    </>
  );
}

/** 原本的大宗資源買賣（固定匯率、一次 100）：市場分頁的出口品不在這裡賣 */
function Bulk({ who, goods }: { who: Partner; goods: ResKey[] }) {
  const s = game.s, act = useGame.getState();
  return (
    <table className="market">
      <thead><tr><th>{t('tr.res')}</th><th>{t('tr.stock')}</th><th>{t('tr.sell', { n: TRADE_LOT })}</th><th>{t('tr.buy', { n: TRADE_LOT })}</th></tr></thead>
      <tbody>
        {goods.map((k) => {
          const r = rates(s, who, k);
          const sb = tradeBlock(s, who, k, 'sell'), bb = tradeBlock(s, who, k, 'buy');
          const canSell = who !== 'corp' || !EXPORTS.includes(k);
          return (
            <tr key={k}>
              <td><Icon k={k} size={16} /> {resName(k)}</td>
              <td>{fmt(s.res[k])}</td>
              <td>{canSell ? <button type="button" className="btn" disabled={!!sb} title={tm(sb)} onClick={() => act.doTrade(who, k, 'sell')}>+{Math.floor(r.sell * TRADE_LOT)}</button> : <span className="muted">—</span>}</td>
              <td><button type="button" className="btn alt" disabled={!!bb} title={tm(bb)} onClick={() => act.doTrade(who, k, 'buy')}>−{Math.ceil(r.buy * TRADE_LOT)}</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
