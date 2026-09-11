"""Export a portable static site for GitHub Pages."""
import argparse,json,shutil
from pathlib import Path
import server

def build_site(refresh=False):
    if refresh:
        result=server.update()
        if not result['ok']:raise RuntimeError(result['error'])
    snapshot=server.read('data.json',{})
    if not snapshot.get('rows'):raise RuntimeError('No valid data snapshot')
    target=server.ROOT/'dist';target.mkdir(exist_ok=True)
    for name in ['app.js','style.css','cloud-adapter.js']:
        shutil.copyfile(server.PUBLIC/name,target/name)
    page=(server.PUBLIC/'index.html').read_text(encoding='utf-8')
    page=page.replace('href="/"','href="./"').replace('href="/style.css"','href="./style.css"')
    page=page.replace('<script src="/app.js" defer></script>','<script src="./cloud-config.js" defer></script><script src="./cloud-adapter.js" defer></script><script src="./app.js" defer></script>')
    page=page.replace('每日同步','每分钟检查')
    (target/'index.html').write_text(page,encoding='utf-8')
    (target/'cloud-config.js').write_text('window.FOOD_CLOUD='+json.dumps({'url':server.URL,'source':server.REPO,'groups':server.GROUPS},ensure_ascii=False)+';',encoding='utf-8')
    (target/'data.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
    (target/'.nojekyll').touch()
    print(json.dumps({'count':len(snapshot['rows']),'revision':snapshot['rev'],'output':'dist'},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--refresh',action='store_true');args=p.parse_args();build_site(args.refresh)
