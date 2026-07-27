const XLSX = require('xlsx');
const path = require('path');

const projectDir = 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램';
const wb = XLSX.readFile(path.join(projectDir, '창고데이터_수정.xlsx'));
const sheet = wb.Sheets['미션로그'] || wb.Sheets[wb.SheetNames[1]];
const json = XLSX.utils.sheet_to_json(sheet);

console.log('미션로그 1번 샘플 행:', json[0]);
console.log('미션로그 컬럼 리스트:', Object.keys(json[0] || {}));
