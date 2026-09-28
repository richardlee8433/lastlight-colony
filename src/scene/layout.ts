// 建築位置固定（GDD §5）：指揮艙在中央，階段 1 內圈、階段 2 中圈、階段 3 外圈。
export const MW = 640, MH = 420;
export const CENTER = { x: 320, y: 200 };
export interface Site { id: string; x: number; y: number; r?: number; hub?: boolean }
export const SITES: Site[] = [
  { id: 'command', x: 320, y: 222, r: 34, hub: true },
  { id: 'escape_pod', x: 241, y: 204 },
  { id: 'scrap_heap', x: 399, y: 204 },
  { id: 'algae_tank', x: 320, y: 276 },
  { id: 'hab_pod', x: 152, y: 222 },
  { id: 'bio_harvester', x: 236, y: 314 },
  { id: 'cargo', x: 236, y: 134 },
  { id: 'lounge', x: 404, y: 134 },
  { id: 'assembly', x: 488, y: 222 },
  { id: 'rock_cutter', x: 404, y: 314 },
  { id: 'databank', x: 142, y: 116 },
  { id: 'metal_mine', x: 498, y: 116 },
  { id: 'forge', x: 498, y: 338 },
  { id: 'rail_line', x: 142, y: 340 },
  // 階段 4：最外圈
  { id: 'memorial', x: 320, y: 76 },
  { id: 'hydro_farm', x: 60, y: 232 },
  { id: 'security', x: 584, y: 226 },
  { id: 'water_cycle', x: 320, y: 398 },
  { id: 'crystal_synth', x: 590, y: 402 },
];
/** 襲擊時異星生物從哪一側出現（依 incoming.side） */
export const RAID_SPAWN = [{ x: -30, y: 200 }, { x: 670, y: 190 }, { x: 320, y: -30 }, { x: 330, y: 450 }];
/** 預警結束時異星生物停下的位置：地圖邊緣內側（殖民地外圍），不會提早闖進建築群 */
export const RAID_RALLY = [{ x: 34, y: 170 }, { x: 606, y: 160 }, { x: 250, y: 30 }, { x: 250, y: 408 }];
export const HOME = { x: CENTER.x, y: CENTER.y + 30 };
