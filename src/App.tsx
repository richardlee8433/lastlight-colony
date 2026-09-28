import { useEffect, useRef } from 'react';
import { GameScene } from './scene/GameScene';
import { TopBar } from './ui/TopBar';
import { QuestLog } from './ui/QuestLog';
import { ColonyPanel } from './ui/ColonyPanel';
import { BuildingPanel } from './ui/BuildingPanel';
import { QuickBar } from './ui/QuickBar';
import { Toasts } from './ui/Toasts';
import { RaidBanner } from './ui/RaidBanner';
import { Modals, Settings } from './ui/Modals';
import { useGame, game } from './store/gameStore';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useGame(() => Math.min(4, game.s.stage));
  useEffect(() => {
    const scene = new GameScene();
    let failed = false;
    scene.init(host.current!).catch(() => { failed = true; host.current!.innerHTML = '<p class="nogl">這個瀏覽器無法啟動 WebGL，遊戲畫面無法顯示。請改用桌面版 Chrome、Edge 或 Safari。</p>'; });
    return () => { if (!failed) scene.app.destroy(true); };
  }, []);
  return (
    <div className={`game stage-${stage}`}>
      <div className="stage-host" ref={host} />
      <TopBar />
      <QuestLog />
      <ColonyPanel />
      <BuildingPanel />
      <QuickBar />
      <RaidBanner />
      <Toasts />
      <Settings />
      <Modals />
    </div>
  );
}
