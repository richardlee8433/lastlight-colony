// 對話立繪的表情：場景 id → 台詞編號（照 dialogs.ts 原順序、從 0 開始）→ 表情。
// 沒標的台詞用預設立繪（角色.webp）。有表情圖（角色-表情.webp）就換，沒有也退回預設，所以可以一個角色一個角色慢慢補。
// angry 也拿來當「嚴肅、緊急」；sad 包含低落、沉默、說不出口；joy 是真正開心大笑的時候。
export type Mood = 'angry' | 'sad' | 'joy';

const A = 'angry', S = 'sad', J = 'joy';
export const MOODS: Record<string, Record<number, Mood>> = {
  // ── 瑪拉 ──
  'c1-open': { 4: S },
  'c1-signal': { 1: S, 4: S, 6: A },
  'c1-limit': { 3: S },
  'hypoxia': { 0: A },
  'c1-end': { 5: S },
  'c2-open': { 1: A },
  'c2-ines': { 0: S, 8: J },
  'c2-pop10': { 5: A },
  'c2-rescue': { 0: S },
  'c2-ship': { 4: A, 7: S },
  'c3-rail': { 4: J },
  'c3-exp1': { 7: A, 9: A },
  'c3-filter': { 5: A },
  'c3-rollcall': { 3: S, 5: S, 7: S },
  'c3-ship': { 6: S },
  'c3-outpost': { 4: A, 6: S },
  'c4-synth': { 12: A },
  'c4-warn': { 1: A, 4: A },
  'c4-raid1': { 0: S, 2: S, 7: A },
  'c4-memorial': { 1: S, 4: S, 7: S },
  'c4-armor': { 5: A },
  'c4-sefa': { 1: A, 7: A },
  'c4-guard': { 6: A },
  'c4-gene': { 5: A },
  'c5-open': { 3: A, 4: A },
  'c5-crowd': { 7: S, 8: S, 10: A },
  'c5-calder': { 3: A, 8: A },
  'c5-charter': { 0: J },
  'c5-debate': { 0: A },
  'c5-coop': { 2: A },
  'c5-voss-leave': { 5: S, 8: S, 9: S },
  'c5-resist': { 10: S, 12: S, 13: S, 15: S, 16: A },
  'c5-warn': { 4: A },
  'c5-alliance1': { 2: A },
  'c5-rifle': { 5: A, 7: S },
  'c5-commando': { 3: S },
  'c5-alliance2': { 5: A },
  'c6-open': { 3: S, 7: S },
  'c6-lastlight': { 1: A, 9: S, 10: S, 11: S, 15: A },
  'c6-debate': { 0: A, 12: S, 13: S, 15: S },
  'c6-stay': { 1: A },
  'c6-blocked': { 4: A, 10: A, 18: J },
  'c6-end': { 8: J, 14: J },
};

export const lineMood = (scene: string, line: number): Mood | undefined => MOODS[scene]?.[line];
