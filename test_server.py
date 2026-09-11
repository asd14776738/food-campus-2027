import copy, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import server

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=server.ROOT)
        self.root=Path(self.temp.name)
        self.root_patch=patch.object(server,'ROOT',self.root);self.root_patch.start()
        server.write('catalog.json',{'updated':'','companies':[],'websites':[]})
        self.sample={'rev':'test','updated':'2026-09-11','data':[{'company':'伊利','cat':'快消','date':'2026-08-12','roles':'研发、质量','portal':'https://example.com','note':'2027届校招'}]}
    def tearDown(self):
        self.root_patch.stop()
        self.assertTrue(self.root.resolve().is_relative_to(server.ROOT.resolve()))
        self.temp.cleanup()
    def test_classification_excludes_nonfood(self):
        for company in ['宝洁','蓝月亮','浙江富特科技股份有限公司','上海天岳半导体材料有限公司','高露洁']:
            self.assertIsNone(server.classify({'company':company,'cat':'快消','note':'研发及生产岗位'}))
        self.assertEqual(server.classify({'company':'海天味业'}),'调味品')
        self.assertEqual(server.classify({'company':'达能（中国）'}),'乳制品')
        self.assertEqual(server.classify({'company':'新企业','cat':'农牧/食品'}),'农牧与肉品')
    def test_drinks_are_not_dairy(self):
        cases={'百事':'非乳饮料','百事食品':'休闲食品','可口可乐饮料':'非乳饮料','农夫山泉':'非乳饮料','加多宝':'非乳饮料','伊利':'乳制品','蒙牛':'乳制品','百威中国':'酒类','劲牌':'酒类','八马茶业':'茶叶','SGS通标':'检测认证','梅花集团':'原料配料'}
        for company,expected in cases.items():
            with self.subTest(company=company):self.assertEqual(server.classify({'company':company}),expected)
    def test_catalog_merge_and_aliases_preserve_announcements(self):
        portal={'company':'百事公司','aliases':['百事'],'industry':'非乳饮料','industries':['非乳饮料','休闲食品'],'kind':'portal','source':'https://example.com/pepsi','portal':'https://example.com/jobs','checkedAt':'2026-09-11','note':'入口待确认'}
        server.write('catalog.json',{'updated':'2026-09-11','companies':[portal],'websites':[]})
        data=server.build(self.sample);pepsi=next(r for r in data['rows'] if r['company']=='百事公司')
        self.assertEqual(pepsi['kind'],'portal');self.assertNotIn('乳制品',pepsi['industries'])
        changed=copy.deepcopy(self.sample);changed['data'].append({'company':'百事','date':'2026-09-12','roles':'食品研发','portal':'https://example.com/new'})
        updated=server.build(changed);rows=[r for r in updated['rows'] if r['company']=='百事公司'];self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['id'],pepsi['id']);self.assertEqual(rows[0]['kind'],'upstream');self.assertEqual(rows[0]['roles'],'食品研发')
        self.assertEqual(rows[0]['portal'],'https://example.com/new')
    def test_missing_catalog_retains_snapshot(self):
        server.write('upstream.json',self.sample);server.update(seed=True);before=(self.root/'data.json').read_bytes()
        (self.root/'catalog.json').unlink()
        self.assertFalse(server.update(seed=True)['ok']);self.assertEqual(before,(self.root/'data.json').read_bytes())
    def test_stable_id_and_deduplicate(self):
        before=server.build(self.sample);after=copy.deepcopy(self.sample);after['data'][0]['roles']='销售'
        self.assertEqual(before['rows'][0]['id'],server.build(after)['rows'][0]['id'])
        after['data']*=2;self.assertEqual(len(server.build(after)['rows']),1)
    def test_corrupt_payload_rejected(self):
        for bad in [{},{'data':[]},{'data':[{}]},{'data':[{'company':'蓝月亮','cat':'快消'}]}]:
            with self.assertRaises(ValueError):server.build(bad)
    def test_network_failure_retains_good_data(self):
        server.write('upstream.json',self.sample);self.assertTrue(server.update(seed=True)['ok']);before=(self.root/'data.json').read_bytes()
        with patch.object(server.urllib.request,'urlopen',side_effect=TimeoutError('simulated offline')):
            result=server.update()
        self.assertFalse(result['ok']);self.assertEqual(before,(self.root/'data.json').read_bytes())
        self.assertIn('simulated offline',server.read('sync-status.json',{})['error'])
    def test_invalid_seed_retains_good_data(self):
        server.write('upstream.json',self.sample);server.update(seed=True);before=(self.root/'data.json').read_bytes()
        server.write('upstream.json',{'data':[]});self.assertFalse(server.update(seed=True)['ok']);self.assertEqual(before,(self.root/'data.json').read_bytes())

if __name__=='__main__':unittest.main(verbosity=2)
