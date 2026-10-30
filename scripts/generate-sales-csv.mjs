import { mkdirSync, writeFileSync } from 'node:fs';
const header = 'order_id,order_date,region,country,product,category,quantity,unit_price,revenue,cost,profit,channel,customer_segment';
export function generate(count) {
  let seed = 78539;
  const rand = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * n); };
  const regions = [['North','Canada'],['South','Brazil'],['East','Japan'],['West','United States']];
  const products = [['Cloud Suite','Software',149],['Analytics Pro','Software',249],['Studio Monitor','Electronics',320],['Wireless Keyboard','Electronics',79],['Desk Lamp','Office',45],['Standing Desk','Office',450],['Notebook Set','Office',18],['Webcam Plus','Electronics',95]];
  const rows = [header];
  for (let i=0;i<count;i++) {
    const [region,country] = regions[rand(4)];
    const [product,category,price] = products[rand(8)];
    const quantity = 1+rand(12), revenue = quantity*price, cost = Math.round(revenue*(50+rand(30)))/100;
    const date = new Date(Date.UTC(2024,0,1)+rand(1096)*86400000).toISOString().slice(0,10);
    rows.push([`ORD-${String(i+1).padStart(6,'0')}`,date,region,country,product,category,quantity,price,revenue.toFixed(2),cost.toFixed(2),(revenue-cost).toFixed(2),['Online','Retail','Partner'][rand(3)],['Consumer','Business','Enterprise'][rand(3)]].join(','));
  }
  return rows.join('\n')+'\n';
}
mkdirSync('public/sample-data',{recursive:true});
writeFileSync('public/sample-data/sales-demo.csv',generate(1200));
writeFileSync('public/sample-data/sales-100k.csv',generate(100000));
console.log('Generated 1,200-row and 100,000-row sales CSVs (seed 78539).');
