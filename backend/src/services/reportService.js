import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import PDFDocument from "pdfkit";

const chartCanvas = new ChartJSNodeCanvas({
  width: 720,
  height: 320,
  backgroundColour: "white"
});

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-IN");
};

const toPercent = (obtained, max) => {
  if (!max) return 0;
  return Number((((obtained / max) * 100) || 0).toFixed(2));
};

const average = (values = []) => {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length).toFixed(2));
};

export const buildStudentReportPdf = async ({
  school,
  student,
  performanceRecords,
  attendancePercentage,
  riskLevel,
  insights
}) => {
  const labels = performanceRecords.map((item) => `${item.examType} (${formatDate(item.examDate)})`);
  const values = performanceRecords.map((item) => toPercent(item.marksObtained, item.maxMarks));
  const overallPercentage = average(values);

  const chartImage = await chartCanvas.renderToBuffer({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Score %",
          data: values,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.25)",
          tension: 0.25,
          fill: true
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Student Report Card", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`School: ${school.name}`);
    doc.text(`Student: ${student.fullName}`);
    doc.text(`Admission Number: ${student.admissionNumber}`);
    doc.text(`Class: ${student.grade} - ${student.section}`);
    doc.text(`Attendance: ${attendancePercentage}%`);
    doc.text(`Overall Percentage: ${overallPercentage}%`);
    doc.text(`Risk Level: ${riskLevel}`);

    doc.moveDown(1);
    doc.fontSize(13).text("Performance Records", { underline: true });
    doc.moveDown(0.4);

    performanceRecords.forEach((item) => {
      const scorePct = toPercent(item.marksObtained, item.maxMarks);
      doc
        .fontSize(10)
        .text(
          `${formatDate(item.examDate)} | ${item.subjectId?.name || "Subject"} | ${item.examType} | ${item.marksObtained}/${item.maxMarks} (${scorePct}%)`
        );
      if (item.remark) {
        doc.fontSize(9).fillColor("#4b5563").text(`Remark: ${item.remark}`);
        doc.fillColor("black");
      }
    });

    doc.addPage();
    doc.fontSize(13).text("Performance Trend Graph", { underline: true });
    doc.moveDown(0.4);
    doc.image(chartImage, { fit: [520, 240], align: "center" });

    doc.moveDown(1.2);
    doc.fontSize(13).text("AI Insights", { underline: true });
    doc.moveDown(0.4);
    if (!insights?.length) {
      doc.fontSize(10).text("No major risk insight detected. Keep up the good work.");
    } else {
      insights.forEach((insight) => {
        doc.fontSize(10).text(`- ${insight}`);
      });
    }

    doc.end();
  });
};
