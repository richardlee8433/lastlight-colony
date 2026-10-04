/**
 * 鎖住整頁捲動：Threads、Instagram 等 App 內建瀏覽器常無視畫布的 touch-action，
 * 往下滑地圖會把整個網頁（甚至瀏覽器面板）一起拖走。
 * 這裡攔下觸控滑動的預設動作，只放行真的能捲動的面板（設定、日誌、科技樹…）與滑桿。
 */
function canScroll(el: Element | null): boolean {
  for (; el && el !== document.body; el = el.parentElement) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
    const st = getComputedStyle(el);
    const y = /(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const x = /(auto|scroll)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (x || y) return true;
  }
  return false;
}

export function installNoScroll() {
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 || !canScroll(e.target as Element)) e.preventDefault();
  }, { passive: false });
}
