// 瀏覽器測試：用模擬器存下的各章存檔（tests/out/snaps）載入 dist/index.html，從玩家的角度檢查畫面。
// 用法：node tests/e2e.cjs（需要 playwright 與 Chromium；tests/run-all.sh 會先 build、產生存檔再呼叫）
// 每項輸出 PASS／FAIL，截圖存在 tests/out/，結果存在 tests/out/e2e.json。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const SNAPS = path.join(OUT, 'snaps');
const PAGE = 'file://' + path.join(ROOT, 'dist/index.html');
const SAVE_KEY = 'lastlight-colony-save-v1';
const results = [];
const snap = (name) => JSON.parse(fs.readFileSync(path.join(SNAPS, name + '.json'), 'utf8'));
// 把事件、襲擊、使者都延後，並清掉存檔當下已經跳出來的事件（例如隕石雨），測試畫面才不會被擋住
const later = (s) => { s.events.active = null; s.lastSaved = Date.now(); s.events.nextAt = s.t + 3000; s.raid.nextAt = s.t + 3000; if (s.gov?.corp) s.gov.corp.nextEnvoy = s.t + 3000; s.story.queue = []; return s; };
const CJK = /[一-鿿]/;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

  /** 開一頁：save 為 null 表示沒有存檔；回傳 page 與這頁收到的錯誤 */
  async function open(save, { lang = 'zh', w = 1600, h = 900, cont = true } = {}) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.addInitScript(([sv, lang, key]) => {
      if (sessionStorage.getItem('x')) return;
      localStorage.clear();
      if (sv) localStorage.setItem(key, sv);
      localStorage.setItem('lastlight-colony-settings', JSON.stringify({ lang }));
      sessionStorage.setItem('x', '1');
    }, [save ? JSON.stringify(save) : null, lang, SAVE_KEY]);
    await p.goto(PAGE); await p.waitForTimeout(1500);
    if (cont) { await p.locator('.tm-btn.main').click(); await p.waitForTimeout(700); }
    return { p, errors };
  }
  /** 關掉跳出來的視窗與對話（modals=false 時只跳過對話） */
  async function clear(p, modals = true) {
    for (let i = 0; i < 60; i++) {
      const did = await p.evaluate((modals) => {
        const b = document.querySelector('.dlg-skip') || (modals && document.querySelector('.modal .btn'));
        if (b) { b.click(); return 1; } return 0;
      }, modals);
      if (!did) { await p.waitForTimeout(400); if (!(await p.evaluate((m) => !!(document.querySelector('.dlg-skip') || (m && document.querySelector('.modal .btn'))), modals))) break; }
      await p.waitForTimeout(200);
    }
  }
  const quest = (p) => p.evaluate(() => ({
    ch: document.querySelector('.quest .chip-ch')?.textContent ?? '',
    count: document.querySelector('.quest .quest-count')?.textContent ?? '',
    goals: [...document.querySelectorAll('.quest li')].map((li) => li.textContent),
  }));
  // ONLY=E05,E06：只跑這些開頭的測試
  const only = process.env.ONLY?.split(',');
  async function test(id, name, fn) {
    if (only && !only.some((o) => id.startsWith(o))) return;
    let errs = [];
    try { errs = (await fn()) ?? []; } catch (e) { errs = ['例外：' + e.message.split('\n')[0]]; }
    results.push({ id, name, ok: errs.length === 0, info: errs.join('；') });
    console.log(`${errs.length ? 'FAIL' : 'PASS'} ${id} ${name}${errs.length ? '\n     → ' + errs.join('；') : ''}`);
  }
  const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + '.png') });

  await test('E01', '新遊戲：開場畫面 → 第一段對話有名字與文字，沒有殘留參數', async () => {
    const { p, errors } = await open(null, { cont: false });
    const errs = [];
    await p.locator('.tm-btn.main').click(); await p.waitForTimeout(800);
    for (let i = 0; i < 5 && !(await p.locator('.dlg-box').count()); i++) { await p.evaluate(() => document.querySelector('.modal .btn')?.click()); await p.waitForTimeout(600); }
    await p.waitForTimeout(2500);
    const d = await p.evaluate(() => ({ who: document.querySelector('.dlg-name')?.textContent ?? '', text: document.querySelector('.dlg-box p')?.textContent ?? '' }));
    if (!d.text.trim()) errs.push('沒有出現對話');
    if (/\{|undefined/.test(d.text)) errs.push('對話有殘留參數：' + d.text);
    await shot(p, 'E01-new-game');
    if (errors.length) errs.push('頁面錯誤：' + errors[0]);
    await p.close(); return errs;
  });

  for (const [snapName, n] of [['ch2', 2], ['ch3', 3], ['ch4', 4], ['ch5', 5], ['ch6', 6]]) {
    await test(`E02-${n}`, `第 ${n} 章存檔：任務欄章節正確、計數與清單一致、沒有殘留參數`, async () => {
      const { p, errors } = await open(later(snap(snapName)));
      await clear(p);
      const q = await quest(p), errs = [];
      if (!q.ch.includes(String(n))) errs.push(`任務欄顯示「${q.ch}」`);
      const m = q.count.match(/(\d+)\/(\d+)/);
      if (m && Number(m[2]) !== q.goals.length) errs.push(`計數 ${q.count}，清單 ${q.goals.length} 項`);
      if (q.goals.some((g) => /\{|undefined/.test(g))) errs.push('目標有殘留參數');
      await shot(p, `E02-ch${n}`);
      if (errors.length) errs.push('頁面錯誤：' + errors[0]);
      await p.close(); return errs;
    });
  }

  await test('E03', '第 4 章：第一次襲擊前看不到營區、醫療艙目標；襲擊後出現', async () => {
    const errs = [];
    const pre = later(snap('ch4-preraid'));
    for (const id of ['security', 'med_bay']) pre.b[id].level = 0;
    pre.story.done = pre.story.done.filter((g) => g !== '4-0' && g !== '4-med');
    let { p } = await open(pre); await clear(p);
    let q = await quest(p);
    if (q.goals.some((g) => g.includes('營區') || g.includes('醫療艙'))) errs.push('襲擊前就出現：' + q.goals.join(' / '));
    if (!q.goals[0]?.includes('異晶合成室')) errs.push('第一個目標不是合成室');
    await p.close();
    ({ p } = await open(later(snap('ch4-postraid')))); await clear(p);
    q = await quest(p);
    if (!q.goals.some((g) => g.includes('營區'))) errs.push('襲擊後沒出現營區');
    if (!q.goals.some((g) => g.includes('醫療艙'))) errs.push('襲擊後沒出現醫療艙');
    await p.close(); return errs;
  });

  await test('E04', '逃生艙：紀念堂蓋好前在建造列，蓋好後退役（建造列、地圖都消失）', async () => {
    const errs = [];
    let { p } = await open(later(snap('ch3'))); await clear(p);
    if (!(await p.locator('.qb[title="逃生艙"]').count())) errs.push('第 3 章建造列沒有逃生艙');
    await p.close();
    const s = later(snap('ch5')); s.b.memorial.level = Math.max(1, s.b.memorial.level);
    ({ p } = await open(s)); await clear(p);
    if (await p.locator('.qb[title="逃生艙"]').count()) errs.push('紀念堂蓋好後建造列還有逃生艙');
    await p.close(); return errs;
  });

  await test('E05', '寬螢幕縮到最小、拖到角落：截圖（黑邊由 run-all 的影像檢查判定）', async () => {
    const { p } = await open(later(snap('ch3')), { w: 2000, h: 1100 }); await clear(p);
    await p.mouse.move(1000, 550);
    for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(200); }
    // 拖到左上角再拖到右下角，各截一張
    await p.mouse.move(1000, 900); await p.mouse.down(); await p.mouse.move(1900, 1050, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(600);
    await shot(p, 'E05-zoomout-a');
    await p.mouse.move(1000, 900); await p.mouse.down(); await p.mouse.move(100, 120, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(600);
    await shot(p, 'E05-zoomout-b');
    await p.close(); return [];
  });

  await test('E06', '科技樹開著時研究倒數照常前進', async () => {
    const s = later(snap('ch5'));
    const { RESEARCH } = { RESEARCH: JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/research.json'), 'utf8')) };
    const todo = RESEARCH.find((r) => !s.research.done.includes(r.id) && (r.stage ?? 1) <= s.stage && !r.lab);
    if (!todo) return ['找不到可以研究的項目'];
    s.research.active = todo.id; s.research.progress = 1; s.b.databank.workers = Math.max(1, s.b.databank.workers);
    const { p } = await open(s); await clear(p);
    await p.locator('.topbar ~ * button, button', { hasText: '科技' }).first().click(); await p.waitForTimeout(400);
    const read = () => p.evaluate(() => { const m = document.querySelector('.modal.tech')?.innerText.match(/剩 ?(?:(\d+) ?分 ?)?(\d+) ?秒/); return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : null; });
    const a = await read(); await p.waitForTimeout(4000); const c = await read();
    await p.close();
    if (a == null || c == null) return ['讀不到倒數'];
    return a - c >= 3 ? [] : [`4 秒內倒數只減少 ${a - c} 秒（${a} → ${c}）`];
  });

  await test('E07', '暫停：按 P 出現暗幕、資源不動；再按一次恢復', async () => {
    const { p } = await open(later(snap('ch3'))); await clear(p);
    const errs = [];
    const res = () => p.evaluate(() => document.querySelector('.topbar .res b')?.textContent);
    await p.keyboard.press('p'); await p.waitForTimeout(400);
    if (!(await p.locator('.paused-veil').count())) errs.push('沒有暗幕');
    const r1 = await res(); await p.waitForTimeout(2500); const r2 = await res();
    if (r1 !== r2) errs.push(`暫停時資源還在變（${r1} → ${r2}）`);
    await p.keyboard.press('p'); await p.waitForTimeout(400);
    if (await p.locator('.paused-veil').count()) errs.push('再按 P 沒有恢復');
    await p.close(); return errs;
  });

  await test('E08', '英文介面：任務欄沒有中文', async () => {
    const { p } = await open(later(snap('ch4')), { lang: 'en' }); await clear(p);
    const q = await quest(p);
    await shot(p, 'E08-english');
    await p.close();
    return [q.ch, ...q.goals].filter((x) => CJK.test(x)).map((x) => '有中文：' + x);
  });

  await test('E09', '存檔與讀檔：玩幾秒、重新整理、繼續，章節與人口一致', async () => {
    const { p } = await open(later(snap('ch3'))); await clear(p);
    await p.waitForTimeout(3000);
    const before = await quest(p);
    const pop1 = await p.evaluate(() => JSON.parse(localStorage.getItem('lastlight-colony-save-v1') || '{}').stage);
    await p.reload(); await p.waitForTimeout(1500);
    await p.locator('.tm-btn.main').click(); await p.waitForTimeout(700); await clear(p);
    const after = await quest(p);
    await p.close();
    const errs = [];
    if (before.ch !== after.ch) errs.push(`章節 ${before.ch} → ${after.ch}`);
    if (pop1 !== 3) errs.push('存檔的章節不是 3：' + pop1);
    return errs;
  });

  for (const kind of ['alien', 'commando']) {
    await test(`E10-${kind}`, `${kind === 'alien' ? '微光獸' : '企業突擊隊'}襲擊：交火、擊退戰報`, async () => {
      const s = later(snap('ch5'));
      s.raid.nextAt = s.t + 10; s.raid.incoming = { at: s.t + 10, enemies: 5, atk: 4, hp: 15, side: 0, kind };
      const { p, errors } = await open(s); await clear(p);
      await p.waitForTimeout(4000); await shot(p, `E10-${kind}-fight`);
      for (let i = 0; i < 60 && !(await p.locator('.modal h2').count()); i++) await p.waitForTimeout(250);
      const title = await p.locator('.modal h2').first().textContent().catch(() => '');
      await p.close();
      const errs = [];
      if (!title.includes('擊退')) errs.push('戰報標題：' + title);
      if (errors.length) errs.push('頁面錯誤：' + errors[0]);
      return errs;
    });
  }

  await test('E11', '第 6 章抉擇：討論播完後跳出「這是誰的家？」三個選項；船還沒造好時「離開」是灰的', async () => {
    const s = snap('ch6-choice'); s.lastSaved = Date.now(); s.events.active = null;
    const { p } = await open(s); await clear(p, false);
    for (let i = 0; i < 20 && !(await p.locator('.modal h2').count()); i++) { await clear(p, false); await p.waitForTimeout(300); }
    // 章節開場之類的視窗先關掉，直到出現抉擇
    for (let i = 0; i < 6; i++) {
      const h = await p.locator('.modal h2').first().textContent().catch(() => '');
      if (h.includes('這是誰的家')) break;
      await p.evaluate(() => document.querySelector('.modal .btn')?.click()); await p.waitForTimeout(400); await clear(p, false);
    }
    const h = await p.locator('.modal h2').first().textContent().catch(() => '');
    const opts = await p.locator('.modal .btn').allTextContents();
    const leaveOff = await p.locator('.modal .btn').first().isDisabled().catch(() => false);
    await shot(p, 'E11-choice');
    await p.close();
    const errs = [];
    if (!h.includes('這是誰的家')) errs.push('沒有出現抉擇，看到：' + h);
    if (opts.length !== 3) errs.push('選項數量：' + opts.length);
    if (!leaveOff || !opts[0]?.includes('還沒造好')) errs.push('船沒造好，「離開」應該是灰的並註明：' + opts[0]);
    if (!opts[2]?.includes('先等等')) errs.push('第三個選項應該是「先等等」：' + opts[2]);
    return errs;
  });

  for (const choice of ['stay', 'leave']) {
    await test(`E12-${choice}`, `結局（${choice === 'stay' ? '保留異晶' : '放棄異晶'}）：結局對話播完才出現結局畫面`, async () => {
      const s = later(snap('end'));
      s.story.choice6 = choice; s.finished = true; s.b.orbital_beacon.level = 5;
      s.story.seen = s.story.seen.filter((x) => x !== 'c6-end' && x !== 'c6-blocked');
      const { p } = await open(s);
      // 結局畫面不能比對話先出現
      await p.waitForTimeout(800);
      const early = await p.locator('.modal h2').first().textContent().catch(() => '');
      await clear(p, false);
      await p.waitForTimeout(800);
      const h = await p.locator('.modal h2').first().textContent().catch(() => '');
      await shot(p, `E12-${choice}`);
      await p.close();
      const want = choice === 'stay' ? '有人來敲門了' : '擋在星空之前', errs = [];
      if (early.includes(want)) errs.push('結局畫面比對話先出現');
      if (!h.includes(want)) errs.push('結局畫面：' + h);
      return errs;
    });
  }

  // ── 日夜（純畫面） ──
  /** 把存檔時間設成一天（300 秒）裡的某個比例 */
  const at = (s, p) => { s.t = Math.floor(s.t / 300) * 300 + p * 300; return s; };
  const scene = (p, fn, arg) => p.evaluate(fn, arg);
  await test('E13', '日夜：白天環境光正常；夜晚變暗變藍、建築亮燈', async () => {
    const errs = [];
    for (const [name, frac, night] of [['白天', 0.2, false], ['夜晚', 0.75, true]]) {
      const { p } = await open(later(at(snap('ch6'), frac))); await clear(p); await p.waitForTimeout(600);
      const r = await scene(p, () => {
        const s = window.__scene, t = s.overlay.tint, lum = ((t >> 16) & 255) * 0.3 + ((t >> 8) & 255) * 0.6 + (t & 255) * 0.1;
        // 建築發光層（夜晚亮燈）：每棟建築 lights 裡的子圖，取最亮的
        let lit = 0; for (const v of s.views.values()) for (const c of v.lights?.children ?? []) if (c.blendMode === 'add') lit = Math.max(lit, c.alpha);
        return { lum, blue: (t & 255) > ((t >> 16) & 255), lit };
      });
      if (night && !(r.lum < 140 && r.blue)) errs.push(`${name}環境光不夠暗或不偏藍（亮度 ${r.lum.toFixed(0)}）`);
      if (!night && r.lum < 200) errs.push(`${name}環境光太暗（${r.lum.toFixed(0)}）`);
      if (night && r.lit < 0.8) errs.push(`${name}建築沒亮燈（${r.lit.toFixed(2)}）`);
      await shot(p, `E13-${night ? 'night' : 'day'}`);
      await p.close();
    }
    return errs;
  });

  await test('E14', '影子：落在右下（翻到地上、往右斜）；清晨比中午長；夜晚消失', async () => {
    const errs = [], read = (p) => scene(p, () => { const s = window.__scene; const sh = [...s.views.values()].map((v) => v.shadow).find(Boolean); return sh ? { sy: sh.scale.y, skew: sh.skew.x, a: sh.alpha, len: s.sun.len } : null; });
    const got = {};
    for (const [name, frac] of [['清晨', 0.06], ['中午', 0.28], ['夜晚', 0.75]]) {
      const { p } = await open(later(at(snap('ch6'), frac))); await clear(p); await p.waitForTimeout(600);
      got[name] = await read(p); await p.close();
      if (!got[name]) return ['沒有建築影子'];
    }
    for (const n of ['清晨', '中午']) {
      if (!(got[n].sy < 0)) errs.push(`${n}影子沒有翻到地上`);
      if (!(got[n].skew > 0)) errs.push(`${n}影子沒有往右斜（${got[n].skew.toFixed(2)}）`);
      if (!(got[n].a > 0.15)) errs.push(`${n}影子太淡（${got[n].a.toFixed(2)}）`);
    }
    if (!(got['清晨'].len > got['中午'].len)) errs.push(`清晨影子沒有比中午長（${got['清晨'].len.toFixed(2)} / ${got['中午'].len.toFixed(2)}）`);
    if (!(got['夜晚'].a < 0.03)) errs.push(`夜晚影子沒有消失（${got['夜晚'].a.toFixed(2)}）`);
    return errs;
  });

  await test('E15', '設定頁「日夜變化」：夜晚時關掉立刻變白天，重新整理後仍然關著', async () => {
    const errs = [];
    const { p } = await open(later(at(snap('ch6'), 0.75))); await clear(p); await p.waitForTimeout(500);
    const lum = () => scene(p, () => { const t = window.__scene.overlay.tint; return ((t >> 16) & 255) * 0.3 + ((t >> 8) & 255) * 0.6 + (t & 255) * 0.1; });
    const before = await lum();
    await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '≡')?.click());
    await p.waitForTimeout(400);
    const box = p.locator('label.check', { hasText: '日夜變化' }).locator('input');
    if (!(await box.count())) { await p.close(); return ['設定頁沒有「日夜變化」']; }
    if (!(await box.isChecked())) errs.push('預設不是打開');
    await box.click({ timeout: 5000 }).catch((e) => { throw new Error(e.message.split('\n').filter((l) => /intercept|visible|stable|enabled/.test(l)).slice(0, 3).join(' | ') || e.message.slice(0, 200)); }); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.close')?.click()); await p.waitForTimeout(500);
    const after = await lum();
    if (!(before < 140 && after > 200)) errs.push(`關掉後環境光 ${before.toFixed(0)} → ${after.toFixed(0)}`);
    await p.reload(); await p.waitForTimeout(1500); await p.locator('.tm-btn.main').click(); await p.waitForTimeout(800); await clear(p);
    if ((await lum()) < 200) errs.push('重新整理後又變回夜晚');
    await p.close(); return errs;
  });

  await test('E16', '小人站在建築影子裡會變暗', async () => {
    const { p } = await open(later(at(snap('ch6'), 0.06))); await clear(p);
    // 小人隨機走動，不一定剛好有人在影子裡：最多看 15 秒，有人變暗就通過
    let r = { n: 0, dark: 0 };
    for (let i = 0; i < 15 && !r.dark; i++) {
      await p.waitForTimeout(1000);
      r = await scene(p, () => {
        const s = window.__scene, us = [...s.walkers, ...s.patrols];
        return { n: us.length, dark: us.filter((u) => (u.shade ?? 0) > 0.5).length };
      });
    }
    await p.close();
    if (!r.n) return ['地圖上沒有小人'];
    return r.dark ? [] : [`${r.n} 個小人，沒有一個在影子裡變暗`];
  });

  await test('E17', '效能：手機尺寸、CPU 降速 4 倍，日夜開／關的每幀場景運算時間', async () => {
    const res = {};
    for (const on of [true, false]) {
      const s = later(at(snap('ch6'), 0.06));
      const { p } = await open(s, { w: 390, h: 844 });
      if (!on) await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('lastlight-colony-settings')); v.dayNight = false; localStorage.setItem('lastlight-colony-settings', JSON.stringify(v)); });
      if (!on) { await p.reload(); await p.waitForTimeout(1500); await p.locator('.tm-btn.main').click(); await p.waitForTimeout(700); }
      await clear(p);
      const cdp = await p.context().newCDPSession(p);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      res[on ? 'on' : 'off'] = await p.evaluate(() => new Promise((done) => {
        const s = window.__scene, orig = s.frame.bind(s); let n = 0, tot = 0, worst = 0;
        s.frame = (dt) => { const t0 = performance.now(); orig(dt); const d = performance.now() - t0; n++; tot += d; worst = Math.max(worst, d); };
        setTimeout(() => { s.frame = orig; done({ avg: tot / Math.max(1, n), worst, frames: n }); }, 5000);
      }));
      await p.close();
    }
    const on = res.on, off = res.off;
    const info = `開 ${on.avg.toFixed(2)} ms（最差 ${on.worst.toFixed(1)}）／關 ${off.avg.toFixed(2)} ms（最差 ${off.worst.toFixed(1)}）`;
    console.log('     效能：' + info);
    fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(res, null, 1));
    // 一幀 16.7ms；日夜多出來的場景運算超過 4ms（降速後）就算太重
    return on.avg - off.avg > 4 ? ['日夜多出的運算太重：' + info] : [];
  });

  await test('E18', '腳印：沙地上會留下、每人最多 3 個；鋪過的路面上沒有腳印', async () => {
    const errs = [];
    for (const [name, snapName] of [['第 2 章（全是沙地）', 'ch2'], ['第 6 章（有石磚、金屬路）', 'ch6']]) {
      const { p } = await open(later(snap(snapName))); await clear(p);
      await p.waitForTimeout(8000);
      const r = await scene(p, () => {
        const s = window.__scene, us = [...s.walkers, ...s.patrols, ...s.defenders];
        let total = 0, max = 0, onPaved = 0;
        // 淡出中的（gone）不算在 3 個裡
        for (const u of us) for (const q of u.prints ?? []) { total++; if (s.ground.paved(q.x, q.y)) onPaved++; }
        for (const u of us) max = Math.max(max, (u.prints ?? []).filter((q) => q.gone == null).length);
        return { total, max, onPaved };
      });
      await p.close();
      if (snapName === 'ch2' && !r.total) errs.push(`${name}沒有腳印`);
      if (r.max > 3) errs.push(`${name}有人留了 ${r.max} 個腳印`);
      if (r.onPaved) errs.push(`${name}有 ${r.onPaved} 個腳印在鋪過的路面上`);
    }
    return errs;
  });

  await test('E19', '作息：傍晚去休閒艙、晚上回生活艙進門、白天照常工作；日夜關掉時一直工作', async () => {
    const errs = [];
    // 無頭瀏覽器每秒只畫幾幀，直接推進場景邏輯 25 秒
    const run = (p) => scene(p, () => {
      const s = window.__scene; for (let i = 0; i < 25 * 30; i++) s.frame(1 / 30);
      const ws = s.walkers, near = (w, id) => { const v = s.views.get(id); return v && Math.hypot(w.px - v.x, w.py - v.y) < 60; };
      return { n: ws.length, lounge: ws.filter((w) => near(w, 'lounge')).length, hidden: ws.filter((w) => !w.visible).length, off: ws.filter((w) => w.ai.off).length };
    });
    for (const [name, frac, check] of [
      ['傍晚', 0.64, (r) => r.lounge >= r.n * 0.8 ? '' : `只有 ${r.lounge}/${r.n} 人在休閒艙`],
      ['晚上', 0.8, (r) => r.hidden >= r.n * 0.8 ? '' : `只有 ${r.hidden}/${r.n} 人進門睡覺`],
      ['白天', 0.3, (r) => (!r.off && !r.hidden) ? '' : `白天還有 ${r.off} 人下班、${r.hidden} 人看不見`],
    ]) {
      const { p } = await open(later(at(snap('ch4'), frac))); await clear(p);
      const r = await run(p); await p.close();
      if (!r.n) { errs.push(name + '沒有工人'); continue; }
      const e = check(r); if (e) errs.push(name + '：' + e);
    }
    // 日夜關掉：晚上也照常工作
    const s = later(at(snap('ch4'), 0.8));
    const { p } = await open(s);
    await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('lastlight-colony-settings')); v.dayNight = false; localStorage.setItem('lastlight-colony-settings', JSON.stringify(v)); });
    await p.reload(); await p.waitForTimeout(1500); await p.locator('.tm-btn.main').click(); await p.waitForTimeout(700); await clear(p);
    const r = await run(p); await p.close();
    if (r.off || r.hidden) errs.push(`日夜關掉時晚上還有 ${r.off} 人下班`);
    return errs;
  });

  await test('E20', '地圖上的小人數：人口 10 以內全部，之後每 10 人多 1 個；有工人的建築至少 1 個', async () => {
    const errs = [], rows = [];
    for (const n of ['ch2', 'ch4', 'ch6']) {
      const { p } = await open(later(at(snap(n), 0.3))); await clear(p); await p.waitForTimeout(800);
      const r = await scene(p, () => {
        const s = window.__scene, st = JSON.parse(localStorage.getItem('lastlight-colony-save-v1')), pop = st.pop;
        const want = pop <= 10 ? pop : 10 + Math.floor((pop - 10) / 10);
        const by = {}; for (const w of s.walkers) { const k = w.ai.bid ?? '__idle'; by[k] = (by[k] ?? 0) + 1; }
        const staffed = Object.entries(st.b).filter(([id, b]) => id !== 'security' && b.level > 0 && b.workers > 0 && [...s.views.values()].some((v) => v.bid === id)).map(([id]) => id);
        return { pop, want, shown: s.walkers.length, staffed: staffed.length, covered: staffed.filter((id) => by[id]).length };
      });
      await p.close();
      rows.push(`${n} 人口 ${r.pop} → ${r.shown}`);
      if (r.shown > r.want) errs.push(`${n}：人口 ${r.pop} 應最多 ${r.want} 個，畫了 ${r.shown}`);
      if (r.staffed <= r.want && r.covered < r.staffed) errs.push(`${n}：${r.staffed} 棟有工人，只有 ${r.covered} 棟有小人`);
    }
    console.log('     ' + rows.join('；'));
    return errs;
  });

  await test('E21', '鋪路後殖民者（陸戰隊除外）全天都走在路面上：白天上工、傍晚去休閒艙、晚上回生活艙、清晨出門', async () => {
    const errs = [];
    for (const [name, frac, sec] of [['白天', 0.3, 20], ['傍晚', 0.6, 40], ['晚上', 0.71, 25], ['清晨', 0.94, 30]]) {
      const { p } = await open(later(at(snap('ch4'), frac))); await clear(p);
      const r = await scene(p, (sec) => {
        const s = window.__scene; let moving = 0, onRoad = 0; const off = [];
        for (let i = 0; i < sec * 30; i++) {
          const before = new Map(s.walkers.map((w) => [w, [w.px, w.py]]));
          s.frame(1 / 30);
          if (i % 3) continue;
          for (const w of s.walkers) {
            const b = before.get(w); if (!b || !w.visible || w.alpha < 0.9) continue;
            if (Math.hypot(w.px - b[0], w.py - b[1]) < 0.05) continue;   // 只看正在走的
            moving++;
            if (s.ground.paved(w.px, w.py)) onRoad++; else if (off.length < 3) off.push(`${Math.round(w.px)},${Math.round(w.py)} ${w.ai.off ?? 'work'}`);
          }
        }
        return { moving, onRoad, off };
      }, sec);
      await p.close();
      const ratio = r.onRoad / Math.max(1, r.moving);
      console.log(`     ${name}：走路樣本 ${r.moving}，在路面上 ${(ratio * 100).toFixed(1)}%${r.off.length ? '（例：' + r.off.join('；') + '）' : ''}`);
      if (r.moving && ratio < 0.97) errs.push(`${name}只有 ${(ratio * 100).toFixed(1)}% 在路面上`);
    }
    return errs;
  });

  await test('E22', '舊存檔的異星研究院（v0.70 以前是獨立建築）讀進來會併進科技研究院：改建成異星形態、研究員搬過去', async () => {
    const save = later(snap('ch5'));
    const from = Object.keys(save.b).find((id) => id !== 'databank' && id !== 'security' && save.b[id].workers >= 2);
    save.b[from].workers -= 2;
    save.b.databank.level = Math.max(save.b.databank.level, 2); save.b.databank.form = 0;
    const before = save.b.databank.workers;
    save.b.xeno_lab = { level: 2, workers: 2, nodes: [] };
    const { p, errors } = await open(save); await clear(p);
    await p.waitForTimeout(11000);   // 等自動存檔
    const st = await p.evaluate(() => JSON.parse(localStorage.getItem('lastlight-colony-save-v1')));
    await p.close();
    const errs = [...errors];
    if (st.b.xeno_lab) errs.push('xeno_lab 還在存檔裡');
    if ((st.b.databank.form ?? 0) < 1) errs.push(`科技研究院沒有改建（form ${st.b.databank.form}）`);
    if (st.b.databank.workers < before + 2 && st.b.databank.workers < st.b.databank.level * 3) errs.push(`研究員沒有搬過去：${before} → ${st.b.databank.workers}`);
    return errs;
  });

  await b.close();
  fs.writeFileSync(path.join(OUT, 'e2e.json'), JSON.stringify(results, null, 1));
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n瀏覽器測試：${results.length - fail}/${results.length} 通過`);
  process.exit(fail ? 1 : 0);
})();
