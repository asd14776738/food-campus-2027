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
 assert.equal(await page.locator('#rows tr').count(),snapshot.rows.length);
 assert((await page.locator('#sync').textContent()).includes('实时检查失败'));
 await page.locator('#search').fill('达能');await page.locator('select[data-action="status"]').selectOption('已投递');await page.locator('#search').fill('');
 // Recover with exactly the source snapshot to prove Python/JS classification and IDs agree.
 await page.unroute(pattern);await page.route(pattern,route=>route.fulfill({contentType:'application/json',body:fs.readFileSync(path.join(__dirname,'upstream.json'),'utf8')}));
 await page.locator('#update').click();await page.waitForFunction(()=>!document.querySelector('#update').disabled);
 assert(!(await page.locator('#sync').textContent()).includes('同步失败'));
 const ids=await page.locator('#rows tr').evaluateAll(rows=>rows.map(r=>r.dataset.id).sort());assert.deepEqual(ids,snapshot.rows.map(r=>r.id).sort());
 await page.locator('#search').fill('达能');assert.equal(await page.locator('select[data-action="status"]').inputValue(),'已投递');await page.locator('#search').fill('');
 // Confirm actual GitHub raw fetch and CORS in the browser.
 await page.unroute(pattern);await page.locator('#update').click();await page.waitForFunction(()=>!document.querySelector('#update').disabled,{},{timeout:30000});
 assert(!(await page.locator('#sync').textContent()).includes('同步失败'),'Live GitHub fetch failed');
 await page.locator('#about').click();assert((await page.locator('#dialog-body').textContent()).includes('每分钟'));await page.locator('#close').click();
 await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length>0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,url,count:await page.locator('#rows tr').count(),checks:['subpath assets','offline snapshot','sync recovery','Python/JS classification and IDs','progress preserved','live GitHub CORS','hosted update explanation','no JS errors']}));
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
