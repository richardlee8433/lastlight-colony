import { useGame, game } from '../store/gameStore';
import { arrivalInterval, foodSafety, idle, moraleMult, netRates, popCap, rescueWorkers } from '../engine/formulas';
import { Bar, fmtTime } from './common';

export function ColonyPanel() {
  useGame((st) => st.v);
  const s = game.s, cap = popCap(s), fs = foodSafety(s);
  const full = s.pop >= cap;
  const eta = full || s.starving ? null : (1 - s.arrival) * arrivalInterval(s);
  const food = netRates(s).nutrient;
  return (
    <div className="colony px">
      <div className="row"><span>殖民者</span><b>{s.pop}<small>/{cap}</small></b></div>
      <div className="row"><span>閒置</span><b className={idle(s) > 0 ? 'hl' : ''}>{idle(s)}</b></div>
      {rescueWorkers(s) > 0 && <div className="row"><span>救援中</span><b>{rescueWorkers(s)}</b></div>}
      <div className="meter"><span>食物安全度 {Math.round(fs * 100)}%</span><Bar value={fs} tone={fs < 0.25 ? 'bad' : fs < 0.6 ? 'mid' : 'good'} /></div>
      <div className="meter"><span>士氣 {Math.round(s.morale)}（產量 ×{moraleMult(s).toFixed(2)}）</span><Bar value={s.morale / 100} tone="morale" /></div>
      {!s.starving && food < -0.01 && (
        <div className="arrival"><span className="warn">營養每秒 {food.toFixed(1)}，約 {fmtTime(s.res.nutrient / -food)} 後耗盡</span></div>
      )}
      <div className="arrival">
        {s.starving ? <span className="warn">{s.starveTime < 60 ? `斷糧 ${Math.floor(s.starveTime)} 秒：再 ${Math.ceil(60 - s.starveTime)} 秒就會有殖民者離開` : '斷糧中：每 30 秒會有一位殖民者離開，只剩 1 人時殖民地瓦解'}</span>
          : full ? <span className="muted">人口已滿，蓋生活艙提高上限</span>
          : <span className="muted">下一位殖民者 {fmtTime(eta!)}</span>}
      </div>
    </div>
  );
}
