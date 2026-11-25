from pathlib import Path
from bs4 import BeautifulSoup
import json, shutil, html

root=Path(__file__).resolve().parents[1];source=root.parent/'candy-static';dist=source/'dist'
routes=json.loads((source/'reference/site-expansion/route-map.json').read_text(encoding='utf8'))
catalog=json.loads((root/'public/catalog.json').read_text(encoding='utf8'))
profiles={c['route']:c['id'] for c in catalog if c.get('route')}
runtime='window.CANDY_ROUTES='+json.dumps(routes)+';\nwindow.CANDY_PROFILE_LOOKUP='+json.dumps(profiles)+';\n'+(source/'site-runtime.source.js').read_text(encoding='utf8')
(dist/'site-runtime.js').write_text(runtime,encoding='utf8')
for file in ['app.js','app.css','admin-ui.js','i18n.js','data.js','catalog.json']:shutil.copy2(root/'public'/file,dist/file)
app=(root/'public/index.html').read_text(encoding='utf8').replace('content="server"','content="static"').replace('href="/','href="').replace('src="/','src="')
(dist/'app.html').write_text(app,encoding='utf8')
homepage=BeautifulSoup((dist/'index.html').read_text(encoding='utf8'),'html.parser')
if not homepage.select_one('script[src="site-runtime.js"]'):
    js=homepage.new_tag('script',src='site-runtime.js',defer=True);homepage.body.append(js)
(dist/'index.html').write_text(str(homepage),encoding='utf8')
styles='\n.snapshot-tools{position:fixed;right:16px;bottom:16px;z-index:150;display:flex;gap:10px;align-items:center;background:#281c2deb;color:#e8cada;border:1px solid #654160;border-radius:24px;padding:9px 16px;font:12px Poppins,Arial,sans-serif;box-shadow:0 4px 24px #0005}.snapshot-tools a{color:#ffd3e4;text-decoration:none}.snapshot-tools a:hover{text-decoration:underline}@media(max-width:767px){.snapshot-tools{bottom:85px;right:8px;left:8px;justify-content:center;font-size:11px}}\n'
p=dist/'preview.css';css=p.read_text(encoding='utf8');
if '.snapshot-tools{' not in css:p.write_text(css+styles,encoding='utf8')
rows=''.join('<tr><td>'+html.escape(route)+'</td><td><a href="'+html.escape(local)+'">Open snapshot</a></td></tr>' for route,local in routes.items())
index='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Candy Static Page Index</title><link rel="stylesheet" href="app.css"></head><body><div class="content" style="max-width:1100px"><a class="brand" href="index.html">candy<span>.ai</span></a><h1 style="margin-top:30px">Static page index</h1><p class="muted">60 public snapshots, 63 mapped paths. Login-only and lazy-loaded source states are documented in the coverage report. This is not a claim of complete source-site parity.</p><div class="row"><a class="btn" href="index.html">Original homepage snapshot</a><a class="btn secondary" href="app.html#home">Interactive offline demo</a></div><div class="panel section"><table><thead><tr><th>Source route</th><th>Local page</th></tr></thead><tbody>'''+rows+'''</tbody></table></div></div></body></html>'''
index=index.replace('60 public snapshots, 63 mapped paths',str(len(list((dist/'pages').glob('*.html'))))+' public snapshots, '+str(len(routes))+' mapped paths')
(dist/'site-map.html').write_text(index,encoding='utf8')
print(json.dumps({'snapshots':len(list((dist/'pages').glob('*.html'))),'routeMappings':len(routes),'offlineApp':str(dist/'app.html')}))
