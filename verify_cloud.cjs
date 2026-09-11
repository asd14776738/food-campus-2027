const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.SITE_URL||'http://127.0.0.1:2028/dist/';
 const pattern='https://raw.githubusercontent.com/xinyangli-326/2027qiuzhao/main/data.json*';
 const snapshot=JSON.parse(fs.readFileSync(path.join(__dirname,'dist/data.json'),'utf8'));
 // Initial network failure must render hosted fallback.
 await page.route(pattern,route=>route.abort());
 await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length>0);
 assert.equal(await page.locator('#rows tr').count(),snapshot.rows.filter(r=>r.kind!=='portal').length);
 assert((await page.locator('#sync').textContent()).includes('实时检查失败'));
 await page.locator('#search').fill('达能');await page.locator('select[data-action="status"]').selectOption('已投递');await page.locator('#search').fill('');
 // Recover with exactly the source snapshot to prove Python/JS classification and IDs agree.
 await page.unroute(pattern);await page.route(pattern,route=>route.fulfill({contentType:'application/json',body:fs.readFileSync(path.join(__dirname,'upstream.json'),'utf8')}));
 await page.locator('#update').click();await page.waitForFunction(()=>!document.querySelector('#update').disabled);
 assert(!(await page.locator('#sync').textContent()).includes('同步失败'));
 await page.locator('[data-view="companies"]').click();
 const ids=await page.locator('#rows tr').evaluateAll(rows=>rows.map(r=>r.dataset.id).sort());assert.deepEqual(ids,snapshot.rows.map(r=>r.id).sort());
 const clientRows=await page.evaluate(()=>data.rows.map(r=>({id:r.id,industries:r.industries,kind:r.kind,roles:r.roles})).sort((a,b)=>a.id.localeCompare(b.id)));
 assert.deepEqual(clientRows,snapshot.rows.map(r=>({id:r.id,industries:r.industries,kind:r.kind,roles:r.roles})).sort((a,b)=>a.id.localeCompare(b.id)));
 await page.locator('#search').fill('百事');assert.equal(await page.locator('#rows tr').count(),1);assert((await page.locator('#rows tr td').first().textContent()).includes('非乳饮料'));
 await page.locator('#industries button[data-category="乳制品"]').click();assert.equal(await page.locator('#rows tr').count(),0);
 await page.locator('#industries button[data-category="非乳饮料"]').click();assert.equal(await page.locator('#rows tr').count(),1);
 await page.locator('#rows .company').click();assert(!(await page.locator('#dialog-body').textContent()).includes('2027届校招收录'));assert((await page.locator('#dialog-body').textContent()).includes('尚未确认'));await page.locator('#close').click();
 await page.locator('#industries button[data-category="全部"]').click();
 await page.locator('#search').fill('达能');assert.equal(await page.locator('select[data-action="status"]').inputValue(),'已投递');await page.locator('#search').fill('');
 // A broken supplement feed must not silently delete the curated companies.
 await page.route('**/catalog.json*',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.locator('#update').click();await page.waitForFunction(()=>!document.querySelector('#update').disabled);
 assert.equal(await page.locator('#rows tr').count(),snapshot.rows.length);assert((await page.locator('#sync').textContent()).includes('同步失败'));await page.unroute('**/catalog.json*');
 // Confirm actual GitHub raw fetch and CORS in the browser.
 await page.unroute(pattern);await page.locator('#update').click();await page.waitForFunction(()=>!document.querySelector('#update').disabled,{},{timeout:30000});
 assert(!(await page.locator('#sync').textContent()).includes('同步失败'),'Live GitHub fetch failed');
 await page.locator('#about').click();assert((await page.locator('#dialog-body').textContent()).includes('每分钟'));await page.locator('#close').click();
 await page.locator('[data-view="websites"]').click();assert.equal(await page.locator('#website-list article').count(),snapshot.websites.length);
 await page.locator('#search').fill('食品伙伴');assert.equal(await page.locator('#website-list article').count(),1);
 await page.setViewportSize({width:390,height:844});await page.locator('#search').fill('');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile page overflow');
 await page.screenshot({path:path.join(__dirname,'output/playwright/expanded-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-view="companies"]').click();await page.locator('#industries button[data-category="非乳饮料"]').click();
 await page.screenshot({path:path.join(__dirname,'output/playwright/expanded-desktop.png'),fullPage:true});
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length>0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,url,companies:snapshot.rows.length,websites:snapshot.websites.length,checks:['offline snapshot','sync recovery','Python/JS classifications and IDs','Pepsi excluded from dairy','multi-business filters','portal status disclaimer','catalog failure preservation','progress preserved','live GitHub CORS','website navigation search','mobile overflow','no JS errors']}));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
