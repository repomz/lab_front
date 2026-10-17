import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/features/analyses/dynamics.ts',import.meta.url),'utf8');
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const {buildMarkerSeries,filterMarkerSeries}=exports;
const marker=(name,value,status,unit='ммоль/л')=>({name,value,status,unit});
const analysis=(id,date,markers,status='ready')=>({id,collected_at:date,created_at:date,markers,status});
const data=[
  analysis('new','2026-10-17',[marker('Глюкоза',5,'normal'),marker('Кальций',3,'high'),marker('Без референса',2,'unknown')]),
  analysis('old','2026-09-17',[marker('Глюкоза',8,'high'),marker('Кальций',2,'normal')]),
  analysis('other-unit','2026-10-16',[marker('Глюкоза',90,'normal','мг/дл')]),
  analysis('pending','2026-10-18',[marker('Кальций',2,'normal')],'processing'),
  analysis('qualitative','2026-10-17',[marker('Белок',undefined,'normal'),marker('Ошибка',NaN,'unknown')]),
];
const series=buildMarkerSeries(data);
assert.equal(series.size,4);
const specimens=buildMarkerSeries([{...data[0],category:'Кровь'},{...data[0],id:'urine',category:'Моча'}]);
assert.equal(filterMarkerSeries(specimens,'Глю','all').length,2,'Blood and urine must never share a chart');
assert.equal(filterMarkerSeries(series,' гЛЮ ','all').length,2);
assert.equal(filterMarkerSeries(series,'люк','all').length,0,'Search must match the name prefix');
assert.equal(filterMarkerSeries(series,'','normal').length,2);
const abnormal=filterMarkerSeries(series,'','abnormal');
assert.equal(abnormal.length,1);
assert.equal(abnormal[0].name,'Кальций');
assert.equal(abnormal[0].latest.value,3);
assert.equal(filterMarkerSeries(series,'Без','normal').length,0);
assert.equal(filterMarkerSeries(series,'Без','abnormal').length,0);
assert.equal(filterMarkerSeries(series,'Без','all').length,1);
assert.equal(filterMarkerSeries(buildMarkerSeries([]),'','all').length,0);
const tied=buildMarkerSeries([
  {...analysis('b','2026-10-01',[marker('Тест',1,'normal')]),created_at:'2026-10-03'},
  {...analysis('a','2026-10-01',[marker('Тест',2,'high')]),created_at:'2026-10-02'},
]);
assert.equal(filterMarkerSeries(tied,'','normal')[0].latest.value,1);
console.log('Dynamics: prefix search, latest status, unknown references, unit separation and ordering passed.');
