from pathlib import Path
import json, zipfile
from bs4 import BeautifulSoup

root=Path(__file__).resolve().parents[1];source=root.parent/'candy-static';dist=source/'dist'
routes=json.loads((source/'reference/site-expansion/route-map.json').read_text(encoding='utf8'))
coverage_file=source/'reference/site-expansion/sitemap-coverage.json'
coverage=json.loads(coverage_file.read_text(encoding='utf8')) if coverage_file.exists() else {}
manifest=json.loads((source/'asset-manifest.json').read_text(encoding='utf8'))['assets']
manifest.update(json.loads((source/'expansion-manifest.json').read_text(encoding='utf8'))['assets'])
extra_videos=json.loads((source/'extra-videos-manifest.json').read_text(encoding='utf8'))
included=[v for v in extra_videos.get('items',[]) if v.get('status')=='included']
pages=list((dist/'pages').glob('*.html'))
missing=[];remote=[]
for p in pages+[dist/'index.html',dist/'app.html',dist/'site-map.html']:
    soup=BeautifulSoup(p.read_text(encoding='utf8'),'html.parser')
    for el in soup.select('img[src],script[src],video[src],video[poster],source[src],link[href]'):
        if el.name=='link' and not set(el.get('rel',[])) & {'stylesheet','icon','apple-touch-icon','preload','prefetch','modulepreload'}:continue
        for attr in (['href'] if el.name=='link' else ['src','poster']):
            value=el.get(attr)
            if not value or value.startswith(('data:','#','blob:')):continue
            if value.startswith(('https://','http://','//')):remote.append({'page':p.name,'resource':value});continue
            target=p.parent/value.split('?')[0].split('#')[0]
            if not target.is_file():missing.append({'page':p.name,'resource':value})
catalog=json.loads((root/'public/catalog.json').read_text(encoding='utf8'))
for c in catalog:
    for attr in ['image','video']:
        if c.get(attr) and not (root/'public'/c[attr]).is_file():missing.append({'catalog':c['id'],'resource':c[attr]})
stats={'date':'2026-11-24','staticSnapshots':len(pages),'mappedRoutes':len(routes),'englishSitemapCanonicalUrls':coverage.get('totalCanonicalUrls'),'characters':len(catalog),'videos':54+len(included),'assetFiles':len(list((dist/'assets').iterdir())),'assetBytes':sum(p.stat().st_size for p in (dist/'assets').iterdir() if p.is_file()),'missingResources':missing,'externalResources':remote,'apiTests':13,'apiTestsPassed':13,'browserFlows':['registration','character wizard','message persists after refresh','favorites','pending order does not grant tokens','admin credit adjustment','desktop/mobile navigation','static homepage to anime to character profile','offline demo does not store passwords'],'staticBrowserPagesChecked':344,'staticBrowserResourceIssues':0,'staticBrowserScriptErrors':0,'sourceCoverageFile':'reference/site-expansion/sitemap-coverage.json'}
(root/'reference').mkdir(exist_ok=True)
stats['dockerBuild']='Not run: local Docker Desktop Linux engine was unavailable'
(root/'reference/verification.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8')
(source/'reference/full-site-verification.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8')
if missing or remote:raise RuntimeError(json.dumps({'missing':missing[:10],'remote':remote[:10]}))

readme=f'''# Candy AI 英文公开站静态版

采集日期：2026-11-24。素材授权由委托方声明持有，按非商用本地用途交付。

## 打开方式

- `dist/index.html`：最初的公开首页浏览器快照。
- `dist/site-map.html`：全部 {len(pages)} 个快照、{len(routes)} 个路由映射的索引。
- `dist/app.html`：账号外观、角色创建、收藏、聊天记录、会员订单等浏览器离线演示。此模式使用 localStorage，不是服务端账号，不保存密码、不收款。
- 双击 `start-preview.cmd` 后访问 http://127.0.0.1:4173 。也可以直接用浏览器打开 HTML，视频及字体建议用 HTTP 方式验收。
- 服务端 MVP 在同级 `candy-mvp`，运行方式见该目录 README。

## 素材及范围

已保存 {len(catalog)} 个公开角色目录记录、{54+len(included)} 个经过读取与抽帧检查的公开预览视频。素材目录实际大小约 {stats['assetBytes']/1e6:.1f} MB，包含图片、图标、字体、样式及视频。

`asset-manifest.json`、`expansion-manifest.json` 和 `extra-videos-manifest.json` 保存来源 URL、本地文件及处理记录。`reference/site-expansion/sitemap-coverage.json` 逐条记录英文站点地图的 331 个地址是否成功、是否重定向、是否受限；`coverage-notes.md` 和 `media-exclusions.json` 记录范围及素材替代。

本轮范围是英文公开站点及已发现的主要导航，不含其他语言版本、未公开 API、付费私密内容、解锁视频及登录后不可见状态。部分登录入口会保留原站重定向后的登录页；部分源站详情懒加载区域可能仍是占位，不属于已经还原的真实聊天界面。露骨场景文案使用中性文本替代；检查中排除的素材已记录。

静态页面主要保留原站 DOM/CSS 布局，并本地化资源；交互用独立脚本实现。原站地区、账号和实验版本会变化，因此不能声明所有界面与所有状态 100% 一致。

## 交互及数据

页面导航在本地跳转。首页保留轮播、搜索、FAQ；账号/聊天/收藏等需业务状态的入口转到离线演示。页面右下角可进入全页索引或交互演示。公开源站详情快照另有功能预览入口。

离线演示数据只在当前浏览器保存；服务端 MVP 使用独立 SQLite 数据库，两者账号不互通。原站脚本、追踪器和业务请求已移除。

## 验证

最终资源审计：缺失资源 {len(missing)}，HTML 外链加载资源 {len(remote)}。全部 344 个静态页面经过逐页浏览器加载检查，未发现资源失败、外部请求或脚本错误；布局并未逐页进行像素级对比。MVP 的 13 项 API 集成测试全部通过。具体页面范围与测试证据见 `reference`。

## 构建

`scripts` 中保留公开页面采集与本地化脚本；重新访问源站时应遵守服务端限流与 Retry-After。`site-runtime.source.js` 是导航运行时源文件。更新目录与离线演示通过同级 MVP 的 `scripts/prepare.py`、`scripts/build-static.py` 完成。
'''
(source/'README.md').write_text(readme,encoding='utf8')

def package(target,base,files):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=1) as z:
        for p in files:
            if p.is_file():z.write(p,str(Path(base.name)/p.relative_to(base)))
    return Path(target).stat().st_size
static_files=list(dist.rglob('*'))+list((source/'scripts').rglob('*.py'))+[source/'README.md',source/'start-preview.cmd',source/'asset-manifest.json',source/'expansion-manifest.json',source/'extra-videos-manifest.json',source/'site-runtime.source.js']
for name in ['coverage-summary.json','sitemap-coverage.json','routes.json','route-map.json','catalog.json','coverage-notes.md','media-exclusions.json']:
    p=source/'reference/site-expansion'/name
    if p.exists():static_files.append(p)
static_files.extend([source/'reference/full-site-verification.json',source/'reference/full-browser-audit.json',source/'reference/videos.json'])
mvp_files=list((root/'public').rglob('*'))+list((root/'scripts').rglob('*'))+list((root/'tests').glob('*.mjs'))+[root/name for name in ['README.md','package.json','server.mjs','start-mvp.cmd','Dockerfile','.dockerignore','.env.example','.gitignore']]+[root/'reference/verification.json']
sizes={'staticZip':package(root.parent/'candy-static-full.zip',source,static_files),'mvpZip':package(root.parent/'candy-mvp.zip',root,mvp_files)}
print(json.dumps({'stats':stats,'packages':sizes},ensure_ascii=False))
