import { useGame, game } from '../store/gameStore';
import { COMMAND_CHAIN, DEF } from '../engine/state';
import { bDesc, bName, kindName, nodeText, researchText, resName, t, tm } from '../i18n';
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

export function BuildingPanel() {
  useGame((st) => st.v);
  const id = useGame((st) => st.selected);
  const act = useGame.getState();
  if (!id) return null;
  const s = game.s, d = DEF[id], b = s.b[id], L = b.level;
  const isCmd = d.kind === 'command';
  const nextCmd = isCmd ? COMMAND_CHAIN.find((c) => !built(s, c)) : undefined;

  return (
    <aside className="panel px" aria-label={t('bp.aria', { b: bName(id) })}>
      <header className="panel-head">
        <img src={buildingURL(id, L)} alt="" />
        <div>
          <span className="kind">{kindName(d.kind)}</span>
          <h2>{bName(id)}</h2>
          <span className="lv">{L ? (d.maxLevel > 1 ? `Lv${L} / ${d.maxLevel}` : t('bp.built')) : t('bp.notBuilt')}</span>
        </div>
        <button type="button" className="close" onClick={() => act.select(null)} aria-label={t('close')}>×</button>
      </header>
      <p className="desc">{bDesc(id)}</p>
      {L > 0 && disabled(s, id) && <div className="banner warn">{t('bp.damaged', { n: Math.ceil(b.disabledUntil - s.t) })}</div>}

      {L > 0 && d.workersPerLevel ? (
        <section className="block">
          <div className="workers">
            <span>{t('bp.workers')}</span>
            <button type="button" className="btn sq" onClick={() => act.assign(id, -1)} disabled={b.workers <= 0} aria-label={t('bp.workerDec')}>−</button>
            <b>{b.workers}<small>/{workerCap(s, id)}</small></b>
            <button type="button" className="btn sq" onClick={() => act.assign(id, 1)} disabled={idle(s) <= 0 || b.workers >= workerCap(s, id)} aria-label={t('bp.workerInc')}>+</button>
            <span className="muted">{t('bp.idle', { n: idle(s) })}</span>
          </div>
        </section>
      ) : null}

      {L > 0 && <Stats id={id} />}
      {L > 0 && d.recipe && (
        <section className="block">
          <div className="workers">
            <span>{t(b.paused ? 'bp.pausedUse' : 'bp.using', { r: resName(d.recipe.in) })}</span>
            <button type="button" className={'btn' + (b.paused ? '' : ' alt')} style={{ marginLeft: 'auto' }} onClick={() => act.togglePause(id)}>{t(b.paused ? 'bp.resume' : 'bp.pause')}</button>
          </div>
          {!b.paused && <p className="muted small">{t('bp.pauseHint', { r: resName(d.recipe.in) })}</p>}
        </section>
      )}
      {L > 0 && id === 'forge' && s.stage >= 4 && <ForgeSplit />}
      {L > 0 && id === 'security' && <Defense />}
      {L > 0 && id === 'admin' && <Governance />}
      {L > 0 && (id === 'trade_post' || id === 'spaceport') && (
        <section className="block">
          <button type="button" className="btn wide" onClick={() => act.openTrade(id === 'trade_post' ? 'corp' : 'alliance')}>{t('bp.openTrade')}</button>
        </section>
      )}
      {L > 0 && id === 'turret' && (
        <section className="block">
          <dl className="stats">
            <div><dt>{t('bp.turrets')}</dt><dd>{t('bp.turretN', { n: L })}</dd></div>
            <div><dt>{t('bp.each')}</dt><dd>{t('bp.turretStat', { a: turretAtk(s), h: TURRET_HP })}</dd></div>
          </dl>
          <p className="muted small">{t('bp.turretHint')}</p>
        </section>
      )}

      {isCmd && (
        <section className="block">
          <h3>{t('kind.command')}</h3>
          <ol className="chain">
            {COMMAND_CHAIN.map((c) => <li key={c} className={built(s, c) ? 'ok' : c === nextCmd ? 'next' : ''}>{bName(c)}<small>Lv{DEF[c].commandLevel}</small></li>)}
          </ol>
          {nextCmd && nextCmd !== id && <BuildBox id={nextCmd} title={t('bp.nextCmd', { b: bName(nextCmd) })} />}
          {!nextCmd && <p className="muted">{t('bp.endContent')}</p>}
        </section>
      )}

      {!(isCmd && L > 0) && L < d.maxLevel && <BuildBox id={id} />}

      {L > 0 && d.upgrades?.length ? (
        <section className="block">
          <h3>{t('bp.upgrades')}</h3>
          <ul className="nodes">
            {d.upgrades.map((n) => {
              const owned = b.nodes.includes(n.id), why = nodeBlock(s, id, n.id), [nn, nd] = nodeText(id, n.id);
              return (
                <li key={n.id} className={owned ? 'owned' : ''}>
                  <div className="node-main"><b>{nn}</b><span>{nd}</span>{!owned && <CostList cost={n.cost} />}</div>
                  {owned ? <span className="done">{t('done')}</span>
                    : <button type="button" className="btn" disabled={!!why} title={tm(why)} onClick={() => act.buyNode(id, n.id)}>{why && why.k !== 'why.afford' ? tm(why) : t('bp.buy')}</button>}
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
      <h3>{title ?? (L ? t('bp.upgradeTo', { n: L + 1 }) : t('bp.build'))}</h3>
      <CostList cost={levelCost(s, id)} />
      {d.requires?.pop ? <p className={'req ' + (s.pop >= d.requires.pop ? 'ok' : '')}>{t('bp.reqPop', { n: d.requires.pop, c: s.pop })}</p> : null}
      {d.requires?.raids ? <p className={'req ' + (s.raid.won >= d.requires.raids ? 'ok' : '')}>{t('bp.reqRaids', { n: d.requires.raids, c: s.raid.won })}</p> : null}
      {d.requires?.credits ? <p className={'req ' + (s.gov.creditsEarned >= d.requires.credits ? 'ok' : '')}>{t('bp.reqCredits', { n: d.requires.credits, c: Math.floor(s.gov.creditsEarned) })}</p> : null}
      <button type="button" className="btn wide" disabled={!!why} onClick={() => act.levelUp(id)}>
        {why && why.k !== 'why.afford' ? tm(why) : L ? t('bp.upgrade') : t('bp.buildX', { b: bName(id) })}
      </button>
    </section>
  );
}

function Stats({ id }: { id: string }) {
  const s = game.s, d = DEF[id], L = s.b[id].level;
  const rows: [string, string][] = [];
  if (d.produce) {
    rows.push([t('st.outPerSec', { r: resName(d.produce.res) }), `+${fmt(gatherRate(s, id))}`]);
    rows.push([t('st.baseRate'), t('perSec', { n: d.produce.rate })]);
    const bonus = nodeEffect(s, id, 'prodAdd') + gatherBonus(s);
    if (bonus) rows.push([t('st.bonus'), `+${Math.round(bonus * 100)}%`]);
  }
  if (d.recipe) {
    const inp = processInput(s, id), r = recipeRatio(s, id);
    rows.push([t('st.inPerSec', { r: resName(d.recipe.in) }), `−${fmt(inp)}`]);
    const ws = weaponShare(s, id);
    rows.push([t('st.outPerSec', { r: resName(d.recipe.out) }), `+${fmt(inp * r * (1 - ws))}`]);
    if (ws > 0) rows.push([t('st.outPerSec', { r: resName('weapon') }), `+${fmt(inp * ws * WEAPON_RATIO)}`]);
    rows.push([t('st.ratio'), `1 → ${r.toFixed(2)}`]);
    if (s.b[id].paused) rows.push([t('st.status'), t('st.paused')]);
    else if (inp > 0 && s.res[d.recipe.in] < 1) rows.push([t('st.status'), t('st.dry', { r: resName(d.recipe.in) })]);
  }
  if (d.effects?.housing) rows.push([t('st.housing'), t('st.housingV', { n: d.effects.housing * L + nodeEffect(s, id, 'housingAdd'), c: popCap(s) })]);
  if (d.effects?.storage) rows.push([t('st.storage'), t('st.storageV', { n: (d.effects.storage + nodeEffect(s, id, 'storagePerLevel')) * L, c: storageCap(s) })]);
  if (d.effects?.morale) rows.push([t('morale'), `+${d.effects.morale * L + nodeEffect(s, id, 'moraleAdd')}`]);
  if (d.effects?.birth) rows.push([t('st.birth'), `+${Math.round(d.effects.birth * L * 100)}%`]);
  if (d.effects?.consumeMul) rows.push([t('st.consume'), `${Math.round(d.effects.consumeMul * 100)}%`]);
  if (d.effects?.habBonus) rows.push([t('st.habCap'), t('st.habCapV', { n: d.effects.habBonus })]);
  if (d.kind === 'rail') rows.push([t('st.gather'), t('st.railV', { n: Math.round((0.1 + nodeEffect(s, id, 'gatherAdd')) * 100) })]);
  if (d.kind === 'research') {
    // 研究速度是全殖民地共用：資料庫和異星研究院的駐點工人加總
    rows.push([t('st.researchSpeed'), `×${researchSpeed(s).toFixed(1)}`]);
    rows.push([t('st.researchers'), t('st.researchersV', { a: built(s, 'databank') ? s.b.databank.workers : 0, b: built(s, 'xeno_lab') ? s.b.xeno_lab.workers : 0 })]);
  }
  return (
    <section className="block">
      <dl className="stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {d.clickable && (
        <div className={'clickinfo' + (buffActive(s, id) ? ' on' : '')}>
          <span>{t('st.click', { n: clickAmount(s, id), c: Math.round(critChance(s, id) * 100), m: critMult(s, id) })}</span>
          <span>{buffActive(s, id) ? t('st.buffOn', { n: Math.ceil(buffDuration(s, id) - (s.t - s.b[id].lastClick)) }) : t('st.buffOff', { n: buffDuration(s, id) })}</span>
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
      <h3>{t('fs.title')}</h3>
      <div className="workers">
        <span>{t('fs.weapons')}</span>
        <button type="button" className="btn sq" onClick={() => act.setSplit('forge', n - 1)} disabled={n <= 0} aria-label={t('fs.dec')}>−</button>
        <b>{n}<small>/{b.workers}</small></b>
        <button type="button" className="btn sq" onClick={() => act.setSplit('forge', n + 1)} disabled={n >= b.workers} aria-label={t('fs.inc')}>+</button>
        <span className="muted">{t('fs.rest', { n: b.workers - n })}</span>
      </div>
    </section>
  );
}

function Defense() {
  const s = game.s, d = defense(s);
  const rows: [string, string][] = [
    [t('df.guards'), t('df.guardsV', { n: d.guards, r: d.ready, i: injuredCount(s) })],
    [t('df.armed'), t('df.armedV', { n: d.armed, w: Math.floor(s.res.weapon) })],
    [t('df.atk'), t('df.atkV', { a: guardAtk(s, true), b: guardAtk(s, false) })],
    [t('df.hp'), `${guardHp(s)}`],
    [t('df.power'), t('df.powerV', { a: Math.round(d.atk), h: Math.round(d.hp) })],
    [t('df.record'), t('df.recordV', { w: s.raid.won, n: s.raid.count })],
  ];
  return (
    <section className="block">
      <h3>{t('df.title')}</h3>
      <dl className="stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <p className="muted small">{t('df.hint')}</p>
    </section>
  );
}

function Research() {
  const s = game.s, act = useGame.getState(), speed = researchSpeed(s);
  return (
    <section className="block">
      <h3>{t('rs.title')}</h3>
      {speed <= 0 && <p className="banner warn">{t('rs.noWorkers')}</p>}
      <ul className="nodes">
        {RESEARCH_DEFS.map((r) => {
          const done = s.research.done.includes(r.id), active = s.research.active === r.id, why = researchBlock(s, r.id), [rn, rd] = researchText(r.id);
          return (
            <li key={r.id} className={done ? 'owned' : ''}>
              <div className="node-main">
                <b>{rn}</b><span>{rd} · {fmtTime(r.time)}</span>
                {active ? <Bar value={s.research.progress / r.time} tone="good" /> : !done && <CostList cost={r.cost} />}
              </div>
              {done ? <span className="done">{t('done')}</span>
                : active ? <span className="done">{speed > 0 ? t('rs.left', { t: fmtTime((r.time - s.research.progress) / speed) }) : t('st.paused')}</span>
                : <button type="button" className="btn" disabled={!!why} onClick={() => act.research(r.id)}>{why && why.k !== 'why.afford' ? tm(why) : t('rs.start')}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
void Icon;
