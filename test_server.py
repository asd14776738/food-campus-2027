import copy, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import server

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=server.ROOT)
        self.root=Path(self.temp.name)
        self.root_patch=patch.object(server,'ROOT',self.root);self.root_patch.start()
        self.sample={'rev':'test','updated':'2026-09-11','data':[{'company':'伊利','cat':'快消','date':'2026-08-12','roles':'研发、质量','portal':'https://example.com','note':'2027届校招'}]}
    def tearDown(self):
        self.root_patch.stop()
        self.assertTrue(self.root.resolve().is_relative_to(server.ROOT.resolve()))
        self.temp.cleanup()
    def test_classification_excludes_nonfood(self):
        for company in ['宝洁','蓝月亮','浙江富特科技股份有限公司','上海天岳半导体材料有限公司','高露洁']:
            self.assertIsNone(server.classify({'company':company,'cat':'快消','note':'研发及生产岗位'}))
        self.assertEqual(server.classify({'company':'海天味业'}),'粮油调味')
        self.assertEqual(server.classify({'company':'达能（中国）'}),'乳业饮品')
        self.assertEqual(server.classify({'company':'新企业','cat':'农牧/食品'}),'食品制造')
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
