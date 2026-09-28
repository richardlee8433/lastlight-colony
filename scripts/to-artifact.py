# 把 dist/index.html 轉成 Artifact 用的頁面片段（Artifact 會自己包 <html>/<head>/<body>）
import re, sys
h = open('dist/index.html', encoding='utf-8').read()
title = re.search(r'<title>.*?</title>', h, re.S).group(0)
links = ''.join(re.findall(r'<link[^>]+fonts[^>]*>', h))
styles = ''.join(re.findall(r'<style[^>]*>.*?</style>', h, re.S))
m = re.search(r'<script type="module"[^>]*>', h)
script = h[m.start():h.rindex('</script>') + 9]
open(sys.argv[1] if len(sys.argv) > 1 else 'lastlight-colony-game.html', 'w', encoding='utf-8').write(
    f'{title}\n{links}\n{styles}\n<div id="root"></div>\n{script}\n')
