// 隨機事件：隕石雨、求救訊號（GDD §12，頻率上限每 5–8 分鐘一次）
import { DEFS, GameState, Msg, msg, notify } from './state';
import { add, built, canAfford, idle, pay, popCap } from './formulas';
import { resolveEnvoy } from './governance';

export function scheduleNext(s: GameState, rng = Math.random) {
  s.events.nextAt = s.t + 300 + rng() * 180;
}

export function events(s: GameState, rng = Math.random) {
  const ev = s.events;
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
  } else if (choice === 0) {
    if (idle(s) < 2) return;
    s.events.rescue = { until: s.t + 180, workers: 2 };
    notify(s, 'n.rescueGo');
  }
  s.events.active = null;
  scheduleNext(s);
}
