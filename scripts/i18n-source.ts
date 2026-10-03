// 匯出英文原文（翻譯底稿）：npx tsx scripts/i18n-source.ts <輸出資料夾>
// ui.json：介面文字 {key: 英文}；data.json：建築、研究、憲章、章節、事件（同 data-en.ts 結構）；
// dialogs.json：{場景 id: { lines: [每句英文，照原順序], log?: 日誌英文 }}
import { writeFileSync, mkdirSync } from 'fs';
import { STRINGS } from '../src/i18n/strings';
import EN from '../src/i18n/data-en';
import { SCENES } from '../src/data/dialogs';
const out = process.argv[2] ?? 'i18n-source';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/ui.json`, JSON.stringify(Object.fromEntries(Object.entries(STRINGS).map(([k, v]) => [k, v[0]])), null, 1));
writeFileSync(`${out}/data.json`, JSON.stringify(EN, null, 1));
writeFileSync(`${out}/dialogs.json`, JSON.stringify(Object.fromEntries(Object.entries(SCENES).map(([id, sc]) => [id, { lines: sc.lines.map((l) => l[2]), ...(sc.log ? { log: sc.log[1] } : {}) }])), null, 1));
