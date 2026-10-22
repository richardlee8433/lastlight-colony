// 入口網站版（CrazyGames 等）：建置時設 VITE_PORTAL=crazygames。
// 這個版本不送匿名遊玩數據、不放對外連結（入口網站通常禁止遊戲自己連外或導流）；其他內容跟一般版完全一樣。
export const PORTAL: string = import.meta.env.VITE_PORTAL ?? '';
export const PORTAL_BUILD = PORTAL !== '';
