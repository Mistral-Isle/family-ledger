const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('tmp/ui-build');
const server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.wasm':'application/wasm','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(4195,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const b=name=>page.getByRole('button',{name,exact:true});
  const tab=name=>page.getByRole('tab',{name,exact:true});
  await page.goto('http://127.0.0.1:4195');await b('记一笔').waitFor();
  await b('记一笔').click();await b('日常').click();await b('三餐').click();await b('关闭二级分类').waitFor({state:'hidden'});
  await page.getByLabel('金额',{exact:true}).fill('38.50');
  await page.getByLabel('备注',{exact:true}).fill('一起吃早餐');
  await b('日期与时间').click();await b('调整时间').click();
  await page.getByLabel('选择时间',{exact:true}).fill('08:30');
  await b('调整时间').click();await page.waitForTimeout(450);await page.screenshot({path:'docs/acceptance/redesign-date-time.png'});
  await b('确定').click();await b('取消日期时间选择').waitFor({state:'hidden'});
  await b('日期与时间').click();await b('调整时间').click();
  await page.getByLabel('选择时间',{exact:true}).fill('09:45');await b('取消').click();
  await b('取消日期时间选择').waitFor({state:'hidden'});
  if(!(await b('日期与时间').innerText()).includes('08:30'))throw Error('cancel changed time');
  await page.waitForTimeout(450);await page.screenshot({path:'docs/acceptance/redesign-entry.png'});
  await b('完成记账').click();await b('记一笔').waitFor();
  if(await b('多选').count())throw Error('multi-select remains');

  await page.waitForTimeout(450);await page.screenshot({path:'docs/acceptance/style-classic.png'});
  await tab('我的').click();await b('暖白').click();await tab('明细').click();
  await page.waitForTimeout(450);await page.screenshot({path:'docs/acceptance/style-warm.png'});
  await tab('我的').click();await b('深色').first().click();await tab('明细').click();
  await page.waitForTimeout(450);await page.screenshot({path:'docs/acceptance/style-ink.png'});
  await tab('我的').click();await b('系统白').click();await tab('统计').click();
  await b('编辑预算').click();await page.getByLabel('总预算',{exact:true}).fill('1000');
  await page.getByLabel('日常预算',{exact:true}).fill('600');await b('展开日常预算').click();
  await page.getByLabel('日常 / 三餐预算',{exact:true}).fill('700');
  if(await b('保存预算').isEnabled())throw Error('invalid child budget accepted');
  await page.getByLabel('日常 / 三餐预算',{exact:true}).fill('400');await b('保存预算').click();
  await tab('二级分类').click();await page.getByText('日常 · 三餐',{exact:true}).waitFor();
  await tab('一级分类').click();await b('展开日常').click();
  await page.waitForTimeout(450);await page.screenshot({path:'docs/acceptance/redesign-stats.png',fullPage:true});
  await tab('明细').click();await b('记一笔').click();await b('日期与时间').click();await page.getByRole('switch',{name:'记录时间'}).click();await b('确定').click();await b('取消日期时间选择').waitFor({state:'hidden'});
  if((await b('日期与时间').innerText()).includes(':'))throw Error('time not cleared');
  await page.setViewportSize({width:375,height:667});
  await page.waitForTimeout(450);await page.screenshot({path:'docs/acceptance/redesign-small.png'});
  for(const name of ['金额','备注']){const box=await page.getByLabel(name,{exact:true}).boundingBox();if(!box||box.y+box.height>667)throw Error(name+' outside viewport');}
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('horizontal overflow');
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: entry, optional time, 3 styles, budget hierarchy, chart drill-down, 375px layout');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
