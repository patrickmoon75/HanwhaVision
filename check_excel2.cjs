const XLSX = require('xlsx');
const path = require('path');

const projectDir = 'c:\\Users\\bosel\\Desktop\\한화비전 분석 프로그램';
const dataPath = path.join(projectDir, '창고데이터_수정.xlsx');

const excelDateToJSDate = (serial) => {
  const num = Number(serial);
  if (isNaN(num) || num <= 0) return String(serial || '');
  const date = new Date(Math.round((num - 25569) * 86400 * 1000));
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const wb = XLSX.readFile(dataPath);

// 1. 피킹오더
const pickingSheet = wb.Sheets['피킹오더'] || wb.Sheets[wb.SheetNames[3]];
const pickingJson = XLSX.utils.sheet_to_json(pickingSheet);
console.log('=== 피킹오더 분석 ===');
console.log('총 피킹오더 행 수:', pickingJson.length);
const pickingDatesRaw = new Set();
const pickingDatesParsed = new Set();

pickingJson.forEach((r, idx) => {
  const raw = r.ReceiveTime;
  if (!raw) return;
  pickingDatesRaw.add(raw);
  
  let dateStr = '';
  if (typeof raw === 'number') {
    dateStr = excelDateToJSDate(raw);
  } else {
    dateStr = String(raw).split(' ')[0];
    if (!isNaN(Number(dateStr))) {
      dateStr = excelDateToJSDate(Number(dateStr));
    }
  }
  if (dateStr) pickingDatesParsed.add(dateStr);
});

const sortedPicking = Array.from(pickingDatesParsed).sort();
console.log('피킹오더 파싱 후 날짜들:', sortedPicking);
console.log('피킹오더 날짜 범위:', sortedPicking[0], '~', sortedPicking[sortedPicking.length - 1]);

// 2. 미션로그
const missionSheet = wb.Sheets['미션로그'] || wb.Sheets[wb.SheetNames[1]];
const missionJson = XLSX.utils.sheet_to_json(missionSheet);
console.log('\n=== 미션로그 분석 ===');
console.log('총 미션로그 행 수:', missionJson.length);
const missionDatesParsed = new Set();
missionJson.forEach(r => {
  let dateStr = '';
  const raw = r.CreateTime;
  if (raw) {
    if (typeof raw === 'number') {
      dateStr = excelDateToJSDate(raw);
    } else {
      dateStr = String(raw).split(' ')[0];
      if (!isNaN(Number(dateStr))) {
        dateStr = excelDateToJSDate(Number(dateStr));
      }
    }
  } else if (r.MissionId) {
    const match = String(r.MissionId).match(/(\d{4})(\d{2})(\d{2})/);
    if (match) {
      dateStr = `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  if (dateStr) missionDatesParsed.add(dateStr);
});
const sortedMission = Array.from(missionDatesParsed).sort();
console.log('미션로그 파싱 후 날짜들:', sortedMission);
console.log('미션로그 날짜 범위:', sortedMission[0], '~', sortedMission[sortedMission.length - 1]);

// 3. 재고현황
const invSheet = wb.Sheets['재고현황'] || wb.Sheets[wb.SheetNames[2]];
const invJson = XLSX.utils.sheet_to_json(invSheet);
console.log('\n=== 재고현황 분석 ===');
console.log('총 재고현황 행 수:', invJson.length);
const invDatesParsed = new Set();
invJson.forEach(r => {
  const rawDate = r.Date || r.date || r.SnapshotDate;
  if (!rawDate) return;
  let dateStr = '';
  if (typeof rawDate === 'number') {
    dateStr = excelDateToJSDate(rawDate);
  } else {
    dateStr = String(rawDate).split(' ')[0];
    if (!isNaN(Number(dateStr))) {
      dateStr = excelDateToJSDate(Number(dateStr));
    }
  }
  if (dateStr) invDatesParsed.add(dateStr);
});
const sortedInv = Array.from(invDatesParsed).sort();
console.log('재고현황 파싱 후 날짜들:', sortedInv);
console.log('재고현황 날짜 범위:', sortedInv[0], '~', sortedInv[sortedInv.length - 1]);
