const XLSX = require('xlsx');
const path = require('path');

const projectDir = 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램';
const dataPath = path.join(projectDir, '창고데이터_수정.xlsx');
const publicDataPath = path.join(projectDir, 'public', '창고데이터_수정.xlsx');

console.log('--- Root 창고데이터_수정.xlsx ---');
try {
  const wb = XLSX.readFile(dataPath);
  console.log('Sheet Names:', wb.SheetNames);
  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);
    console.log(`Sheet "${sheetName}" rows:`, json.length);
    if (sheetName === '피킹오더' || sheetName === wb.SheetNames[3]) {
      const dates = new Set();
      json.forEach(r => {
        if (r.ReceiveTime) dates.add(String(r.ReceiveTime).split(' ')[0]);
      });
      const sorted = Array.from(dates).sort();
      console.log('  -> 피킹오더 dates range:', sorted[0], '~', sorted[sorted.length - 1], `(total ${sorted.length} days)`);
      console.log('  -> All dates in 피킹오더:', sorted);
    }
    if (sheetName === '미션로그' || sheetName === wb.SheetNames[1]) {
      const dates = new Set();
      json.forEach(r => {
        if (r.CreateTime) dates.add(String(r.CreateTime).split(' ')[0]);
        else if (r.MissionId) {
          const match = String(r.MissionId).match(/(\d{4})(\d{2})(\d{2})/);
          if (match) dates.add(`${match[1]}-${match[2]}-${match[3]}`);
        }
      });
      const sorted = Array.from(dates).sort();
      console.log('  -> 미션로그 dates range:', sorted[0], '~', sorted[sorted.length - 1], `(total ${sorted.length} days)`);
    }
    if (sheetName === '재고현황' || sheetName === wb.SheetNames[2]) {
      const dates = new Set();
      json.forEach(r => {
        const rawDate = r.Date || r.date || r.SnapshotDate;
        if (rawDate) dates.add(String(rawDate));
      });
      console.log('  -> 재고현황 sample dates:', Array.from(dates).slice(0, 10));
    }
  });
} catch (e) {
  console.error('Error reading root file:', e.message);
}

console.log('\n--- Public 창고데이터_수정.xlsx ---');
try {
  const wb = XLSX.readFile(publicDataPath);
  console.log('Sheet Names:', wb.SheetNames);
  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);
    console.log(`Sheet "${sheetName}" rows:`, json.length);
    if (sheetName === '피킹오더' || sheetName === wb.SheetNames[3]) {
      const dates = new Set();
      json.forEach(r => {
        if (r.ReceiveTime) dates.add(String(r.ReceiveTime).split(' ')[0]);
      });
      const sorted = Array.from(dates).sort();
      console.log('  -> 피킹오더 dates range:', sorted[0], '~', sorted[sorted.length - 1], `(total ${sorted.length} days)`);
      console.log('  -> All dates in public 피킹오더:', sorted);
    }
  });
} catch (e) {
  console.error('Error reading public file:', e.message);
}
