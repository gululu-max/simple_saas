"use client";

import Image from "next/image";
import { useT } from "@/lib/i18n/provider";

export function PhotoDiagnosis() {
  const t = useT().home;
  const issues = [
    { id: 1, label: t.diagnosisIssue1, anchorX: "62%", anchorY: "35%" },
    { id: 2, label: t.diagnosisIssue2, anchorX: "30%", anchorY: "22%" },
    { id: 3, label: t.diagnosisIssue3, anchorX: "15%", anchorY: "12%" },
    { id: 4, label: t.diagnosisIssue4, anchorX: "55%", anchorY: "62%" },
    { id: 5, label: t.diagnosisIssue5, anchorX: "68%", anchorY: "28%" },
  ];

  return (
    <section className="bg-canvas pt-12 lg:pt-section pb-12 lg:pb-section">
      <div className="container px-6 max-w-[640px] mx-auto">
        {/* Header — 克制字号、ink 主色、ink-muted 副线 */}
        <div className="text-center mb-8">
          <h2 className="text-[22px] lg:text-[28px] font-bold tracking-[-0.4px] text-ink leading-[1.18] mb-3">
            {t.diagnosisTitle}
          </h2>
          <p className="text-ink-muted text-base leading-[1.5]">
            {t.diagnosisSubtitle}
          </p>
        </div>

        {/* Annotated Photo — 14px 卡片圆角 + 单层阴影 */}
        <div className="relative mx-auto rounded-card overflow-hidden bg-canvas shadow-ab-card">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src="/diagnosis-demo.webp"
              alt="Example dating profile photo with issues"
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
              priority
            />

            {/* Score badge — 白底 pill，ink 文字，唯一一处 Rausch 圆点呼吸 */}
            <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 bg-canvas text-ink text-[11px] font-semibold px-2.5 py-1 rounded-pill shadow-ab-card">
              <span className="inline-block w-1.5 h-1.5 rounded-pill bg-rausch animate-pulse" />
              Score 41/100
            </div>

            {/* 数字标记点 — Rausch 实心 + 白边 */}
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="absolute z-20 flex items-center justify-center"
                style={{
                  top: issue.anchorY,
                  left: issue.anchorX,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span
                  className="absolute w-8 h-8 rounded-pill bg-rausch/25 animate-ping"
                  style={{ animationDuration: `${2 + issue.id * 0.4}s` }}
                />
                <span className="relative flex items-center justify-center w-6 h-6 rounded-pill bg-rausch border-2 border-canvas text-white text-[11px] font-bold leading-none">
                  {issue.id}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Issues list — Airbnb amenity-row 样式：12px 行距，hairline-soft 分隔 */}
        <div className="mt-8 flex flex-col">
          {issues.map((issue, i) => (
            <div
              key={issue.id}
              className={`flex items-center gap-3 py-3 ${
                i < issues.length - 1 ? "border-b border-hairline-soft" : ""
              }`}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-pill bg-rausch text-white text-[11px] font-bold flex items-center justify-center">
                {issue.id}
              </span>
              <span className="text-ink-body text-base">{issue.label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-ink-muted text-sm mt-8 max-w-sm mx-auto leading-[1.5]">
          {t.diagnosisFooter}
        </p>
      </div>
    </section>
  );
}
