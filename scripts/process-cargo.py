# 喜鵲號空投：貨櫃與降落傘（兩張分開，遊戲裡降落傘會搖晃、落地時塌下來）
# 原圖：art-src/sprites/cargo_crate.webp、cargo_chute.webp（透明背景）　輸出：src/assets/sprites/cargo_*.png
# 用法：python3 scripts/process-cargo.py（需要 pillow）
from PIL import Image
RES = 4  # 跟手繪建築一樣：每個地圖像素 4 個圖像素
# 地圖上的寬度（地圖像素）：交易站約 84 寬
SIZES = {'cargo_crate': 14, 'cargo_chute': 34}
for name, w in SIZES.items():
    im = Image.open(f'art-src/sprites/{name}.webp').convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
    ow = w * RES
    oh = round(im.height * ow / im.width)
    # 預乘透明度再縮，邊緣不會帶出背景的黑色
    out = im.convert('RGBa').resize((ow, oh), Image.LANCZOS).convert('RGBA')
    out.save(f'src/assets/sprites/{name}.png', optimize=True)
    print(name, out.size)
