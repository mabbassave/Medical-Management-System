export interface PrescriptionPdfData {
  patientName: string;
  doctorName: string;
  diagnosis: string;
  createdAt: string;
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
}

const toPdfText = (value: string): string => value
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const wrap = (value: string, width = 82): string[] => {
  const words = value.replace(/[^\x20-\x7E]/g, '?').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

export const downloadPrescriptionPdf = (prescription: PrescriptionPdfData): void => {
  const date = new Date(prescription.createdAt);
  const dateText = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString();
  const lines = [
    'MEDICAL PRESCRIPTION',
    '',
    ...wrap(`Patient: ${prescription.patientName}`),
    ...wrap(`Doctor: ${prescription.doctorName}`),
    ...wrap(`Date: ${dateText}`),
    '',
    ...wrap(`Diagnosis: ${prescription.diagnosis}`),
    '',
    'MEDICINES',
  ];

  prescription.medicines.forEach((medicine, index) => {
    lines.push(...wrap(`${index + 1}. ${medicine.name}`));
    lines.push(...wrap(`   Dosage: ${medicine.dosage || 'Not provided'}`));
    lines.push(...wrap(`   Frequency: ${medicine.frequency || 'Not provided'}`));
    lines.push(...wrap(`   Duration: ${medicine.duration || 'Not provided'}`));
    lines.push(...wrap(`   Instructions: ${medicine.instructions || 'Not provided'}`));
    lines.push('');
  });

  const linesPerPage = 48;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  pages.forEach((pageLines, index) => {
    const pageObjectId = 4 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const commands = pageLines.map((line, lineIndex) => {
      const fontSize = lineIndex === 0 && index === 0 ? 18 : 10;
      const y = 790 - lineIndex * 15;
      return `BT /F1 ${fontSize} Tf 48 ${y} Td (${toPdfText(line)}) Tj ET`;
    }).join('\n');
    objects[pageObjectId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([new TextEncoder().encode(pdf)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileDate = Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10);
  link.download = `prescription-${fileDate}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
