import { Analysis } from "../../types";
import { analysisDate, date } from "../../components/ui";

export function escapeHTML(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function analysisReportHTML(analysis: Analysis) {
  const rows = analysis.markers.length
    ? analysis.markers
        .map((marker) => {
          const reference =
            marker.reference_text ||
            [marker.reference_min, marker.reference_max]
              .filter((value) => value !== undefined)
              .join(" — ") ||
            "Не указан";
          const result = `${marker.value ?? marker.text_value ?? "—"}${marker.unit ? ` ${marker.unit}` : ""}`;
          return `<tr><td>${escapeHTML(marker.name)}</td><td class="value">${escapeHTML(result)}</td><td>${escapeHTML(reference)}</td><td><span class="status ${marker.status}">${escapeHTML(markerStatusText(marker.status))}</span></td></tr>`;
        })
        .join("")
    : '<tr><td colspan="4" class="empty">Показатели не распознаны</td></tr>';
  const report = analysis.report
    ? `<section class="report"><h3>Описание</h3><div class="report-text">${escapeHTML(analysis.report.description || "Описание отсутствует")}</div><h3>Заключение</h3><div class="conclusion">${escapeHTML(analysis.report.conclusion || "Заключение отсутствует в предоставленном фрагменте")}</div></section>`
    : `<table><thead><tr><th>Показатель</th><th>Результат</th><th>Референс</th><th>Статус</th></tr></thead><tbody>${rows}</tbody></table>`;
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><style>
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1c2330; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 12px; }
  .header { margin: -18mm -14mm 20px; padding: 22px 14mm 18px; color: white; background: linear-gradient(120deg, #1e315d, #395aa6, #187b83); }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: .85; }
  h1 { margin: 7px 0 3px; font-size: 22px; }
  .meta { color: #657086; margin: 4px 0 18px; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 9px; color: #263553; background: #eaf0f8; border: 1px solid #d5deeb; text-align: left; font-size: 11px; }
  td { padding: 10px 9px; border: 1px solid #dbe2ec; vertical-align: middle; }
  tr { break-inside: avoid; }
  .value { font-weight: 700; white-space: nowrap; }
  .status { display: inline-block; padding: 4px 7px; border-radius: 8px; color: #176452; background: #e4f5ef; font-size: 10px; font-weight: 700; white-space: nowrap; }
  .status.high, .status.low, .status.unknown { color: #9a5b12; background: #fff1da; }
  .empty { padding: 24px; color: #657086; text-align: center; }
  .report h3 { margin: 18px 0 7px; font-size: 13px; }
  .report-text { white-space: pre-wrap; line-height: 1.6; }
  .conclusion { padding: 12px; border-radius: 10px; background: #efecfb; white-space: pre-wrap; line-height: 1.55; font-weight: 700; }
  .note { margin-top: 20px; color: #657086; font-size: 10px; line-height: 1.5; }
</style></head><body>
  <div class="header"><div class="brand">Lab · медицинские документы</div><h1>${analysis.report ? "Результат медицинского исследования" : "Результаты лабораторного анализа"}</h1></div>
  <h2>${escapeHTML(analysis.title)}</h2>
  <div class="meta">Дата исследования: ${escapeHTML(date(analysisDate(analysis)))}</div>
  ${report}
  <div class="note">Документ содержит автоматически распознанные данные. Сверяйте значения с оригинальным бланком и обсуждайте медицинские решения с врачом.</div>
</body></html>`;
}

export function markerStatusText(value: string) {
  return value === "high"
    ? "Выше нормы"
    : value === "low"
      ? "Ниже нормы"
      : value === "normal"
        ? "Норма"
        : "Проверить";
}
