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
GROUPS = [
 ('餐饮茶饮', r'麦当劳|塔斯汀|瑞幸|蜜雪|卡旺卡|巴奴|老乡鸡|百胜|肯德基|必胜客|海底捞|喜茶|奈雪|星巴克|茶百道|霸王茶姬'),
 ('乳业饮品', r'伊利|蒙牛|雀巢|达能|飞鹤|认养一头牛|农夫山泉|元气森林|加多宝|可口可乐|百事|八马茶|劲牌|金徽酒|百威|乳业|乳品|酒业|啤酒|饮料|饮品'),
 ('粮油调味', r'中粮|益海|金龙鱼|海天味业|安琪|梅花集团|嘉吉|邦吉|路易达孚|鲁花|李锦记|千禾|厨邦|粮油|调味|酵母'),
 ('食品零售', r'万辰|悦活里|佳农|盒马|叮咚买菜|朴朴|永辉|山姆'),
 ('食品制造', r'食品|温氏|海大集团|双汇|双胞胎|牧原|洽洽|卫龙|桃李|百草味|米旗|康师傅|玛氏|联合利华|良品铺子|三只松鼠|汤臣倍健|健合|旺旺|达利|盼盼|安井|三全|思念|亿滋|好丽友|统一企业|新希望|正大集团')]

def classify(row):
    for label, pattern in GROUPS:
        if re.search(pattern, row['company'], re.I): return label
    if row.get('cat') == '餐饮茶饮': return '餐饮茶饮'
    if re.search(r'食品|农牧', row.get('cat', '')): return '食品制造'
    if re.search(r'食品|乳制品|烘焙|肉制品|调味品|饮料|生鲜|饲料', row.get('note','')) and row.get('cat') in ['快消','零售','农业']: return '食品制造'
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
    rows={}
    for item in raw['data']:
        if not isinstance(item,dict) or not isinstance(item.get('company'),str): raise ValueError('源数据企业字段异常')
        group=classify(item)
        if not group: continue
        row={key:html.unescape(str(item.get(key,'') or '')) for key in ['company','cat','date','roles','note','portal','source']}
        row['industry']=group
        row['id']=hashlib.sha256(row['company'].strip().encode()).hexdigest()[:16]
        rows[row['id']]=row
    if not rows: raise ValueError('筛选结果为空，保留上次数据')
    return {'source':REPO,'rev':raw.get('rev',''),'sourceUpdated':raw.get('updated',''),'syncedAt':datetime.now().astimezone().isoformat(timespec='seconds'),'rows':sorted(rows.values(),key=lambda x:x['date'],reverse=True)}

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
