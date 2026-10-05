// 台詞配音清單：檔案放在 public/voice/，檔名是「對話 id-台詞編號.mp3」（編號從 0 開始，照 dialogs.ts 裡的順序）。
// 錄好一句就把 key 加到對應語言；沒列出的台詞照舊只有文字。目前只有英文配音，所有語言（含中文）都播英文、看自己語言的字幕。
const VOICED: Record<'zh' | 'en', Set<string>> = {
  en: new Set([
    'c1-intro',    // 第 1 章開場說明（瑪拉旁白，約 43 秒）
    'c2-intro',    // 第 2 章開場說明（瑪拉旁白，約 29 秒）
    'c3-intro',    // 第 3 章開場說明（約 35 秒）
    'c4-intro',    // 第 4 章開場說明（約 24 秒）
    'c5-intro',    // 第 5 章開場說明（約 33 秒）
    'c6-intro',    // 第 6 章開場說明（約 22 秒）
    // 第 1 章開場（整段 6 句都有配音）
    'c1-open-0',   // 瑪拉：Roll call. Raise your hand if you're still breathing.
    'c1-open-1',   // 提歐：Both hands up. Count me for two breaths.
    'c1-open-2',   // 朱諾：Three hands! ...Okay, one of them is Teo's wrench.
    'c1-open-3',   // 朱諾：What about the other pods?
    'c1-open-4',   // 瑪拉：They have beacons. They'll find us.
    'c1-open-5',   // 瑪拉：Go strip the wreckage for scrap. From now on, we make our own air.
  ]),
  zh: new Set(),   // 中文配音之後放 voice/zh-xxx.mp3；有中文檔就優先播中文，沒有退回英文
};
export const voiceFile = (scene: string, line: number | 'intro', l: string) => {
  const k = `${scene}-${line}`;
  if (l === 'zh' && VOICED.zh.has(k)) return `zh-${k}.mp3`;
  return VOICED.en.has(k) ? `${k}.mp3` : null;
};
/** 章節開場說明的旁白（瑪拉唸）：檔名 c{章}-intro.mp3，key 也加在上面的清單 */
export const introVoiceFile = (chapter: number, lang: string) => voiceFile(`c${chapter}`, 'intro', lang);
