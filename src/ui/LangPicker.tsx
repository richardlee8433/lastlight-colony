import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { LANGS, t, useLang, useSettings } from '../i18n';

/** 地球圖示（常見的「語言」符號），線條跟著文字顏色 */
function Globe() {
  return (
    <svg className="globe" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5M12 2.5C9.4 5.1 8 8.5 8 12s1.4 6.9 4 9.5" />
    </svg>
  );
}

/** 語言選單：按鈕顯示 🌐＋目前語言，點開列出全部語言（首頁右上角與設定頁共用） */
export function LangPicker({ className = '' }: { className?: string }) {
  const lang = useLang(), setLang = useSettings((st) => st.setLang);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('pointerdown', out, true); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', out, true); removeEventListener('keydown', esc); };
  }, [open]);
  const cur = LANGS.find((l) => l.id === lang) ?? LANGS[0];
  return (
    <div className={'lang-picker ' + className} ref={box}>
      <button type="button" className="lang-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={t('set.lang')} title={t('set.lang')} onClick={() => setOpen(!open)}>
        <Globe /><span lang={cur.tag}>{cur.label}</span><i aria-hidden="true">▾</i>
      </button>
      {open && (
        <ul className="lang-list" role="listbox" aria-label={t('set.lang')}>
          {LANGS.map((l) => (
            <li key={l.id} role="option" aria-selected={l.id === lang} lang={l.tag} className={l.id === lang ? 'on' : ''}
              onClick={() => { setLang(l.id); useGame.getState().bump(); setOpen(false); }}>
              {l.label}{l.id === lang && <b aria-hidden="true">✓</b>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
