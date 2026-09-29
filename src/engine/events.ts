// 隨機事件：隕石雨、求救訊號（GDD §12，頻率上限每 5–8 分鐘一次）
import { DEFS, GameState, Msg, msg, notify } from './state';
import { add, built, canAfford, idle, pay, popCap } from './formulas';
import { resolveEnvoy } from './governance';

export function scheduleNext(s: GameState, rng = Math.random) {
  s.events.nextAt = s.t + 300 + rng() * 180;
}

/** 伊涅絲的求救訊號多久後響（第 2 章開場對話後），拒絕後多久再響一次 */
export const INES_DELAY = 60, INES_RETRY = 90, INES_TRIP = 120;

export function events(s: GameState, rng = Math.random) {
  const ev = s.events;
  if (ev.rescue?.ines && s.t >= ev.rescue.until) {
    // 固定事件：救回伊涅絲（帶著工具箱桃樂絲和一些零件）
    ev.rescue = null;
    s.story.ines = true;
    s.pop += 1;
    add(s, 'parts', 25);
    const gains: Msg[] = [msg('g.ines'), msg('l.gain', { r: 'parts', n: 25 })];
    if (s.pop > popCap(s)) gains.push(msg('g.overcap'));
    ev.report = { title: msg('rescue.inesTitle'), text: msg('rescue.inesText'), gains };
    notify(s, 'n.rescueBack', undefined, 'good');
  }
  if (ev.rescue && s.t >= ev.rescue.until) {
    ev.rescue = null;
    const k = s.stage, roll = rng();
    const gains: Msg[] = [];
    const people = (n: number) => { s.pop += n; gains.push(msg('g.people', { n })); };
    const supplies = (m: number) => {
      const scrap = Math.round(80 * k * m), rock = Math.round(40 * k * m), parts = Math.round(20 * k * m);
      add(s, 'scrap', scrap); add(s, 'rock', rock); add(s, 'parts', parts);
      gains.push(msg('l.gain', { r: 'scrap', n: scrap }), msg('l.gain', { r: 'rock', n: rock }), msg('l.gain', { r: 'parts', n: parts }));
    };
    let text: number;
    if (roll < 0.3) {
      people(2);
      text = 0;
    } else if (roll < 0.6) {
      people(1); supplies(0.5);
      text = 1;
    } else if (roll < 0.85) {
      supplies(1.5);
      text = 2;
    } else {
      people(1);
      text = 3;
    }
    if (s.pop > popCap(s)) gains.push(msg('g.overcap'));
    ev.report = { title: msg('rescue.title'), text: msg('rescue.text.' + text), gains };
    notify(s, 'n.rescueBack', undefined, 'good');
  }
  // 第 2 章的第一個求救訊號必定是伊涅絲（其他隨機事件先讓路）
  if (s.stage >= 2 && !s.story.ines && s.story.seen?.includes('c2-open')) {
    s.story.inesAt ??= s.t + INES_DELAY;
    if (!ev.active && !ev.rescue?.ines && s.t >= s.story.inesAt) { ev.active = { kind: 'rescue_ines' }; return; }
  }
  if (ev.active || s.t < ev.nextAt) return;
  const producers = DEFS.filter((d) => (d.produce || d.recipe) && built(s, d.id));
  const options: ('meteor' | 'rescue')[] = [];
  if (s.stage >= 2 && producers.length) options.push('meteor');
  if (s.stage >= 2 && !ev.rescue && idle(s) >= 2) options.push('rescue');
  if (!options.length) { scheduleNext(s, rng); return; }
  const kind = options[Math.floor(rng() * options.length)];
  if (kind === 'meteor') {
    const target = producers[Math.floor(rng() * producers.length)].id;
    ev.active = { kind, target, cost: 30 + 20 * s.stage };
  } else ev.active = { kind };
}

export function resolveEvent(s: GameState, choice: number) {
  const a = s.events.active;
  if (!a) return;
  if (a.kind === 'envoy') { if (resolveEnvoy(s, choice)) s.events.active = null; return; }
  if (a.kind === 'meteor') {
    if (choice === 0) {
      if (!canAfford(s, { rock: a.cost! })) return;
      pay(s, { rock: a.cost! });
      notify(s, 'n.meteorOk', undefined, 'good');
    } else {
      s.b[a.target!].disabledUntil = s.t + 60;
      notify(s, 'n.meteorHit', { b: a.target! }, 'warn');
    }
  } else if (a.kind === 'rescue_ines') {
    if (choice === 0) {
      if (idle(s) < 2) return;
      s.events.rescue = { until: s.t + INES_TRIP, workers: 2, ines: true };
      notify(s, 'n.inesGo');
    } else s.story.inesAt = s.t + INES_RETRY;
    s.events.active = null;
    return;
  } else if (choice === 0) {
    if (idle(s) < 2) return;
    s.events.rescue = { until: s.t + 180, workers: 2 };
    notify(s, 'n.rescueGo');
  }
  s.events.active = null;
  scheduleNext(s);
}
