import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.INSIGHTFLOW_URL||'http://127.0.0.1:5174';
 await page.goto(base+'/analyze');
 await page.getByRole('button',{name:'Load sample data'}).click();
 await page.getByText('1,200 rows',{exact:false}).first().waitFor();
 async function ask(question){
  await page.getByLabel('Ask about your data').fill(question);
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/ai/analyze')&&r.request().method()==='POST',{timeout:195000});
  await page.getByRole('button',{name:'Send question'}).click();
  const response=await pending;const body=await response.json();
  assert.equal(response.status(),200,JSON.stringify(body));
  await page.getByRole('button',{name:'Send question'}).waitFor({timeout:30000});
  assert.match(body.text,/live AI/);console.log(question,JSON.stringify(body.spec));return body;
 }
 const first=await ask('Show total revenue by region');
 assert.equal(first.spec.dimension,'region');assert.equal(first.spec.metrics[0].field,'revenue');
 assert.equal(await page.locator('.chart-card').count(),1);
 await page.getByText('1,200 matching rows · 4 groups').waitFor();
 const line=await ask('Change the current chart to a line chart');
 assert.equal(line.update,true);assert.equal(line.spec.chartType,'line');assert.deepEqual(line.spec.metrics,first.spec.metrics);
 const filter=await ask('Show only 2025 data');
 assert.equal(filter.update,true);assert.equal(filter.spec.chartType,'line');assert.equal(filter.spec.dimension,'region');assert.ok(filter.spec.filters.some(f=>f.field==='order_date'));
 assert.equal(await page.locator('.chart-card').count(),1);
 const multi=await ask('Compare revenue and profit by month');
 assert.equal(multi.update,false);assert.equal(multi.spec.dateGrouping,'month');assert.deepEqual(multi.spec.metrics.map(m=>m.field).sort(),['profit','revenue']);
 assert.equal(await page.locator('.chart-card').count(),2);
 await page.getByText('1,200 matching rows · 36 groups').waitFor();
 assert.equal(await page.locator('.chart-error').count(),0);assert.deepEqual(errors,[]);
 console.log('Live browser smoke passed: sample CSV, real AI, chart rendering, follow-up identity, year filtering and multiple metrics.');
}finally{await browser.close();}
