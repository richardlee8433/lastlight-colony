# 把 dist/index.html 轉成 Artifact 用的頁面片段（Artifact 會自己包 <html>/<head>/<body>）
import re, sys, os, base64, json
h = open('dist/index.html', encoding='utf-8').read()
title = re.search(r'<title>.*?</title>', h, re.S).group(0)
links = ''.join(re.findall(r'<link[^>]+fonts[^>]*>', h))
styles = ''.join(re.findall(r'<style[^>]*>.*?</style>', h, re.S))
m = re.search(r'<script type="module"[^>]*>', h)
script = h[m.start():h.rindex('</script>') + 9]
# Artifact 讀不到 voice/ 資料夾：把配音直接內嵌成 data URI（window.__VOICE），遊戲會優先用它
vd = 'public/voice'
voice = {f: 'data:audio/mpeg;base64,' + base64.b64encode(open(os.path.join(vd, f), 'rb').read()).decode()
         for f in sorted(os.listdir(vd)) if f.endswith('.mp3')} if os.path.isdir(vd) else {}
script = f'<script>window.__VOICE={json.dumps(voice)}</script>\n' + script
open(sys.argv[1] if len(sys.argv) > 1 else 'lastlight-colony-game.html', 'w', encoding='utf-8').write(
    f'{title}\n{links}\n{styles}\n<div id="root"></div>\n{script}\n')
