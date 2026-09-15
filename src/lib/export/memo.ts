import { jsPDF } from "jspdf";
import { downloadBlob } from "./download";

export interface MemoInput {
  label: string;
  value: string;
}
export interface MemoStep {
  label: string;
  reference?: string;
  formula: string;
  substitution: string;
  result: string;
}
export interface MemoVerdict {
  label: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
}

export interface MemoDoc {
  moduleTitle: string;
  corridorName: string;
  designSpeedLabel: string;
  designVehicleLabel: string;
  stationRangeLabel: string;
  unitSystemLabel: string;
  inputs: MemoInput[];
  steps: MemoStep[];
  verdicts: MemoVerdict[];
  preparedBy?: string;
}

const MARGIN = 18;
const PAGE_W = 215.9; // Letter mm
const PAGE_H = 279.4;
const CONTENT_W = PAGE_W - MARGIN * 2;

function verdictColor(status: MemoVerdict["status"]): [number, number, number] {
  if (status === "PASS") return [16, 129, 87];
  if (status === "WARN") return [146, 97, 10];
  return [138, 31, 31];
}

export function generateMemoPdf(doc: MemoDoc) {
  const pdf = new jsPDF({ unit: "mm", format: "letter" });
  let y = MARGIN;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  // Firm header
  pdf.setFont("courier", "bold");
  pdf.setFontSize(14);
  pdf.text("HIGHWAYLAB ENGINEERING WORKSTATION", MARGIN, y);
  pdf.setFont("courier", "normal");
  pdf.setFontSize(8);
  pdf.text("PRELIMINARY ENGINEERING CALCULATION MEMORANDUM", MARGIN, y + 5);
  pdf.text(new Date().toISOString().slice(0, 10), PAGE_W - MARGIN, y, { align: "right" });
  y += 9;
  pdf.setDrawColor(60, 60, 60);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // Project metadata block
  pdf.setFontSize(9);
  pdf.setFont("courier", "bold");
  pdf.text(doc.moduleTitle.toUpperCase(), MARGIN, y);
  y += 5;
  pdf.setFont("courier", "normal");
  pdf.setFontSize(8);
  const meta: [string, string][] = [
    ["Corridor", doc.corridorName],
    ["Design Speed", doc.designSpeedLabel],
    ["Design Vehicle", doc.designVehicleLabel],
    ["Station Range", doc.stationRangeLabel],
    ["Unit System", doc.unitSystemLabel],
  ];
  for (const [k, v] of meta) {
    pdf.text(`${k}:`, MARGIN, y);
    pdf.text(v, MARGIN + 32, y);
    y += 4.2;
  }
  y += 3;

  // Engineer review stamp box
  const stampW = 55;
  const stampH = 26;
  const stampX = PAGE_W - MARGIN - stampW;
  const stampY = MARGIN + 9;
  pdf.setDrawColor(120, 120, 120);
  pdf.rect(stampX, stampY, stampW, stampH);
  pdf.setFontSize(6.5);
  pdf.text("ENGINEER REVIEW / SEAL", stampX + 2, stampY + 4);
  pdf.text("PREPARED BY: " + (doc.preparedBy ?? "________________"), stampX + 2, stampY + 10);
  pdf.text("REVIEWED BY: ________________", stampX + 2, stampY + 15);
  pdf.text("DATE: ________________", stampX + 2, stampY + 20);
  pdf.text("[ PE SEAL / STAMP AREA ]", stampX + 2, stampY + 24.5);

  y = Math.max(y, stampY + stampH) + 4;
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // Compliance verdicts
  pdf.setFont("courier", "bold");
  pdf.setFontSize(9);
  pdf.text("COMPLIANCE VERDICT SUMMARY", MARGIN, y);
  y += 5;
  pdf.setFont("courier", "normal");
  pdf.setFontSize(8);
  for (const v of doc.verdicts) {
    newPageIfNeeded(6);
    const [r, g, b] = verdictColor(v.status);
    pdf.setTextColor(r, g, b);
    pdf.text(`[${v.status}]`, MARGIN, y);
    pdf.setTextColor(20, 20, 20);
    const detailLines = pdf.splitTextToSize(`${v.label} — ${v.detail}`, CONTENT_W - 18);
    pdf.text(detailLines, MARGIN + 16, y);
    y += 4.2 * detailLines.length + 1;
  }
  y += 3;
  pdf.setTextColor(20, 20, 20);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // Input parameters
  newPageIfNeeded(10);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(9);
  pdf.text("INPUT PARAMETERS", MARGIN, y);
  y += 5;
  pdf.setFont("courier", "normal");
  pdf.setFontSize(7.5);
  const colW = CONTENT_W / 2;
  doc.inputs.forEach((inp, i) => {
    const col = i % 2;
    if (col === 0) newPageIfNeeded(4.5);
    const x = MARGIN + col * colW;
    pdf.text(`${inp.label}:`, x, y);
    pdf.text(inp.value, x + colW - 4, y, { align: "right" });
    if (col === 1) y += 4.2;
  });
  if (doc.inputs.length % 2 === 1) y += 4.2;
  y += 4;
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // Step-by-step calculation proof
  newPageIfNeeded(10);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(9);
  pdf.text("STEP-BY-STEP CALCULATION PROOF", MARGIN, y);
  y += 5.5;
  doc.steps.forEach((s, i) => {
    newPageIfNeeded(16);
    pdf.setFont("courier", "bold");
    pdf.setFontSize(8);
    pdf.text(`${i + 1}. ${s.label}`, MARGIN, y);
    if (s.reference) {
      pdf.setFont("courier", "normal");
      pdf.setFontSize(6.5);
      pdf.text(s.reference, PAGE_W - MARGIN, y, { align: "right" });
    }
    y += 4;
    pdf.setFont("courier", "normal");
    pdf.setFontSize(7.5);
    pdf.text(`Formula:  ${s.formula}`, MARGIN + 3, y);
    y += 3.8;
    pdf.text(`Subst.:   ${s.substitution}`, MARGIN + 3, y);
    y += 3.8;
    pdf.setFont("courier", "bold");
    pdf.text(`Result:   ${s.result}`, MARGIN + 3, y);
    pdf.setFont("courier", "normal");
    y += 5.5;
  });

  y += 2;
  newPageIfNeeded(14);
  pdf.setDrawColor(160, 120, 20);
  pdf.setFontSize(6.5);
  const disclaimer = pdf.splitTextToSize(
    "DISCLAIMER: Design values and empirical coefficient curves in this memorandum approximate published " +
      "AASHTO Green Book, TRB Highway Capacity Manual, and TxDOT Roadway Design Manual design values for " +
      "engineering education and preliminary design purposes. This output has not been independently checked " +
      "and does not constitute a certified engineering document. A licensed Professional Engineer must review, " +
      "verify against the current governing edition, and seal all calculations prior to PS&E submittal or " +
      "construction use.",
    CONTENT_W
  );
  pdf.text(disclaimer, MARGIN, y);

  const filename = `${doc.moduleTitle.replace(/\s+/g, "_")}_Memorandum_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  const blob = pdf.output("blob");
  downloadBlob(blob, filename);
}
