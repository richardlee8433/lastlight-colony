import { useLayoutEffect, useRef, useState } from 'react';
import { useGame, game } from '../store/gameStore';
import { RESEARCH_DEFS, ResearchDef, built, researchSpeed } from '../engine/formulas';
import { researchBlock } from '../engine/actions';
import { researchText, t, tm } from '../i18n';
import { Bar, CostList, fmtTime } from './common';
import { Modal } from './Modals';

const BRANCHES: ResearchDef['branch'][] = ['prod', 'life', 'war'];
type Line = { x1: number; y1: number; x2: number; y2: number; on: boolean };

// 科技樹（全殖民地共用的研究）：三條分支、由左到右解鎖，連線表示前置科技
export function TechTree() {
  useGame((st) => st.v);
  const open = useGame((st) => st.tech);
  if (!open) return null;
  return <Tree />;
}

function Tree() {
  const s = game.s, act = useGame.getState(), speed = researchSpeed(s);
  const box = useRef<HTMLDivElement>(null);
  const pan = useDragPan(box);
  const [lines, setLines] = useState<Line[]>([]);
  const cols = Math.max(...RESEARCH_DEFS.map((r) => r.tier));
  const active = RESEARCH_DEFS.find((r) => r.id === s.research.active);

  // 量出每張卡片的位置，畫前置連線（只在位置變了才更新，避免重繪迴圈）
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const o = root.getBoundingClientRect();
    const pos = (id: string) => root.querySelector<HTMLElement>(`[data-rs="${id}"]`)?.getBoundingClientRect();
    const next: Line[] = [];
    for (const r of RESEARCH_DEFS) for (const q of r.requires ?? []) {
      const a = pos(q), b = pos(r.id);
      if (!a || !b) continue;
      next.push({ x1: a.right - o.left + root.scrollLeft, y1: a.top + a.height / 2 - o.top + root.scrollTop, x2: b.left - o.left + root.scrollLeft, y2: b.top + b.height / 2 - o.top + root.scrollTop, on: s.research.done.includes(q) });
    }
    if (JSON.stringify(next) !== JSON.stringify(lines)) setLines(next);
  });

  return (
    <Modal label={t('tt.title')} className="tech">
      <header className="trade-head">
        <h2>{t('tt.title')}</h2>
        <button type="button" className="close" onClick={() => act.openTech(false)} aria-label={t('close')}>×</button>
      </header>
      <div className="tech-status">
        <span>{t('st.researchers')}{t('colon')}<b>{t('st.researchersV', { a: built(s, 'databank') ? s.b.databank.workers : 0, b: built(s, 'xeno_lab') ? s.b.xeno_lab.workers : 0 })}</b></span>
        <span>{t('st.researchSpeed')}{t('colon')}<b>×{speed.toFixed(1)}</b></span>
        {active && <span>{t('tt.active', { rs: researchText(active.id)[0] })}{speed > 0 ? ` · ${t('rs.left', { t: fmtTime((active.time - s.research.progress) / speed) })}` : ''}</span>}
      </div>
      {!built(s, 'databank') ? <p className="banner warn">{t('tt.needBuilding')}</p>
        : speed <= 0 && <p className="banner warn">{t('rs.noWorkers')}</p>}
      <div className="tree" ref={box} {...pan}>
        <svg className="tree-lines" aria-hidden="true">
          {lines.map((l, i) => {
            const mx = (l.x1 + l.x2) / 2;
            return <path key={i} className={l.on ? 'on' : ''} d={`M${l.x1} ${l.y1} C${mx} ${l.y1} ${mx} ${l.y2} ${l.x2} ${l.y2}`} />;
          })}
        </svg>
        {BRANCHES.map((br) => {
          const list = RESEARCH_DEFS.filter((r) => r.branch === br);
          // 子科技盡量和第一個前置科技放同一列，連線才不會交叉
          const rowOf = new Map<string, number>(), used = new Set<string>();
          let next = 1;
          for (const r of [...list].sort((x, y) => x.tier - y.tier)) {
            let row = r.requires?.length ? rowOf.get(r.requires[0]) ?? 1 : next;
            while (used.has(`${r.tier}:${row}`)) row++;
            used.add(`${r.tier}:${row}`); rowOf.set(r.id, row);
            if (r.tier === 1) next = row + 1;
          }
          return (
            <section key={br} className="lane">
              <h3>{t('tt.' + br)}</h3>
              <div className="lane-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(200px, 1fr))` }}>
                {list.map((r) => <Node key={r.id} r={r} col={r.tier} row={rowOf.get(r.id)!} />)}
              </div>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

/** 按住空白處拖曳捲動科技樹（按鈕上按下不會開始拖曳；拖超過幾像素才算拖曳，避免吃掉點擊） */
function useDragPan(box: React.RefObject<HTMLDivElement>) {
  // 用 ref 存拖曳狀態：畫面每 0.2 秒重繪一次，普通變數會在拖曳途中被重設
  const drag = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const el = box.current;
      if (!el || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      drag.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
      el.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const el = box.current, start = drag.current;
      if (!el || !start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 4) return;
      start.moved = true;
      el.classList.add('dragging');
      el.scrollLeft = start.sl - dx; el.scrollTop = start.st - dy;
    },
    onPointerUp: (e: React.PointerEvent) => {
      const el = box.current;
      drag.current = null;
      el?.classList.remove('dragging');
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    },
  };
}

function Node({ r, col, row }: { r: ResearchDef; col: number; row: number }) {
  const s = game.s, act = useGame.getState(), speed = researchSpeed(s);
  const done = s.research.done.includes(r.id), active = s.research.active === r.id;
  const why = done || active ? null : researchBlock(s, r.id);
  const locked = !!why && why.k !== 'why.afford' && why.k !== 'why.busy';
  const [name, desc] = researchText(r.id);
  const state = done ? 'done' : active ? 'active' : locked ? 'locked' : 'ready';
  return (
    <div className={'tech-node ' + state} data-rs={r.id} style={{ gridColumn: col, gridRow: row }}>
      <div className="tn-head"><b>{name}</b>{r.lab && <span className="tag">{t('tt.lab')}</span>}{r.blueprint && <span className="tag bp">{t('tt.bp')}</span>}</div>
      <span className="tn-desc">{desc}</span>
      {!done && !active && (
        <div className="tn-req">
          {r.requires?.map((q) => <span key={q} className={s.research.done.includes(q) ? 'ok' : ''}>{s.research.done.includes(q) ? '✓ ' : ''}{researchText(q)[0]}</span>)}
          {s.stage < r.stage && <span>{t('why.stage', { n: r.stage })}</span>}
          {r.blueprint && <span className={s.exp?.blueprints.includes(r.blueprint) ? 'ok' : ''}>{s.exp?.blueprints.includes(r.blueprint) ? '✓ ' : ''}{t('why.blueprint', { bp: t('blueprint.' + r.blueprint) })}</span>}
        </div>
      )}
      {done ? <span className="done">✓ {t('done')}</span>
        : active ? <><Bar value={s.research.progress / r.time} tone="good" /><span className="muted small">{speed > 0 ? t('rs.left', { t: fmtTime((r.time - s.research.progress) / speed) }) : t('st.paused')}</span></>
        : <>
            <div className="tn-cost"><CostList cost={r.cost} /><span className="muted small">{fmtTime(r.time)}</span></div>
            <button type="button" className="btn" disabled={!!why} title={tm(why)} onClick={() => act.research(r.id)}>
              {why && why.k !== 'why.afford' ? tm(why) : t('rs.start')}
            </button>
          </>}
    </div>
  );
}
