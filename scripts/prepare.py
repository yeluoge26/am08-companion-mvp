from pathlib import Path
from bs4 import BeautifulSoup
import json, shutil, hashlib

root=Path(__file__).resolve().parents[1]
source=root.parent/'candy-static'
public=root/'public'
public.mkdir(exist_ok=True)
manifest=json.loads((source/'asset-manifest.json').read_text(encoding='utf8'))['assets']
extra=source/'expansion-manifest.json'
if extra.exists():manifest.update(json.loads(extra.read_text(encoding='utf8'))['assets'])
catalog=json.loads((source/'reference/site-expansion/catalog.json').read_text(encoding='utf8'))
for c in catalog:
    c['style']='Anime' if c.get('category')=='anime' else 'Realistic'
    c['gender']='male' if c.get('category')=='guys' else 'female'
    c['age']=c.get('age')
    c['description']='A public character profile. Start a conversation or add this character to your collection.'
    c['owner_id']=None
    c['settings']={'ageKnown':c.get('age') is not None}
soup=BeautifulSoup((source/'dist/index.html').read_text(encoding='utf8'),'html.parser')
slides=[]
for s in soup.select('[aria-roledescription=slide]'):
    bg=s.select_one('.hero-background'); word=s.select_one('.hero-wordmark')
    if bg: slides.append({'image':bg.get('src'),'wordmark':word.get('src') if word else None,'title':s.select_one('a').get('aria-label','Explore Candy'),'subtitle':s.select_one('.hero-subtitle').get_text(strip=True) if s.select_one('.hero-subtitle') else 'Meet your next AI companion'})
videos=[]
for i,v in enumerate(json.loads((source/'reference/videos.json').read_text(encoding='utf8'))):
    item=manifest.get(v['src']); poster=manifest.get(v.get('poster'))
    if item and not any(x['src']==item['path'] for x in videos):
        linked=next((c for c in catalog if c.get('video')==item['path']),None)
        videos.append({'id':hashlib.sha256(v['src'].encode()).hexdigest()[:16],'src':item['path'],'poster':poster['path'] if poster else (linked['image'] if linked else catalog[0]['image']),'title':linked['name'] if linked else f'Character preview {i+1:02d}','bytes':item['bytes']})
extra_videos=source/'extra-videos-manifest.json'
if extra_videos.exists():
    for v in json.loads(extra_videos.read_text(encoding='utf8')).get('items',[]):
        if v.get('status')!='included' or any(x['src']==v['local'] for x in videos): continue
        linked=next((c for c in catalog if c.get('route')==v.get('profileRoute')),None)
        videos.append({'id':hashlib.sha256(v['source'].encode()).hexdigest()[:16],'src':v['local'],'poster':v.get('posterLocal') or (linked['image'] if linked else catalog[0]['image']),'title':linked['name'] if linked else 'Public character preview','bytes':v['bytes']})
assets=[]
for url,a in manifest.items():
    assets.append({'path':a['path'],'bytes':a['bytes'],'type':a['type']})
data={'characters':catalog,'slides':slides,'videos':videos,'assets':assets,'captured':'2026-11-24'}
(public/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8')
(public/'data.js').write_text('window.CANDY_DATA = '+json.dumps(data,ensure_ascii=False)+';',encoding='utf8')
shutil.copytree(source/'dist/assets',public/'assets',dirs_exist_ok=True)
# Poppins comes from the original localized Google Fonts stylesheet.
fontcss=next((a['path'] for u,a in manifest.items() if 'fonts.googleapis.com' in u),None)
if fontcss:(public/'font-path.txt').write_text(fontcss)
print(json.dumps({'characters':len(catalog),'videos':len(videos),'assets':len(assets),'font':fontcss}))
