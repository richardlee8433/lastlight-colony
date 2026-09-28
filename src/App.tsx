import { useEffect, useRef } from 'react';
import { GameScene } from './scene/GameScene';
import { TopBar } from './ui/TopBar';
import { QuestLog } from './ui/QuestLog';
import { ColonyPanel } from './ui/ColonyPanel';
import { BuildingPanel } from './ui/BuildingPanel';
import { QuickBar } from './ui/QuickBar';
import { Toasts } from './ui/Toasts';
import { RaidBanner } from './ui/RaidBanner';
import { TradeModal } from './ui/TradeModal';
import { Modals } from './ui/Modals';
import { Settings } from './ui/Settings';
import { useGame, game } from './store/gameStore';
import { applyDocLang, t, useLang } from './i18n';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useGame(() => Math.min(6, game.s.stage));
  const lang = useLang();
  useEffect(() => applyDocLang(lang), [lang]);
  useEffect(() => {
    const scene = new GameScene();
    let failed = false;
    scene.init(host.current!).catch(() => { failed = true; host.current!.innerHTML = `<p class="nogl">${t('app.noGL')}</p>`; });
    return () => { if (!failed) scene.app.destroy(true); };
  }, []);
  return (
    <div className={`game stage-${stage} lang-${lang}`}>
      <div className="stage-host" ref={host} />
      <TopBar />
      <QuestLog />
      <ColonyPanel />
      <BuildingPanel />
      <QuickBar />
      <RaidBanner />
      <Toasts />
      <Settings />
      <TradeModal />
      <Modals />
    </div>
  );
}
