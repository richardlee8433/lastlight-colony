import { useGame, game } from '../store/gameStore';
import { COMMAND_CHAIN, DEFS } from '../engine/state';
import { built, workerCap } from '../engine/formulas';
import { buildingURL } from './assets';

// 建築快捷列（GDD §6）：一鍵跳到指定建築
export function QuickBar() {
  useGame((st) => st.v);
  const sel = useGame((st) => st.selected), focusOn = useGame((st) => st.focusOn);
  const s = game.s;
  const cmd = [...COMMAND_CHAIN].reverse().find((id) => built(s, id));
  const list = DEFS.filter((d) => d.kind !== 'command' && d.stage <= s.stage);
  return (
    <nav className="quickbar px" aria-label="建築快捷列">
      {cmd && qb(cmd)}
      {list.map((d) => qb(d.id))}
    </nav>
  );
  function qb(id: string) {
    const b = s.b[id], cap = workerCap(s, id);
    return (
      <button key={id} type="button" className={'qb' + (sel === id ? ' on' : '') + (b.level ? '' : ' ghost')} onClick={() => focusOn(id)} title={DEFS.find((d) => d.id === id)!.name}>
        <img src={buildingURL(id, b.level)} alt="" />
        {cap > 0 && <span className="qb-w">{b.workers}/{cap}</span>}
        {!b.level && <span className="qb-new">建造</span>}
      </button>
    );
  }
}
