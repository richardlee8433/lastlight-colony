// 手機版面（v0.70.4）：直式寬度 ≤ 640px，或橫式高度 ≤ 500px（平板、電腦不算）。
// 手機上：殖民地面板收成一條膠囊、任務欄與殖民地面板同時只展開一個、建築說明收起來、開場縮短。
import { useEffect, useState } from 'react';
import { create } from 'zustand';

const QUERY = '(max-width: 640px), (max-height: 500px)';
export const isMobile = () => typeof matchMedia === 'function' && matchMedia(QUERY).matches;

/** 畫面大小改變（轉向）時跟著更新 */
export function useMobile() {
  const [m, setM] = useState(isMobile);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia(QUERY), on = () => setM(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return m;
}

/** 手機上左側同時只展開一個面板（任務欄或殖民地面板），避免橫式時疊在一起 */
export const useMobilePanel = create<{ open: 'quest' | 'colony' | null; toggle: (p: 'quest' | 'colony') => void }>((set, get) => ({
  open: null,
  toggle: (p) => set({ open: get().open === p ? null : p }),
}));
