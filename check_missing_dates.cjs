const XLSX = require('xlsx');
const path = require('path');

const projectDir = 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램';
const wb = XLSX.readFile(path.join(projectDir, '창고데이터_수정.xlsx'));

const parseDateValue = (raw) => {
  if (raw === undefined || raw === null || raw === '') return '';
  const num = Number(raw);
  if (!isNaN(num) && num > 20000 && num < 60000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(raw).trim().split(' ')[0];
  return str;
};

// 피킹오더 날짜들
const pickingJson = XLSX.utils.sheet_to_json(wb.Sheets['피킹오더'] || wb.Sheets[wb.SheetNames[3]]);
const pickingDates = new Set();
pickingJson.forEach(p => {
  const d = parseDateValue(p.ReceiveTime);
  if (d) pickingDates.add(d);
});
console.log('피킹오더 날짜에 7/21 존재 여부:', pickingDates.has('2026-07-21'));
console.log('피킹오더 날짜 목록 (7월):', Array.from(pickingDates).filter(d => d.startsWith('2026-07')).sort());

// 미션로그 날짜들
const missionJson = XLSX.utils.sheet_to_json(wb.Sheets['미션로그'] || wb.Sheets[wb.SheetNames[1]]);
const missionDates = new Set();
missionJson.forEach(m => {
  const d = parseDateValue(m.StartTime || m.CreateTime);
  if (d) missionDates.add(d);
});
console.log('\n미션로그 날짜에 7/21 존재 여부:', missionDates.has('2026-07-21'));
console.log('미션로그 날짜 목록 (7월):', Array.from(missionDates).filter(d => d.startsWith('2026-07')).sort());
