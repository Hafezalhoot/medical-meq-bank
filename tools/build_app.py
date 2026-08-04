#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import json,re,sys
from lecture_builder import build_lecture_extensions,build_offline_asset_map,load_course_packs
ROOT=Path(__file__).resolve().parent.parent

def replace_required(text,old,new,label):
    if old in text:return text.replace(old,new,1)
    if new in text:return text
    raise SystemExit(f'Could not apply {label}')
def replace_regex_required(text,pattern,replacement,label,flags=0):
    updated,count=re.subn(pattern,replacement,text,count=1,flags=flags)
    if count!=1:raise SystemExit(f'Could not apply {label}')
    return updated
def ensure_external_style(text,element_id,source):
    tag=f'<link id="{element_id}" rel="stylesheet" href="{source}">'
    inline=rf'<style id="{re.escape(element_id)}">.*?</style>'; external=rf'<link id="{re.escape(element_id)}"[^>]*>'
    if re.search(inline,text,re.S):return re.sub(inline,lambda _:tag,text,count=1,flags=re.S)
    if re.search(external,text):return re.sub(external,lambda _:tag,text,count=1)
    return text.replace('</head>',tag+'\n</head>',1)
def ensure_external_script(text,element_id,source):
    tag=f'<script id="{element_id}" src="{source}"></script>'; pattern=rf'<script id="{re.escape(element_id)}"[^>]*>.*?</script>'
    if re.search(pattern,text,re.S):return re.sub(pattern,lambda _:tag,text,count=1,flags=re.S)
    return text.replace('</body>',tag+'\n</body>',1)
def ensure_external_script_after(text,after_src,source):
    tag=f'<script src="{source}"></script>'
    if tag in text:return text
    marker=f'<script src="{after_src}"></script>'
    if marker not in text:raise SystemExit(f'Missing {after_src}')
    return text.replace(marker,marker+'\n'+tag,1)
def ensure_accessibility_attributes(text):
    text=text.replace('<div class="empty" id="empty"><h2>No content found</h2><div id="emptyMessage">','<div class="empty" id="empty"><h2>No content found</h2><div id="emptyMessage" aria-live="polite">',1)
    text=text.replace('<div id="appToast" class="toast">','<div id="appToast" class="toast" role="status" aria-live="polite">',1)
    return text
def safe_script(s):return re.sub(r'</script',r'<\\/script',s,flags=re.I)
def safe_style(s):return re.sub(r'</style',r'<\\/style',s,flags=re.I)
def create_offline(html,app_css,app_js,progress_js,batch_js,asset_map_js,pwa_js,styles,scripts):
    offline=replace_required(html,'<link rel="stylesheet" href="./app.css">',f'<style id="app-source-styles">\n{safe_style(app_css)}\n</style>','offline css')
    offline=replace_required(offline,'<script src="./app.js"></script>',f'<script id="offline-asset-map">\n{safe_script(asset_map_js)}\n</script>\n<script id="app-source-runtime">\n{safe_script(app_js)}\n</script>','offline app')
    offline=replace_required(offline,'<script src="./progress-resilience.js"></script>',f'<script id="progress-resilience-runtime">\n{safe_script(progress_js)}\n</script>','offline progress')
    offline=replace_required(offline,'<script src="./lecture-loader.js"></script>',f'<script id="lecture-extensions">\n{safe_script(batch_js)}\n</script>','offline courses')
    offline=replace_required(offline,'<script src="./pwa-client.js"></script>',f'<script id="pwa-client-runtime">\n{safe_script(pwa_js)}\n</script>','offline pwa')
    for element_id,source,content in styles:offline=replace_required(offline,f'<link id="{element_id}" rel="stylesheet" href="{source}">',f'<style id="{element_id}">\n{safe_style(content)}\n</style>',source)
    for element_id,source,content in scripts:offline=replace_required(offline,f'<script id="{element_id}" src="{source}"></script>',f'<script id="{element_id}">\n{safe_script(content)}\n</script>',source)
    return offline
def patch_service_worker(output,assets):
    p=output/'service-worker.js'; worker=p.read_text()
    replacement=json.dumps(['./'+asset for asset in assets],ensure_ascii=False,separators=(',',':'))
    worker=replace_required(worker,'/*__LECTURE_ASSETS__*/ []',replacement,'content-pack service-worker precache')
    p.write_text(worker)
def build(output):
    for name in ('index.html','app.css','app.js','progress-resilience.js','lecture-loader.js','pwa-client.js','service-worker.js'):
        if not (output/name).is_file():raise SystemExit(f'Missing {output/name}')
    version=json.loads((ROOT/'version.json').read_text())['version']
    packs=load_course_packs(ROOT)
    review_css=(ROOT/'review-filter.css').read_text(); review_js=(ROOT/'review-filter.js').read_text(); responsive=(ROOT/'responsive-sidebars.js').read_text(); mobile_css=(ROOT/'mobile-filters.css').read_text(); mobile_js=(ROOT/'mobile-filters.js').read_text(); search=(ROOT/'search-optimization.js').read_text(); print_css=(ROOT/'src/print-manager.css').read_text(); print_js=(ROOT/'src/print-manager.js').read_text(); top_css=(ROOT/'back-to-top.css').read_text(); top_js=(ROOT/'back-to-top.js').read_text()
    styles=(('review-filter-styles','./review-filter.css',review_css),('mobile-filter-styles','./mobile-filters.css',mobile_css),('print-manager-styles','./print-manager.css',print_css),('back-to-top-styles','./back-to-top.css',top_css))
    scripts=(('responsive-sidebar-extension','./responsive-sidebars.js',responsive),('review-filter-extension','./review-filter.js',review_js),('mobile-filter-extension','./mobile-filters.js',mobile_js),('search-optimization-extension','./search-optimization.js',search),('print-manager-extension','./print-manager.js',print_js),('back-to-top-extension','./back-to-top.js',top_js))
    html=(output/'index.html').read_text(); app_css=(output/'app.css').read_text(); app_js=(output/'app.js').read_text(); progress=(output/'progress-resilience.js').read_text(); pwa=(output/'pwa-client.js').read_text()
    pwa=replace_regex_required(pwa,r"const APP_VERSION = '[^']+';",f"const APP_VERSION = '{version}';",'PWA version')
    html=ensure_external_script_after(html,'./app.js','./progress-resilience.js'); html=ensure_external_script_after(html,'./progress-resilience.js','./lecture-loader.js'); html=ensure_accessibility_attributes(html)
    for element_id,source,_ in styles:html=ensure_external_style(html,element_id,source)
    for element_id,source,_ in scripts:html=ensure_external_script(html,element_id,source)
    (output/'index.html').write_text(html); (output/'pwa-client.js').write_text(pwa)
    patch_service_worker(output,packs['assets'])
    offline=output/'offline/Medical_MEQ_Review_Bank_Offline.html';offline.parent.mkdir(parents=True,exist_ok=True)
    offline.write_text(create_offline(html,app_css,app_js,progress,build_lecture_extensions(ROOT),build_offline_asset_map(ROOT),pwa,styles,scripts))
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: build_app.py <output>')
    build(Path(sys.argv[1]))
