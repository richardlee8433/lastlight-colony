import { useGame, game } from '../store/gameStore';
import { AIR_ENABLED, COMMAND_CHAIN, DEF } from '../engine/state';
import { bDesc, bName, costText, kindName, nodeText, researchText, resName, t, tm } from '../i18n';
import {
  RESEARCH_DEFS, buffActive, buffPower, built, clickAmount, critChance, critMult, disabled, gatherBonus,
  gatherRate, hurtCivilians, idle, artId, formOf, moraleMult, BOOST_COST, boostActive, boostDuration, boostPower, levelCost, nodeEffect, popCap, processInput, recipeRatio, researchSpeed, storageCap, workerCap, creditsCh5, LEVEL_EFF, hasLevelEff, levelEff } from '../engine/formulas';
import { boostBlock, levelBlock, nextForm, nodeBlock, rebuildBlock, researchBlock } from '../engine/actions';
import { defense, guardAtk, guardHp, healRate, injuredCount, medBeds, turretAtk, TURRET_HP, MED_LOT, MED_TIME, medActive, medBlock } from '../engine/combat';
import { Governance } from './Governance';
import { weaponShare, weaponRatio } from '../engine/formulas';
import { CostList, Icon, Bar, fmt, fmtTime } from './common';
import { buildingURL } from './assets';
import { ShipPanel } from './ShipPanel';
import { EXP_TEAM, EXP_TIME, FRAGS_PER_BP, expBlock, fragChance, nextBlueprint } from '../engine/expedition';

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
        <img src={buildingURL(artId(s, id), L)} alt="" />
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
      {L > 0 && id === 'shipyard' && <ShipPanel />}
      {L > 0 && id === 'security' && <Defense />}
      {L > 0 && id === 'med_bay' && <MedBay />}
      {L > 0 && id === 'expedition' && <Expedition />}
      {L > 0 && id === 'bioeng' && <BioLab />}
      {id === 'orbital_beacon' && <Beacon />}
      {L > 0 && id === 'admin' && <Governance />}
      {L > 0 && (id === 'trade_post' || id === 'spaceport') && (
        <section className="block">
          <button type="button" className="btn wide" onClick={() => act.openTrade('corp')}>{t('bp.openTrade')}</button>
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
      {L > 0 && d.forms && <Rebuild id={id} />}

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

      {id === 'databank' && L > 0 && <Research />}
    </aside>
  );
}

function BuildBox({ id, title }: { id: string; title?: string }) {
  const s = game.s, d = DEF[id], L = s.b[id].level, why = levelBlock(s, id);
  const act = useGame.getState();
  return (
    <section className="block buildbox">
      <h3>{title ?? (d.flatCost ? t('bc.next', { n: L + 1 }) : L ? t('bp.upgradeTo', { n: L + 1 }) : t('bp.build'))}</h3>
      {L > 0 && !d.flatCost && hasLevelEff(id) && <p className="muted small">{t('bp.nextLv', { e: Math.round(LEVEL_EFF * 100), w: formOf(s, id)?.workersPerLevel ?? d.workersPerLevel ?? 0 })}</p>}
      <CostList cost={levelCost(s, id)} />
      {d.requires?.pop ? <p className={'req ' + (s.pop >= d.requires.pop ? 'ok' : '')}>{t('bp.reqPop', { n: d.requires.pop, c: s.pop })}</p> : null}
      {d.requires?.raids ? <p className={'req ' + (s.raid.won >= d.requires.raids ? 'ok' : '')}>{t('bp.reqRaids', { n: d.requires.raids, c: s.raid.won })}</p> : null}
      {d.requires?.credits ? <p className={'req ' + (creditsCh5(s) >= d.requires.credits ? 'ok' : '')}>{t('bp.reqCredits', { n: d.requires.credits, c: Math.floor(creditsCh5(s)) })}</p> : null}
      <button type="button" className="btn wide" disabled={!!why} onClick={() => act.levelUp(id)}>
        {why && why.k !== 'why.afford' ? tm(why) : d.flatCost ? t('bc.next', { n: L + 1 }) : L ? t('bp.upgrade') : t('bp.buildX', { b: bName(id) })}
      </button>
    </section>
  );
}

function Stats({ id }: { id: string }) {
  const s = game.s, d = DEF[id], L = s.b[id].level;
  const rows: [string, string][] = [];
  if (d.produce) {
    rows.push([t('st.outPerSec', { r: resName(d.produce.res) }), `+${fmt(gatherRate(s, id))}`]);
    rows.push([t('st.baseRate'), t('perSec', { n: formOf(s, id)?.rate ?? d.produce.rate })]);
    const bonus = nodeEffect(s, id, 'prodAdd') + gatherBonus(s);
    if (bonus) rows.push([t('st.bonus'), `+${Math.round(bonus * 100)}%`]);
    const oxyPer = formOf(s, id)?.oxygen ?? d.oxygen;
    if (AIR_ENABLED && oxyPer) rows.push([t('st.oxyPerSec'), `+${fmt(s.b[id].workers * oxyPer * moraleMult(s) * (s.air?.hypoxic ? 0.5 : 1))}`]);
  }
  if (d.recipe) {
    const inp = processInput(s, id), r = recipeRatio(s, id);
    rows.push([t('st.inPerSec', { r: resName(d.recipe.in) }), `−${fmt(inp)}`]);
    const ws = weaponShare(s, id);
    rows.push([t('st.outPerSec', { r: resName(d.recipe.out) }), `+${fmt(inp * r * (1 - ws))}`]);
    if (ws > 0) rows.push([t('st.outPerSec', { r: resName('weapon') }), `+${fmt(inp * ws * weaponRatio(s))}`]);
    rows.push([t('st.ratio'), `1 → ${r.toFixed(2)}`]);
    if (s.b[id].paused) rows.push([t('st.status'), t('st.paused')]);
    else if (inp > 0 && s.res[d.recipe.in] < 1) rows.push([t('st.status'), t('st.dry', { r: resName(d.recipe.in) })]);
  }
  // 等級效率：每升一級每位工人效率 +5%（採集、加工、研究）
  if (hasLevelEff(id) && L > 0) rows.push([t('st.levelEff'), t('st.levelEffV', { n: Math.round((levelEff(s, id) - 1) * 100), e: Math.round(LEVEL_EFF * 100) })]);
  // 玩家要知道的是殖民地現在總共住得下多少人、倉庫裝得下多少，不是這棟建築單獨貢獻多少
  if (d.effects?.housing) rows.push([t('st.housing'), t('st.housingV', { c: popCap(s) })]);
  if (d.effects?.storage) rows.push([t('st.storage'), t('st.storageV', { c: storageCap(s) })]);
  if (d.effects?.morale) rows.push([t('morale'), `+${d.effects.morale * L + nodeEffect(s, id, 'moraleAdd')}`]);
  if (d.effects?.birth) rows.push([t('st.birth'), `+${Math.round(d.effects.birth * L * 100)}%`]);
  if (d.effects?.consumeMul) rows.push([t('st.consume'), `${Math.round(d.effects.consumeMul * 100)}%`]);
  if (d.effects?.habBonus) rows.push([t('st.habCap'), t('st.habCapV', { n: d.effects.habBonus })]);
  if (d.kind === 'rail') rows.push([t('st.gather'), t('st.railV', { n: Math.round((0.1 + nodeEffect(s, id, 'gatherAdd')) * 100) })]);
  if (d.kind === 'research') {
    // 研究速度是全殖民地共用：資料庫和異星研究院的駐點工人加總
    rows.push([t('st.researchSpeed'), `×${researchSpeed(s).toFixed(1)}`]);
    rows.push([t('st.researchers'), t('st.researchersV', { a: built(s, 'databank') ? s.b.databank.workers : 0 })]);
  }
  return (
    <section className="block">
      <dl className="stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {d.clickable && (
        <div className={'clickinfo' + (buffActive(s, id) ? ' on' : '')}>
          <span>{t('st.clickLine', { n: clickAmount(s, id), c: Math.round(critChance(s, id) * 100), m: critMult(s, id), b: Math.round(buffPower(s, id) * 100) })}</span>
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
      {built(s, 'med_bay') && injuredCount(s) > 0 && <p className="muted small">{t('df.medbay', { n: Math.min(injuredCount(s), medBeds(s)) })}</p>}
    </section>
  );
}

/** 研究所頁面只顯示目前研究進度；完整科技樹在另一頁 */
/** 生物工程室：注入異晶換限時產量加成 */
function BioLab() {
  const s = game.s, act = useGame.getState(), why = boostBlock(s), p = Math.round(boostPower(s) * 100);
  return (
    <section className="block">
      <h3>{t('bio.title')}</h3>
      {boostActive(s)
        ? <><p className="banner good">{t('bio.active', { p, t: fmtTime(s.boost.until - s.t) })}</p><Bar value={(s.boost.until - s.t) / boostDuration(s)} tone="good" /></>
        : <p className="muted small">{t('bio.info', { p, t: fmtTime(boostDuration(s)), c: costText(BOOST_COST) })}</p>}
      <CostList cost={BOOST_COST} />
      <button type="button" className="btn wide" disabled={!!why} onClick={act.boost}>{why && why.k !== 'why.afford' ? tm(why) : t('bio.btn')}</button>
      <p className="muted small">{t('bio.uses', { n: s.boost.uses })}</p>
    </section>
  );
}

/** 軌道信標：五段建造的進度 */
function Beacon() {
  const s = game.s, d = DEF.orbital_beacon, L = s.b.orbital_beacon.level;
  return (
    <section className="block">
      <h3>{t('bc.title')}</h3>
      <p className="muted small">{t('bc.phase', { n: L, m: d.maxLevel })}</p>
      <Bar value={L / d.maxLevel} tone="good" />
      {L >= d.maxLevel && <p className="muted small">{t('bc.done')}</p>}
    </section>
  );
}

/** 改建：糧食設施換成下一個形態 */
function Rebuild({ id }: { id: string }) {
  const s = game.s, act = useGame.getState(), f = nextForm(s, id), why = rebuildBlock(s, id);
  const cur = s.b[id].form ?? 0, forms = DEF[id].forms!;
  return (
    <section className="block">
      <h3>{t('rbd.title')}</h3>
      <ol className="chain">
        {[0, ...forms.map((_, i) => i + 1)].map((i) => <li key={i} className={i <= cur ? 'ok' : i === cur + 1 ? 'next' : ''}>{bName(id, i)}</li>)}
      </ol>
      {f ? (
        <>
          <p className="muted small">{t('rbd.info', { b: bName(id, cur + 1), r: f.rate, w: f.workersPerLevel })}</p>
          <CostList cost={f.cost} />
          <button type="button" className="btn wide" disabled={!!why} onClick={() => act.rebuild(id)}>{why && why.k !== 'why.afford' ? tm(why) : t('rbd.btn', { b: bName(id, cur + 1) })}</button>
        </>
      ) : <p className="muted small">{t('rbd.done')}</p>}
    </section>
  );
}

/** 探勘站：派隊伍出去找藍圖 */
function Expedition() {
  const s = game.s, act = useGame.getState(), e = s.exp!, why = expBlock(s), next = nextBlueprint(s);
  return (
    <section className="block">
      <h3>{t('ex.title')}</h3>
      {e.team > 0
        ? <><p className="banner good">{t('ex.away', { n: e.team, t: fmtTime(Math.max(0, e.until - s.t)) })}</p><Bar value={1 - (e.until - s.t) / EXP_TIME} tone="good" /></>
        : <p className="muted small">{t('ex.info', { n: EXP_TEAM, t: fmtTime(EXP_TIME) })}{e.count === 0 ? ' ' + t('ex.first') : ''}</p>}
      <button type="button" className="btn wide" disabled={!!why} onClick={act.expedition}>{why ? tm(why) : t('ex.btn')}</button>
      <dl className="stats">
        <div><dt>{t('ex.trips')}</dt><dd>{e.count}</dd></div>
        <div><dt>{t('ex.have')}</dt><dd>{e.blueprints.length ? e.blueprints.map((b) => t('blueprint.' + b)).join('、') : t('ex.none')}</dd></div>
        {e.count > 0 && next && <div><dt>{t('ex.frags', { bp: t('blueprint.' + next) })}</dt><dd>{e.frags}/{FRAGS_PER_BP}</dd></div>}
        {e.count > 0 && next && <div><dt>{t('ex.chance')}</dt><dd>{Math.round(fragChance(s) * 100)}%</dd></div>}
      </dl>
      {e.count > 0 && !next && <p className="muted small">{t('ex.allFound')}</p>}
    </section>
  );
}

function MedBay() {
  const s = game.s, act = useGame.getState(), beds = medBeds(s), patients = injuredCount(s) + hurtCivilians(s), why = medBlock(s);
  const rows: [string, string][] = [
    [t('md.beds'), t('md.bedsV', { n: Math.min(patients, beds), m: beds })],
    [t('md.patients'), t('md.patientsV', { a: injuredCount(s), b: hurtCivilians(s) })],
    [t('md.rate'), `×${healRate(s).toFixed(1)}`],
  ];
  return (
    <section className="block">
      <h3>{t('md.title')}</h3>
      <dl className="stats">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <p className="muted small">{t('md.hint')}</p>
      {/* 醫療物資（進口品）：傷員恢復快 50%；也是船的長程補給模組的材料 */}
      {medActive(s) && <p className="banner good">{t('md.medActive', { t: fmtTime(s.raid.medUntil! - s.t) })}</p>}
      <button type="button" className="btn wide" disabled={!!why} title={tm(why)} onClick={() => act.applyMedicine()}>
        <Icon k="medicine" size={16} /> {t('md.medBtn', { n: MED_LOT, m: Math.round(MED_TIME / 60), c: s.cargo?.medicine ?? 0 })}{why ? t('paren', { x: tm(why) }) : ''}
      </button>
    </section>
  );
}

function Research() {
  const s = game.s, act = useGame.getState(), speed = researchSpeed(s);
  const r = RESEARCH_DEFS.find((x) => x.id === s.research.active);
  const done = s.research.done.length, total = RESEARCH_DEFS.length;
  return (
    <section className="block">
      <h3>{t('rs.title')}</h3>
      {speed <= 0 && <p className="banner warn">{t('rs.noWorkers')}</p>}
      {r ? (
        <div className="node-main">
          <b>{t('tt.active', { rs: researchText(r.id)[0] })}</b>
          <Bar value={s.research.progress / r.time} tone="good" />
          <span className="muted small">{speed > 0 ? t('rs.left', { t: fmtTime((r.time - s.research.progress) / speed) }) : t('st.paused')}</span>
        </div>
      ) : <p className="muted small">{t('tt.idle')}</p>}
      <p className="muted small">{t('tt.progress', { n: done, m: total })}</p>
      <button type="button" className="btn wide" onClick={() => act.openTech(true)}>{t('tt.open')}</button>
    </section>
  );
}
void Icon;
