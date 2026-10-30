import { validateSpec, type AnalysisSpec, type Column, type Dataset } from './schema';

const metricNames=['revenue','sales','total_sales','total_bill','amount','profit','quantity','value','tip','cost'];
const dimensionNames=['region','category','channel','department','country','day','time','product','status'];
const identifier=(column:Column)=>/(^|[ _])(id|code|zip|postal)([ _]|$)|^(year|month)$/i.test(column.name);
const rank=(name:string,names:string[])=>{const index=names.indexOf(name.toLowerCase().replaceAll(' ','_'));return index<0?names.length:index;};
export function createStarterSpec(dataset:Dataset):AnalysisSpec|null {
 const columns=dataset.columns.filter(c=>c.missing<dataset.rows);
 if(dataset.rows<1||columns.length<2)return null;
 const numeric=columns.filter(c=>c.type==='number'&&!identifier(c)).sort((a,b)=>rank(a.name,metricNames)-rank(b.name,metricNames));
 const categories=columns.filter(c=>c.type==='string'&&!identifier(c)).sort((a,b)=>rank(a.name,dimensionNames)-rank(b.name,dimensionNames));
 const metric=numeric[0];
 const dimension=categories[0]??columns.find(c=>c.type==='date')??columns.find(c=>c.name!==metric?.name);
 if(!dimension)return null;
 const field=metric??columns.filter(c=>c.name!==dimension.name).sort((a,b)=>a.missing-b.missing)[0];
 if(!field||field.name===dimension.name)return null;
 const aggregation=metric?(dimension.type==='number'?'average':'sum'):'count';
 const date=dimension.type==='date';
 return validateSpec({chartType:date?'line':'bar',title:`${field.name} by ${dimension.name}`.slice(0,160),dimension:dimension.name,metrics:[{field:field.name,aggregation}],filters:[],...(date?{dateGrouping:'month',sort:{field:dimension.name,direction:'asc'}}:{limit:12,sort:{field:field.name,direction:'desc'}}),explanation:`Automatic overview calculated locally from your CSV. ${date?'Grouped by month.':'Shows up to 12 groups, highest first.'} Ask a question to refine this view.`},dataset.columns);
}
