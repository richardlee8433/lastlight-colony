import { useGame, game } from '../store/gameStore';
import { COMMAND_CHAIN, DEF, RES_NAME } from '../engine/state';
import {
  RESEARCH_DEFS, buffActive, buffDuration, built, clickAmount, critChance, critMult, disabled, gatherBonus,
  gatherRate, idle, levelCost, nodeEffect, popCap, processInput, recipeRatio, researchSpeed, storageCap, workerCap,
} from '../engine/formulas';
import { levelBlock, nodeBlock, researchBlock } from '../engine/actions';
import { defense, guardAtk, guardHp, injuredCount, turretAtk, TURRET_HP } from '../engine/combat';
import { Governance } from './Governance';
import { weaponShare, WEAPON_RATIO } from '../engine/formulas';
import { CostList, Icon, Bar, fmt, fmtTime } from './common';
import { buildingURL } from './assets';

const KIND: Record<string, string> = { start: '起點', gather: '採集', process: '加工', command: '指揮艙', house: '住宅', storage: '儲存', morale: '士氣', research: '研究', rail: '設施', defense: '防衛', utility: '設施', governance: '治理', trade: '貿易' };

export function BuildingPanel() {
  useGame((st) => st.v);
  const id = useGame((st) => st.selected);
  const act = useGame.getState();
  if (!id) return null;
  const s = game.s, d = DEF[id], b = s.b[id], L = b.level;
  const isCmd = d.kind === 'command';
  const nextCmd = isCmd ? COMMAND_CHAIN.find((c) => !built(s, c)) : undefined;

  return (
    <aside className="panel px" aria-label={`${d.name}資訊`}>
      <header className="panel-head">
        <img src={buildingURL(id, L)} alt="" />
        <div>
          <span className="kind">{KIND[d.kind]}</span>
          <h2>{d.name}</h2>
          <span className="lv">{L ? (d.maxLevel > 1 ? `Lv${L} / ${d.maxLevel}` : '已建成') : '尚未建造'}</span>
        </div>
        <button type="button" className="close" onClick={() => act.select(null)} aria-label="關閉">×</button>
      </header>
      <p className="desc">{d.desc}</p>
      {L > 0 && disabled(s, id) && <div className="banner warn">隕石損壞，停工中（{Math.ceil(b.disabledUntil - s.t)} 秒）</div>}

      {L > 0 && d.workersPerLevel ? (
        <section className="block">
          <div className="workers">
            <span>工人</span>
            <button type="button" className="btn sq" onClick={() => act.assign(id, -1)} disabled={b.workers <= 0} aria-label="減少工人">−</button>
            <b>{b.workers}<small>/{workerCap(s, id)}</small></b>
            <button type="button" className="btn sq" onClick={() => act.assign(id, 1)} disabled={idle(s) <= 0 || b.workers >= workerCap(s, id)} aria-label="增加工人">+</button>
            <span className="muted">閒置 {idle(s)}</span>
          </div>
        </section>
      ) : null}

      {L > 0 && <Stats id={id} />}
      {L > 0 && d.recipe && (
        <section className="block">
          <div className="workers">
            <span>{b.paused ? `已暫停：不會消耗${RES_NAME[d.recipe.in]}` : `正在消耗${RES_NAME[d.recipe.in]}`}</span>
            <button type="button" className={'btn' + (b.paused ? '' : ' alt')} style={{ marginLeft: 'auto' }} onClick={() => act.togglePause(id)}>{b.paused ? '恢復加工' : '暫停加工'}</button>
          </div>
          {!b.paused && <p className="muted small">想存{RES_NAME[d.recipe.in]}蓋建築時可以先暫停，工人會留在崗位上。</p>}
        </section>
      )}
      {L > 0 && id === 'forge' && s.stage >= 4 && <ForgeSplit />}
      {L > 0 && id === 'security' && <Defense />}
      {L > 0 && id === 'admin' && <Governance />}
      {L > 0 && (id === 'trade_post' || id === 'spaceport') && (
        <section className="block">
          <button type="button" className="btn wide" onClick={() => act.openTrade(id === 'trade_post' ? 'corp' : 'alliance')}>開啟貿易</button>
        </section>
      )}
      {L > 0 && id === 'turret' && (
        <section className="block">
          <dl className="stats">
            <div><dt>砲塔</dt><dd>{L} 座</dd></div>
            <div><dt>每座</dt><dd>攻擊 {turretAtk(s)}，血量 {TURRET_HP}</dd></div>
          </dl>
          <p className="muted small">砲塔站在最前線吸收傷害，不佔人口，戰後自動修復。</p>
        </section>
      )}

      {isCmd && (
        <section className="block">
          <h3>指揮艙</h3>
          <ol className="chain">
            {COMMAND_CHAIN.map((c) => <li key={c} className={built(s, c) ? 'ok' : c === nextCmd ? 'next' : ''}>{DEF[c].name}<small>Lv{DEF[c].commandLevel}</small></li>)}
          </ol>
          {nextCmd && nextCmd !== id && <BuildBox id={nextCmd} title={`下一級：${DEF[nextCmd].name}`} />}
          {!nextCmd && <p className="muted">目前內容到此為止。第 6 章「信標」開發中。</p>}
        </section>
      )}

      {!(isCmd && L > 0) && L < d.maxLevel && <BuildBox id={id} />}

      {L > 0 && d.upgrades?.length ? (
        <section className="block">
          <h3>升級線</h3>
          <ul className="nodes">
            {d.upgrades.map((n) => {
              const owned = b.nodes.includes(n.id), why = nodeBlock(s, id, n.id);
              return (
                <li key={n.id} className={owned ? 'owned' : ''}>
                  <div className="node-main"><b>{n.name}</b><span>{n.desc}</span>{!owned && <CostList cost={n.cost} />}</div>
                  {owned ? <span className="done">已完成</span>
                    : <button type="button" className="btn" disabled={!!why} title={why ?? ''} onClick={() => act.buyNode(id, n.id)}>{why && why !== '資源不足' ? why : '購買'}</button>}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {(id === 'databank' || id === 'xeno_lab') && L > 0 && <Research />}
    </aside>
  );
}

function BuildBox({ id, title }: { id: string; title?: string }) {
  const s = game.s, d = DEF[id], L = s.b[id].level, why = levelBlock(s, id);
  const act = useGame.getState();
  return (
    <section className="block buildbox">
      <h3>{title ?? (L ? `升級到 Lv${L + 1}` : '建造')}</h3>
      <CostList cost={levelCost(s, id)} />
      {d.requires?.pop ? <p className={'req ' + (s.pop >= d.requires.pop ? 'ok' : '')}>需要人口 {d.requires.pop}（目前 {s.pop}）</p> : null}
      {d.requires?.raids ? <p className={'req ' + (s.raid.won >= d.requires.raids ? 'ok' : '')}>需要擊退 {d.requires.raids} 次襲擊（目前 {s.raid.won}）</p> : null}
      {d.requires?.credits ? <p className={'req ' + (s.gov.creditsEarned >= d.requires.credits ? 'ok' : '')}>需要累計賺進 {d.requires.credits} 信用點（目前 {Math.floor(s.gov.creditsEarned)}）</p> : null}
      <button type="button" className="btn wide" disabled={!!why} onClick={() => act.levelUp(id)}>
        {why && why !== '資源不足' ? why : L ? '升級' : `建造${d.name}`}
      </button>
    </section>
  );
}

function Stats({ id }: { id: string }) {
  const s = game.s, d = DEF[id], L = s.b[id].level;
  const rows: [string, string][] = [];
  if (d.produce) {
    rows.push([`每秒產出${RES_NAME[d.produce.res]}`, `+${fmt(gatherRate(s, id))}`]);
    rows.push(['每位工人基礎產率', `${d.produce.rate}/秒`]);
    const bonus = nodeEffect(s, id, 'prodAdd') + gatherBonus(s);
    if (bonus) rows.push(['產量加成', `+${Math.round(bonus * 100)}%`]);
  }
  if (d.recipe) {
    const inp = processInput(s, id), r = recipeRatio(s, id);
    rows.push([`每秒消耗${RES_NAME[d.recipe.in]}`, `−${fmt(inp)}`]);
    const ws = weaponShare(s, id);
    rows.push([`每秒產出${RES_NAME[d.recipe.out]}`, `+${fmt(inp * r * (1 - ws))}`]);
    if (ws > 0) rows.push(['每秒產出武器', `+${fmt(inp * ws * WEAPON_RATIO)}`]);
    rows.push(['轉換率', `1 → ${r.toFixed(2)}`]);
    if (s.b[id].paused) rows.push(['狀態', '已暫停']);
    else if (inp > 0 && s.res[d.recipe.in] < 1) rows.push(['狀態', `${RES_NAME[d.recipe.in]}見底，只能用掉即時產出的量`]);
  }
  if (d.effects?.housing) rows.push(['居住空間', `${d.effects.housing * L + nodeEffect(s, id, 'housingAdd')} 人（總上限 ${popCap(s)}）`]);
  if (d.effects?.storage) rows.push(['儲存加成', `+${(d.effects.storage + nodeEffect(s, id, 'storagePerLevel')) * L}（總上限 ${storageCap(s)}）`]);
  if (d.effects?.morale) rows.push(['士氣', `+${d.effects.morale * L + nodeEffect(s, id, 'moraleAdd')}`]);
  if (d.effects?.birth) rows.push(['出生率', `+${Math.round(d.effects.birth * L * 100)}%`]);
  if (d.effects?.consumeMul) rows.push(['營養消耗', `${Math.round(d.effects.consumeMul * 100)}%`]);
  if (d.effects?.habBonus) rows.push(['生活艙容量', `每級 +${d.effects.habBonus} 人`]);
  if (d.kind === 'rail') rows.push(['採集產量', `+${Math.round((0.1 + nodeEffect(s, id, 'gatherAdd')) * 100)}%，工人移動加快`]);
  if (d.kind === 'research') rows.push(['研究速度', `×${researchSpeed(s).toFixed(1)}`]);
  return (
    <section className="block">
      <dl className="stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {d.clickable && (
        <div className={'clickinfo' + (buffActive(s, id) ? ' on' : '')}>
          <span>按住地圖上的採集按鈕：每 0.2 秒 +{clickAmount(s, id)}，暴擊 {Math.round(critChance(s, id) * 100)}% ×{critMult(s, id)}</span>
          <span>{buffActive(s, id) ? `工人 buff +25% 生效中（${Math.ceil(buffDuration(s, id) - (s.t - s.b[id].lastClick))} 秒）` : `點擊後 ${buffDuration(s, id)} 秒內工人產量 +25%`}</span>
        </div>
      )}
    </section>
  );
}

function ForgeSplit() {
  const s = game.s, b = s.b.forge, act = useGame.getState();
  const n = Math.min(b.split ?? 0, b.workers);
  return (
    <section className="block">
      <h3>產線分配</h3>
      <div className="workers">
        <span>做武器</span>
        <button type="button" className="btn sq" onClick={() => act.setSplit('forge', n - 1)} disabled={n <= 0} aria-label="減少做武器的工人">−</button>
        <b>{n}<small>/{b.workers}</small></b>
        <button type="button" className="btn sq" onClick={() => act.setSplit('forge', n + 1)} disabled={n >= b.workers} aria-label="增加做武器的工人">+</button>
        <span className="muted">其餘 {b.workers - n} 人做工具</span>
      </div>
    </section>
  );
}

function Defense() {
  const s = game.s, d = defense(s);
  const rows: [string, string][] = [
    ['保全', `${d.guards} 人（可參戰 ${d.ready}，受傷 ${injuredCount(s)}）`],
    ['已配發武器', `${d.armed} 把（庫存 ${Math.floor(s.res.weapon)}）`],
    ['每人攻擊', `持武器 ${guardAtk(s, true)}，徒手 ${guardAtk(s, false)}`],
    ['每人血量', `${guardHp(s)}`],
    ['總戰力', `攻 ${Math.round(d.atk)}，血 ${Math.round(d.hp)}`],
    ['擊退紀錄', `${s.raid.won} / ${s.raid.count} 次`],
  ];
  return (
    <section className="block">
      <h3>防衛</h3>
      <dl className="stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <p className="muted small">派駐的工人就是保全。武器由鍛造廠生產，庫存有武器時自動配發。倒下的保全會受傷休養，不會死亡。</p>
    </section>
  );
}

function Research() {
  const s = game.s, act = useGame.getState(), speed = researchSpeed(s);
  return (
    <section className="block">
      <h3>全域研究</h3>
      {speed <= 0 && <p className="banner warn">資料庫沒有工人，研究不會進行。</p>}
      <ul className="nodes">
        {RESEARCH_DEFS.map((r) => {
          const done = s.research.done.includes(r.id), active = s.research.active === r.id, why = researchBlock(s, r.id);
          return (
            <li key={r.id} className={done ? 'owned' : ''}>
              <div className="node-main">
                <b>{r.name}</b><span>{r.desc} · {fmtTime(r.time)}</span>
                {active ? <Bar value={s.research.progress / r.time} tone="good" /> : !done && <CostList cost={r.cost} />}
              </div>
              {done ? <span className="done">已完成</span>
                : active ? <span className="done">{speed > 0 ? `剩 ${fmtTime((r.time - s.research.progress) / speed)}` : '暫停'}</span>
                : <button type="button" className="btn" disabled={!!why} onClick={() => act.research(r.id)}>{why && why !== '資源不足' ? why : '研究'}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
void Icon;
