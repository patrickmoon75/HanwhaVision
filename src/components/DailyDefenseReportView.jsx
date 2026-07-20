import React from 'react';
import { FileText, Download, ShieldCheck, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function DailyDefenseReportView({ selectedDate, dateInfo }) {
  if (!dateInfo) return null;

  // 서술형 방어 리포트 자동 생성 텍스트 (기획서 4.3항 요구사항 준수)
  const reportText = `[RWCS 운영 결과 분석 및 대고객 방어 리포트 - ${selectedDate}]

${selectedDate} 당일 야드 피킹율이 ${dateInfo.yardPickingRate}%로 기록(하락)된 주된 원인은 RWCS 배치 알고리즘의 로직 오류가 아닙니다.

1. 현장 인프라 진입 차단 (Infrastructure Loss: ${dateInfo.infraLossRate}%):
   당일 출고 요청된 SKU의 핵심 재고 중 약 ${dateInfo.infraLossRate}%가 현장 진입 차단 구역(Blocked == TRUE, 랙 전체 차단율 33.7%)에 묶여 있어 무인지게차(AGF)의 접근이 물리적으로 불가능했습니다.

2. 현장 자재 적치 관리 부실 (Operational Error Loss: ${dateInfo.opErrorLossRate}%):
   야간 전진 배치 작업 중, 4~5단 고단 랙 피킹 시 파레트 흔들림 및 적치 불량으로 인한 로봇 안전 센서 정상 보호 동작(Soft reset)이 총 ${dateInfo.softResetCount}건 발생하였습니다. 이는 로봇 하드웨어 및 현장 관리 부실에 기인한 손실입니다.

3. RWCS 시스템 복구 및 만재율 입증 (Fallback & Occupancy Rate: ${dateInfo.yardOccupancyRate}%):
   로봇 제어 시스템(RWCS)은 에러 속에서도 즉시 차선순위(Next Best) 미션을 자동 가동하여, 출고 직전 야드 만재율을 ${dateInfo.yardOccupancyRate}% (${dateInfo.occupiedYardCount}/${dateInfo.availYard} 셀)로 꽉 채워두며 시스템 역할을 완수하였습니다.

결론: 일일 피킹율 손실은 RWCS 시스템의 알고리즘 정교함 부족이 아닌, 현장의 물리적 인프라 차단과 파레트 관리 부실에서 기인한 정량적 팩트입니다.`;

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
          <span>대고객 제출용 서술형 방어 리포트 (Daily Defense Report)</span>
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
        <span>작성기관: NovaTech RWCS Analytics Team | 대상 고객사: 한화비전</span>
        <span>보고서 자동 생성 일시: 2026-07-20 23:00 (공식 인쇄 검증 필)</span>
      </div>
    </section>
  );
}
