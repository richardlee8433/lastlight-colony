import { useGame, game } from '../store/gameStore';
import { GameState } from '../engine/state';
import { resName, t, tm } from '../i18n';
import { MODULES, have, moduleBlock, mods, shipNamed } from '../engine/ship';
import { Icon, fmt } from './common';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
/** 船的稱呼：第 6 章朱諾取名之前叫「船」，之後叫「曙光號」 */
export const shipLabel = (s: GameState) => t(shipNamed(s) ? 'ship.named' : 'ship.unnamed');

/** 船塢面板：六個模組一個一個裝；進口品從貨艙扣 */
export function ShipPanel() {
  const s = game.s, act = useGame.getState(), n = mods(s), why = moduleBlock(s);
  const waiting = !s.story.choice6 && s.ship.wait !== undefined && !s.events.active;
  return (
    <section className="block ship">
      <h3>{t('sy.head', { ship: shipLabel(s), n, m: MODULES.length })}</h3>
      <ol className="mods">
        {MODULES.map((m, i) => {
          const done = i < n, next = i === n;
          return (
            <li key={m.id} className={done ? 'done' : next ? 'next' : 'later'}>
              <div className="mod-head">
                <b>{ROMAN[i]}. {t('mod.' + m.id)}</b>
                <span className="muted small">{done ? '✓' : m.id === 'drive' ? t('sy.leaveOnly') : t('sy.chapter', { n: m.stage })}</span>
              </div>
              {!done && (
                <div className="cost">
                  {Object.entries(m.cost).map(([k, v]) => (
                    <span key={k} className={'cost-item' + (have(s, k as any) >= v! ? '' : ' short')} title={resName(k)}>
                      <Icon k={k} size={14} />{fmt(v!)}
                    </span>
                  ))}
                </div>
              )}
              {next && (
                <button type="button" className="btn wide" disabled={!!why} title={tm(why)} onClick={() => act.buildModule()}>
                  {t('sy.build')}{why ? t('paren', { x: tm(why) }) : ''}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="muted small">{t('sy.note')}</p>
      {waiting && <button type="button" className="btn wide" onClick={() => act.reopenChoice()}>{t('sy.reopen')}</button>}
    </section>
  );
}
