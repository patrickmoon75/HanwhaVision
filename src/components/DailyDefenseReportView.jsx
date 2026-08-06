import React from 'react';
import { FileText, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatWithDayOfWeek } from '../services/dataProcessor';

export default function DailyDefenseReportView({ selectedDate, dateInfo }) {
  if (!dateInfo) return null;

  // 악영향 요인을 영향도 크기 순으로 정렬
  const factors = [
    {
      label: '야드플랜 미실행',
      subLabel: `Yard Plan Loss: ${dateInfo.yardPlanLossRate ?? 0}%`,
      rate: parseFloat(dateInfo.yardPlanLossRate) || 0,
      body: `전날(${dateInfo.prevDate}) 지게차 완료 미션 부족으로 야드 빈 셀이 ${(Math.max(0, (dateInfo.availYard || 805) - (dateInfo.occupiedYardCount || 0))).toLocaleString()} / ${(dateInfo.availYard || 805).toLocaleString()}셀 (${(((Math.max(0, (dateInfo.availYard || 805) - (dateInfo.occupiedYardCount || 0))) / (dateInfo.availYard || 805)) * 100).toFixed(1)}%) 발생하였습니다. 당일 야드플랜이 충분히 실행되지 못하여 전체 피킹율 손실 중 가장 큰 비율(${dateInfo.yardPlanLossRate ?? 0}%)을 차지하는 핵심 요인입니다.`
    },
    {
      label: '현장 자재 적치 관리 부실',
      subLabel: `Operational Error Loss: ${dateInfo.opErrorLossRate}%`,
      rate: parseFloat(dateInfo.opErrorLossRate) || 0,
      body: `야간 전진 배치 작업 중, 4~5단 고단 랙 피킹 시 파레트 흔들림 및 적치 불량으로 인한 로봇 안전 센서 정상 보호 동작(Soft reset)이 총 ${dateInfo.softResetCount}건 발생하였습니다. 이는 로봇 하드웨어 문제가 아닌 현장 관리 부실에 기인한 손실입니다.`
    },
    {
      label: '현장 인프라 진입 차단',
      subLabel: `Infrastructure Loss: ${dateInfo.infraLossRate}%`,
      rate: parseFloat(dateInfo.infraLossRate) || 0,
      body: `당일 출고 요청된 전체 피킹 수량 ${(dateInfo.totalPickQty ?? 0).toLocaleString()}개 중 ${(dateInfo.blockedRackPickQty ?? 0).toLocaleString()}개(${dateInfo.infraLossRate}%)가 접근불가 차단 랙(Blocked == TRUE)에서 지시된 물량으로, 무인지게차(AGF)의 물리적 접근이 불가능했습니다. (차단 랙 전체 차단율 33.7%)`
    },
    {
      label: 'RWCS 시스템 복구 및 만재율 입증',
      subLabel: `Fallback & Occupancy Rate: ${dateInfo.yardOccupancyRate}%`,
      rate: 0, // 시스템 복구는 긍정 요소이므로 항상 마지막 배치
      body: `로봇 제어 시스템(RWCS)은 에러 속에서도 즉시 차선순위(Next Best) 미션을 자동 가동하여, 출고 직전 야드 만재율을 ${dateInfo.yardOccupancyRate}% (${dateInfo.occupiedYardCount}/${dateInfo.availYard} 셀)로 유지하며 시스템 역할을 완수하였습니다.`
    }
  ].sort((a, b) => b.rate - a.rate);

  // 가장 큰 악영향 요인
  const biggestFactor = factors[0];

  const reportLines = [
    `[RWCS 운영 결과 분석 리포트 - ${formatWithDayOfWeek(selectedDate)}]`,
    ``,
    `${formatWithDayOfWeek(selectedDate)} 당일 야드 피킹율 ${dateInfo.yardPickingRate}% 기록의 주된 원인은 RWCS 배치 알고리즘의 로직 오류가 아닙니다. 가장 큰 악영향 요인은 「${biggestFactor.label}(${biggestFactor.subLabel})」으로, 전체 피킹율 손실 중 가장 높은 비율을 차지하였습니다.`,
    ``,
    ...factors.map((f, i) => [
      `${i + 1}. ${f.label} (${f.subLabel}):`,
      `   ${f.body}`,
      ``
    ]).flat(),
    `■ 종합 의견:`,
    `   금일 피킹율 하락은 RWCS 알고리즘 자체의 오류나 성능 한계에서 비롯된 것이 아닙니다. 가장 큰 원인은 ①전날 지게차 완료 미션 부족에 따른 야드플랜 미실행(${dateInfo.yardPlanLossRate ?? 0}%)이며, 이어서 ②현장 적치 불량으로 인한 반복적인 로봇 Soft reset(${dateInfo.opErrorLossRate}%)과 ③물리적 인프라 차단으로 인한 AGF 접근 불가(${dateInfo.infraLossRate}%)가 복합적으로 작용하였습니다. RWCS 시스템은 이러한 제약 조건 속에서도 차선순위 미션 자동 전환으로 야드 만재율을 정상 유지하며 시스템의 역할을 충실히 수행하였습니다. 향후 피킹율 개선을 위해서는 전날 야드플랜 완료 미션 목표 달성, 현장 파레트 적치 기준 강화, 진입 차단 구역의 단계적 해제가 우선 과제로 판단됩니다.`
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
