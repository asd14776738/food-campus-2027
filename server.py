"""Local-only food campus jobs, standard library only."""
import argparse, hashlib, html, json, re, threading, time, urllib.request
from datetime import datetime
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
URL = 'https://raw.githubusercontent.com/xinyangli-326/2027qiuzhao/main/data.json'
REPO = 'https://github.com/xinyangli-326/2027qiuzhao'
LOCK = threading.Lock()
GROUPS = json.loads((ROOT/'taxonomy.json').read_text(encoding='utf-8'))

def classify(row):
    for label, pattern in GROUPS:
        if re.search(pattern, row['company'], re.I): return label
    if row.get('cat') == '餐饮茶饮': return '餐饮茶饮'
    if re.search(r'农牧', row.get('cat', '')): return '农牧与肉品'
    if re.search(r'食品', row.get('cat', '')): return '食品综合'
    if re.search(r'食品|乳制品|烘焙|肉制品|调味品|饮料|生鲜|饲料', row.get('note','')) and row.get('cat') in ['快消','零售','农业']: return '食品综合'
    return None

def read(name, default):
    try: return json.loads((ROOT/name).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError): return default

def write(name, value):
    target=ROOT/name
    temporary=target.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2),encoding='utf-8')
    temporary.replace(target)

def build(raw):
    if not isinstance(raw,dict) or not isinstance(raw.get('data'),list) or not raw['data']: raise ValueError('源数据格式异常，保留上次数据')
    catalog=read_catalog()
    aliases={name:item for item in catalog['companies'] for name in [item['company'],*item.get('aliases',[])]}
    rows={}
    for item in raw['data']:
        if not isinstance(item,dict) or not isinstance(item.get('company'),str): raise ValueError('源数据企业字段异常')
        curated=aliases.get(item['company'].strip())
        group=curated['industry'] if curated else classify(item)
        if not group: continue
        row={key:html.unescape(str(item.get(key,'') or '')) for key in ['company','cat','date','roles','note','portal','source']}
        if curated: row['company']=curated['company']
        row.update(industry=group,industries=curated.get('industries',[group]) if curated else [group],kind='upstream',sourceType='原项目收录')
        row['id']=hashlib.sha256(row['company'].strip().encode()).hexdigest()[:16]
        rows[row['id']]=row
    if not rows: raise ValueError('筛选结果为空，保留上次数据')
    for item in catalog['companies']:
        identifier=hashlib.sha256(item['company'].strip().encode()).hexdigest()[:16]
        existing=rows.get(identifier)
        if existing and (item['kind']=='portal' or (existing['date'] and existing['date']>item['checkedAt'])):
            existing.update(catalogSource=item['source'],catalogNote=item['note'],catalogCheckedAt=item['checkedAt'])
            continue
        rows[identifier]={**{key:'' for key in ['cat','date','roles','note','portal','source']},**item,'id':identifier}
    return {'source':REPO,'rev':raw.get('rev',''),'sourceUpdated':raw.get('updated',''),'syncedAt':datetime.now().astimezone().isoformat(timespec='seconds'),'catalogUpdated':catalog['updated'],'websites':catalog['websites'],'rows':sorted(rows.values(),key=lambda x:x['date'],reverse=True)}

def read_catalog():
    path=ROOT/'catalog.json'
    catalog=json.loads(path.read_text(encoding='utf-8'))
    names=set()
    valid_industries={label for label,_ in GROUPS}
    for item in catalog['companies']:
        if not item.get('company') or item.get('kind') not in ['portal','announcement','internship'] or not item.get('source') or not item.get('portal'): raise ValueError('补充目录企业格式异常')
        for name in [item['company'],*item.get('aliases',[])]:
            if name in names: raise ValueError('补充目录企业别名重复：'+name)
            names.add(name)
        if item['industry'] not in valid_industries or any(i not in valid_industries for i in item.get('industries',[])): raise ValueError('补充目录行业分类无效')
    return catalog

def update(seed=False):
    with LOCK:
        checked=datetime.now().astimezone().isoformat(timespec='seconds')
        try:
            if seed: raw=read('upstream.json',{})
            else:
                request=urllib.request.Request(URL,headers={'User-Agent':'FoodCampus2027/1.0'})
                with urllib.request.urlopen(request,timeout=40) as response:
                    payload=response.read(8_000_001)
                    if len(payload)>8_000_000: raise ValueError('源数据过大')
                    raw=json.loads(payload)
            data=build(raw)
            write('data.json',data)
            if not seed: write('upstream.json',raw)
            result={'ok':True,'checkedAt':checked,'count':len(data['rows']),'rev':data['rev']}
        except Exception as error: result={'ok':False,'checkedAt':checked,'error':str(error)}
        write('sync-status.json',result)
        return result

def daily():
    while True:
        status=read('sync-status.json',{})
        today=datetime.now().strftime('%Y-%m-%d')
        # On startup catch up once; after a failed attempt retry next hour.
        now=datetime.now().astimezone()
        last=status.get('checkedAt','')
        due=not last.startswith(today)
        if not status.get('ok') and last:
            try: due=due or (now-datetime.fromisoformat(last)).total_seconds()>3600
            except ValueError: due=True
        if due: update()
        time.sleep(60)

class Handler(BaseHTTPRequestHandler):
    def send(self,status,payload,mime='application/json; charset=utf-8'):
        body=json.dumps(payload,ensure_ascii=False).encode() if not isinstance(payload,bytes) else payload
        self.send_response(status)
        self.send_header('Content-Type',mime)
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path=self.path.split('?')[0]
        if path=='/api/data': return self.send(200,{'data':read('data.json',{}),'sync':read('sync-status.json',{})})
        if path=='/api/health': return self.send(200,{'app':'food-campus-2027'})
        assets={'/':('index.html','text/html'),'/app.js':('app.js','text/javascript'),'/style.css':('style.css','text/css')}
        if path not in assets: return self.send(404,{'error':'Not found'})
        filename,mime=assets[path]
        self.send(200,(PUBLIC/filename).read_bytes(),mime+'; charset=utf-8')
    def do_POST(self):
        if self.path!='/api/update': return self.send(404,{'error':'Not found'})
        if self.headers.get('Origin')!='http://127.0.0.1:2027' or self.headers.get('X-Food-Campus')!='1': return self.send(403,{'error':'Only local website requests allowed'})
        if LOCK.locked(): return self.send(409,{'error':'正在同步，请稍后重试'})
        result=update(); self.send(200 if result['ok'] else 502,result)

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--update',action='store_true'); parser.add_argument('--seed',action='store_true'); args=parser.parse_args()
    if args.update or args.seed:
        result=update(args.seed); print(json.dumps(result,ensure_ascii=False)); raise SystemExit(0 if result['ok'] else 1)
    server=ThreadingHTTPServer(('127.0.0.1',2027),Handler)
    threading.Thread(target=daily,daemon=True).start()
    print('Food Campus: http://127.0.0.1:2027',flush=True)
    server.serve_forever()
