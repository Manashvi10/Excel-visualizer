import { describe,it,expect } from 'vitest';
import { createStarterSpec } from '../core/starter';
import { analyze,parseCSV } from '../core/engine';

describe('automatic dataset overview',()=>{
 it('selects real sales fields instead of summing identifiers and uses actual aggregates',()=>{
  const {dataset,rows}=parseCSV('order_id,region,revenue,profit\n1,North,100,20\n2,South,200,40\n3,North,50,10','sales.csv');
  const spec=createStarterSpec(dataset)!;
  expect(spec.dimension).toBe('region');expect(spec.metrics).toEqual([{field:'revenue',aggregation:'sum'}]);
  expect(spec.limit).toBe(12);expect(analyze(rows,spec,dataset.columns).rows).toEqual([{region:'South',revenue:200},{region:'North',revenue:150}]);
 });
 it('supports unrelated user schemas without inventing sales columns',()=>{
  const {dataset,rows}=parseCSV('department,salary\nEngineering,100\nSupport,50\nEngineering,200','payroll.csv');
  const spec=createStarterSpec(dataset)!;
  expect(spec.dimension).toBe('department');expect(spec.metrics[0].field).toBe('salary');
  expect(analyze(rows,spec,dataset.columns).rows[0]).toEqual({department:'Engineering',salary:300});
 });
 it('creates a chronological monthly trend when there is a date and numeric value',()=>{
  const {dataset,rows}=parseCSV('date,amount\n2025-02-01,10\n2025-01-01,20\n2025-01-20,30','payments.csv');
  const spec=createStarterSpec(dataset)!;
  expect(spec.chartType).toBe('line');expect(spec.dateGrouping).toBe('month');
  expect(analyze(rows,spec,dataset.columns).rows).toEqual([{date:'2025-01',amount:50},{date:'2025-02',amount:10}]);
 });
 it('uses a count for categorical datasets without inventing a numeric metric',()=>{
  const {dataset,rows}=parseCSV('order_id,status\nA,Open\nB,Closed\nC,Open','orders.csv');
  const spec=createStarterSpec(dataset)!;
  expect(spec.dimension).toBe('status');expect(spec.metrics).toEqual([{field:'order_id',aggregation:'count'}]);
  expect(analyze(rows,spec,dataset.columns).rows[0]).toEqual({status:'Open',order_id:2});
 });
 it('does not add a fabricated chart when usable distinct fields are unavailable',()=>{
  expect(createStarterSpec({name:'single.csv',rows:2,columns:[{name:'value',type:'number',missing:0}],preview:[]})).toBeNull();
  expect(createStarterSpec(parseCSV('category,amount\nA,\nB,','missing.csv').dataset)).toBeNull();
 });
 it('uses sensible fields from the real restaurant schema',()=>{
  const {dataset}=parseCSV('total_bill,tip,sex,smoker,day,time,size\n16.99,1.01,Female,No,Sun,Dinner,2\n10.34,1.66,Male,No,Sun,Dinner,3','tips.csv');
  const spec=createStarterSpec(dataset)!;
  expect(spec.dimension).toBe('day');expect(spec.metrics[0].field).toBe('total_bill');
 });
});
