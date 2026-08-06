import React from 'react';
import { FileText, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatWithDayOfWeek } from '../services/dataProcessor';

export default function DailyDefenseReportView({ selectedDate, dateInfo }) {
  if (!dateInfo) return null;

  const totalMissions = dateInfo.totalMissionCount || (dateInfo.dayMissions ? dateInfo.dayMissions.length : 0);
  const completedMissions = dateInfo.completedCount || 0;
  const softResetCount = dateInfo.softResetCount || 0;
  const abortedCount = dateInfo.abortedCount || 0;
  const canceledCount = dateInfo.canceledCount || 0;
  const deletedCount = dateInfo.deletedCount || 0;
  const completedRate = totalMissions > 0 ? ((completedMissions / totalMissions) * 100).toFixed(1) : '0.0';

  const availYardCell = dateInfo.availYard || 805;
  const occupiedYardCell = dateInfo.occupiedYardCount || 0;
  const emptyYardCell = Math.max(0, availYardCell - occupiedYardCell);
  const emptyYardRate = ((emptyYardCell / availYardCell) * 100).toFixed(1);

  const reportLines = [
    `[RWCS 운영 결과 분석 리포트 - ${formatWithDayOfWeek(selectedDate)}]`,
    ``,
    `${formatWithDayOfWeek(selectedDate)} 당일 야드 피킹율 ${dateInfo.yardPickingRate}%`,
    ``,
    `1. 야드플랜 미실행 (야드 빈셀 ${emptyYardCell.toLocaleString()} / ${availYardCell.toLocaleString()}셀 (${emptyYardRate}%)):`,
    `전날(${dateInfo.prevDate}) 지게차 완료 미션 부족으로 야드 빈 셀이 ${emptyYardCell.toLocaleString()} / ${availYardCell.toLocaleString()}셀 (${emptyYardRate}%) 발생하였습니다.`,
    `당일 야드플랜이 충분히 실행되지 못하여 전체 피킹율 감소의 가장 큰 원인이 되었습니다.`,
    ``,
    `2. 야드 만재율 (${dateInfo.yardOccupancyRate}%):`,
    `야드 만재율은 ${dateInfo.yardOccupancyRate}% (${occupiedYardCell.toLocaleString()}/${availYardCell.toLocaleString()} 셀) 입니다.`,
    ``,
    `3. 소프트리셋 실시 (총 미션 ${totalMissions}건, Soft Reset ${softResetCount}건, 수행율 ${completedRate}%):`,
    `야간 배치 작업 중 총 미션 ${totalMissions}건, Soft Reset ${softResetCount}건, Aborted ${abortedCount}건, Canceled ${canceledCount}건, Deleted ${deletedCount}건이 발생하였습니다.`,
    `전체미션 중에서 ${completedRate}% 정상 실행되었습니다.`,
    ``,
    `4. 현장 인프라 진입 차단 (Infrastructure Loss: ${dateInfo.infraLossRate}%):`,
    `당일 출고 요청된 전체 피킹 수량 ${(dateInfo.totalPickQty ?? 0).toLocaleString()}개 중 ${(dateInfo.blockedRackPickQty ?? 0).toLocaleString()}개(${dateInfo.infraLossRate}%)가 접근불가 차단 랙(Blocked)에서 지시된 물량이었습니다.`,
    ``,
    `5. 배치계획 적중율 분석 (품목 적중율: ${dateInfo.itemAccuracy ?? 0}%, 수량 적중율: ${dateInfo.qtyAccuracy ?? 0}%):`,
    `전일 배치계획과 당일 피킹오더를 비교한 결과,`,
    `A. 전체 배치계획을 기준으로 계산하면 품목 적중율 ${dateInfo.itemAccuracy ?? 0}% (배치계획 ${dateInfo.planItemCount ?? 0} / 피킹 ${dateInfo.pickItemCount ?? 0} SKU), 전체 수량 적중율 ${dateInfo.qtyAccuracy ?? 0}%로 분석되었습니다.`,
    `B. ${availYardCell}개 야드 셀만을 채우는 배치계획으로 계산하면 야드 품목 적중율 ${dateInfo.yardItemAccuracy ?? 0}%, 야드 수량 적중율 ${dateInfo.yardQtyAccuracy ?? 0}%로 분석됩니다.`
  ];

  const reportText = reportLines.join('\n');

  const handleExportPDF = async () => {
    const reportElem = document.getElementById('defense-report-container');
    if (!reportElem) return;
    try {
      const canvas = await html2canvas(reportElem, { scale: 2, backgroundColor: '#0b0f19' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`RWCS_AntiGravity_Defense_Report_${selectedDate}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF 내보내기 중 오류가 발생하였습니다.");
    }
  };

  return (
    <section className="glass-card" id="defense-report-container">
      <div className="section-header">
        <div className="section-title">
          <FileText color="var(--accent-cyan)" size={22} />
          <span>분석 리포트</span>
        </div>

        <button className="btn-primary" onClick={handleExportPDF}>
          <Download size={18} />
          PDF 보고서 내보내기
        </button>
      </div>

      <div className="report-content-box">
        {reportText}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>작성기관: Novatek RWCS Team | 대상 고객사: 한화비전</span>
        <img 
          src="/images/Novatek_logo.png" 
          alt="Novatek 로고" 
          style={{ 
            height: '34px', 
            objectFit: 'contain'
          }} 
        />
      </div>
    </section>
  );
}
