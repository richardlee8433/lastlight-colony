// 台詞配音清單：檔案放在 public/voice/，檔名是「對話 id-台詞編號.mp3」（編號從 0 開始，照 dialogs.ts 裡的順序）。
// 錄好一句就把 key 加進來；沒列出的台詞照舊只有文字。配音目前是英文，中文介面也播（像看字幕）。
const VOICED = new Set<string>([
  'c1-open-0',   // 瑪拉：Roll call. Raise your hand if you're still breathing.
]);
export const voiceFile = (scene: string, line: number) => (VOICED.has(`${scene}-${line}`) ? `${scene}-${line}.mp3` : null);
