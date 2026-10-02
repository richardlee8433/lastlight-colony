// 台詞配音清單：檔案放在 public/voice/，檔名是「對話 id-台詞編號.mp3」（編號從 0 開始，照 dialogs.ts 裡的順序）。
// 錄好一句就把 key 加到對應語言；沒列出的台詞照舊只有文字。目前只有英文配音，中文介面不播。
const VOICED: Record<'zh' | 'en', Set<string>> = {
  en: new Set([
    // 第 1 章開場（整段 6 句都有配音）
    'c1-open-0',   // 瑪拉：Roll call. Raise your hand if you're still breathing.
    'c1-open-1',   // 提歐：Both hands up. Count me for two breaths.
    'c1-open-2',   // 朱諾：Three hands! ...Okay, one of them is Teo's wrench.
    'c1-open-3',   // 朱諾：What about the other pods?
    'c1-open-4',   // 瑪拉：They have beacons. They'll find us.
    'c1-open-5',   // 瑪拉：Go strip the wreckage for scrap. From now on, we make our own air.
  ]),
  zh: new Set(),   // 中文配音之後放 voice/zh-xxx.mp3
};
export const voiceFile = (scene: string, line: number | 'intro', lang: 'zh' | 'en') => {
  const k = `${scene}-${line}`;
  return VOICED[lang]?.has(k) ? (lang === 'en' ? `${k}.mp3` : `zh-${k}.mp3`) : null;
};
/** 章節開場說明的旁白（瑪拉唸）：檔名 c{章}-intro.mp3，key 也加在上面的清單 */
export const introVoiceFile = (chapter: number, lang: 'zh' | 'en') => voiceFile(`c${chapter}`, 'intro', lang);
