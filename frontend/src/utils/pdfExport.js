const encoder = new TextEncoder();

const byteLength = (value) => encoder.encode(value).length;

const escapePdfText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapLine = (text, maxChars = 88) => {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];

  const words = clean.split(" ");
  const lines = [];
  let current = words[0] || "";

  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[index];
    }
  }

  lines.push(current);
  return lines;
};

const splitPages = (lines, maxLinesPerPage = 52) => {
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }
  return pages.length ? pages : [[""]];
};

const buildPageStream = (lines) => {
  const topY = 800;
  const lineStep = 14;
  const streamLines = ["BT", "/F1 11 Tf", `50 ${topY} Td`];

  lines.forEach((line, index) => {
    if (index > 0) {
      streamLines.push(`0 -${lineStep} Td`);
    }
    streamLines.push(`(${escapePdfText(line)}) Tj`);
  });

  streamLines.push("ET");
  return streamLines.join("\n");
};

export const downloadTextReportPdf = ({ fileName, title, lines }) => {
  const wrappedLines = [
    ...wrapLine(title, 78),
    "",
    ...lines.flatMap((line) => wrapLine(line, 90))
  ];

  const pageChunks = splitPages(wrappedLines, 52);
  const fontObjectNumber = 3 + pageChunks.length * 2;

  const objects = new Map();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");

  const kids = [];

  pageChunks.forEach((pageLines, pageIndex) => {
    const pageObjectNumber = 3 + pageIndex * 2;
    const contentObjectNumber = pageObjectNumber + 1;

    kids.push(`${pageObjectNumber} 0 R`);

    const pageStream = buildPageStream(pageLines);
    objects.set(
      contentObjectNumber,
      `<< /Length ${byteLength(pageStream)} >>\nstream\n${pageStream}\nendstream`
    );

    objects.set(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
  });

  objects.set(2, `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageChunks.length} >>`);
  objects.set(fontObjectNumber, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const objectNumbers = [...objects.keys()].sort((a, b) => a - b);

  let pdf = "%PDF-1.4\n";
  const offsets = new Map();

  objectNumbers.forEach((objectNumber) => {
    offsets.set(objectNumber, byteLength(pdf));
    pdf += `${objectNumber} 0 obj\n${objects.get(objectNumber)}\nendobj\n`;
  });

  const xrefStart = byteLength(pdf);
  const size = objectNumbers[objectNumbers.length - 1] + 1;

  pdf += `xref\n0 ${size}\n`;
  pdf += "0000000000 65535 f \n";

  for (let objectNumber = 1; objectNumber < size; objectNumber += 1) {
    const offset = offsets.get(objectNumber) || 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
};
