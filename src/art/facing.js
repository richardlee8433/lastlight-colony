/** 小人的面向（上／下／側面、側面是否左右翻轉），依移動方向決定。純函式，tests/static.ts 直接測它。
 *  位置會四捨五入成整數，每幀的位移在高更新率螢幕上只有零點幾像素，取整後忽左忽下。
 *  所以每走滿 2 像素才判斷一次方向（跟更新率、取整無關），再加上遲滯，避免來回切換。
 *  只有在走路時才依移動方向轉身；停下來時保持原本的方向（工作、射擊時由 face／setWork 決定）
 *  st：{ facing: 'down' | 'up' | 'side', flip, moving, lx, ly, vx, vy } */
export function stepFacing(st, x, y) {
  if (!st.moving || st.lx == null) { st.vx = 0; st.vy = 0; st.lx = x; st.ly = y; return; }
  const dx = x - st.lx, dy = y - st.ly;
  if (Math.hypot(dx, dy) < 2) return;
  st.vx = st.vx * 0.5 + dx * 0.5; st.vy = st.vy * 0.5 + dy * 0.5;
  const ax = Math.abs(st.vx), ay = Math.abs(st.vy);
  if (st.facing === 'side') { if (ay > ax * 1.8) st.facing = st.vy > 0 ? 'down' : 'up'; }
  else if (ax > ay * 1.8) st.facing = 'side';
  else st.facing = st.vy > 0 ? 'down' : 'up';
  // 左右翻轉要有明顯的反向移動才發生（路線轉折點的小偏移不會讓人左右抖）
  if (st.flip ? st.vx > 0.4 : st.vx < -0.4) st.flip = !st.flip;
  st.lx = x; st.ly = y;
}
