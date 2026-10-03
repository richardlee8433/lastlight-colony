// 其他語言的翻譯包：介面（ui.json，key → 文字）、資料（data.json，跟 data-en.ts 同結構）、
// 劇情（dialogs.json，場景 id → 每句台詞與日誌，照 dialogs.ts 的原順序）。
// 底稿用 scripts/i18n-source.ts 從英文匯出；缺的部分一律退回英文。
import deUi from './de/ui.json'; import deData from './de/data.json'; import deDlg from './de/dialogs.json';
import jaUi from './ja/ui.json'; import jaData from './ja/data.json'; import jaDlg from './ja/dialogs.json';
import esUi from './es/ui.json'; import esData from './es/data.json'; import esDlg from './es/dialogs.json';
import ptUi from './pt/ui.json'; import ptData from './pt/data.json'; import ptDlg from './pt/dialogs.json';

export type PackLang = 'de' | 'ja' | 'es' | 'pt';
export interface Pack {
  ui: Record<string, string>;
  data: any;
  dialogs: Record<string, { lines: string[]; log?: string }>;
}
export const PACKS: Record<PackLang, Pack> = {
  de: { ui: deUi, data: deData, dialogs: deDlg as Pack['dialogs'] },
  ja: { ui: jaUi, data: jaData, dialogs: jaDlg as Pack['dialogs'] },
  es: { ui: esUi, data: esData, dialogs: esDlg as Pack['dialogs'] },
  pt: { ui: ptUi, data: ptData, dialogs: ptDlg as Pack['dialogs'] },
};
