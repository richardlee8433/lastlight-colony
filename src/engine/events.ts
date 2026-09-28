// 隨機事件：隕石雨、求救訊號（GDD §12，頻率上限每 5–8 分鐘一次）
import { DEFS, GameState, notify } from './state';
import { add, built, canAfford, idle, pay, popCap } from './formulas';

export function scheduleNext(s: GameState, rng = Math.random) {
  s.events.nextAt = s.t + 300 + rng() * 180;
}

export function events(s: GameState, rng = Math.random) {
  const ev = s.events;
  if (ev.rescue && s.t >= ev.rescue.until) {
    ev.rescue = null;
    const k = s.stage, roll = rng();
    const gains: string[] = [];
    const people = (n: number) => { s.pop += n; gains.push(`新殖民者 +${n}`); };
    const supplies = (m: number) => {
      const scrap = Math.round(80 * k * m), rock = Math.round(40 * k * m), parts = Math.round(20 * k * m);
      add(s, 'scrap', scrap); add(s, 'rock', rock); add(s, 'parts', parts);
      gains.push(`廢料 +${scrap}`, `岩材 +${rock}`, `零件 +${parts}`);
    };
    let text: string;
    if (roll < 0.3) {
      people(2);
      text = '峽谷底下是另一艘逃生艙，裡面擠著兩個人，靠最後一罐氧氣撐了三天。他們一看到頭盔上的燈就哭了。';
    } else if (roll < 0.6) {
      people(1); supplies(0.5);
      text = '訊號來自一位受傷的工程師。她不肯丟下自己的工具箱，救援隊只好連人帶箱一起扛回來。';
    } else if (roll < 0.85) {
      supplies(1.5);
      text = '求救的人已經不在了，只剩一台還在自動廣播的信標。救援隊把附近能拆的都帶了回來。';
    } else {
      people(1);
      text = '救回來的是赫利昂企業的前監工。他說自己也是逃出來的，大家還在考慮要不要相信他。';
    }
    if (s.pop > popCap(s)) gains.push('人口超過上限，蓋生活艙讓大家有地方住');
    ev.report = { title: '救援隊回來了', text, gains };
    notify(s, '救援隊回來了。', 'good');
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
  if (a.kind === 'meteor') {
    if (choice === 0) {
      if (!canAfford(s, { rock: a.cost! })) return;
      pay(s, { rock: a.cost! });
      notify(s, '加固完成，隕石只在屋頂留下幾道刮痕。', 'good');
    } else {
      s.b[a.target!].disabledUntil = s.t + 60;
      notify(s, '建築受損，停工 60 秒。', 'warn');
    }
  } else if (choice === 0) {
    if (idle(s) < 2) return;
    s.events.rescue = { until: s.t + 180, workers: 2 };
    notify(s, '兩位殖民者出發救援，3 分鐘後回來。', 'info');
  }
  s.events.active = null;
  scheduleNext(s);
}
