export const EXAM_TYPES = ["UT1", "UT2", "TERM1", "TERM2"];

const SECTION_KEYS = {
  UT1: { score: "unitTest1", max: "unitTest1Max" },
  UT2: { score: "unitTest2", max: "unitTest2Max" },
  TERM1: { score: "term1", max: "term1Max" },
  TERM2: { score: "term2", max: "term2Max" }
};

const EXAM_SEQUENCE = ["UT1", "UT2", "TERM1", "TERM2"];

const EXAM_WEIGHTS = {
  UT1: 0.15,
  UT2: 0.2,
  TERM1: 0.3,
  TERM2: 0.35
};

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const stdDeviation = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const getEmptyRow = (subjectName) => ({
  subjectName,
  unitTest1: null,
  unitTest1Max: null,
  unitTest2: null,
  unitTest2Max: null,
  term1: null,
  term1Max: null,
  term2: null,
  term2Max: null,
  totalObtained: 0,
  totalMax: 0
});

const computeTotals = (row) => {
  const pairs = [
    [row.unitTest1, row.unitTest1Max],
    [row.unitTest2, row.unitTest2Max],
    [row.term1, row.term1Max],
    [row.term2, row.term2Max]
  ];

  const totalObtained = pairs.reduce((sum, [score]) => sum + (typeof score === "number" ? score : 0), 0);
  const totalMax = pairs.reduce((sum, [, max]) => sum + (typeof max === "number" ? max : 0), 0);

  return {
    ...row,
    totalObtained: round2(totalObtained),
    totalMax: round2(totalMax)
  };
};

const getExamPercentage = (row, examType) => {
  const keys = SECTION_KEYS[examType];
  if (!keys) return null;

  const score = row[keys.score];
  const max = row[keys.max];

  if (typeof score !== "number" || typeof max !== "number" || max <= 0) return null;
  return (score / max) * 100;
};

const getRiskLevel = ({ overallWeightedAverage, yearlyTrend, consistencyIndex }) => {
  if (overallWeightedAverage < 50 || consistencyIndex < 55 || yearlyTrend < -8) return "high";
  if (overallWeightedAverage < 70 || consistencyIndex < 70 || yearlyTrend < -2) return "moderate";
  return "low";
};

export const getMarksMatrixByStudentId = async (studentDb, studentId) => {
  const [rows] = await studentDb.query(
    `SELECT subj.subject_name AS subjectName, m.exam_type AS examType, m.score, m.full_marks AS fullMarks
     FROM marks m
     JOIN subjects subj ON subj.id = m.subject_id
     WHERE m.student_id = ?
     ORDER BY subj.subject_name, m.created_at DESC`,
    [studentId]
  );

  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.subjectName)) {
      map.set(row.subjectName, getEmptyRow(row.subjectName));
    }

    const item = map.get(row.subjectName);
    const keys = SECTION_KEYS[row.examType];
    if (!keys) continue;

    if (item[keys.max] === null && row.fullMarks !== null && row.fullMarks !== undefined) {
      item[keys.max] = Number(row.fullMarks);
    }

    if (item[keys.score] === null && row.score !== null && row.score !== undefined) {
      item[keys.score] = Number(row.score);
    }
  }

  return Array.from(map.values())
    .map(computeTotals)
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
};

export const getSubjectAveragesFromMatrix = (marksMatrix) => {
  return marksMatrix.map((row) => {
    const percentages = EXAM_SEQUENCE.map((examType) => getExamPercentage(row, examType)).filter((value) => typeof value === "number");

    const averageScore = percentages.length
      ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
      : 0;

    return {
      subjectName: row.subjectName,
      averageScore: round2(averageScore)
    };
  });
};

export const getYearlyProgressInsights = (marksMatrix) => {
  const subjectReports = marksMatrix.map((row) => {
    const examPercentages = EXAM_SEQUENCE.map((examType) => ({
      examType,
      percentage: getExamPercentage(row, examType)
    }));

    const available = examPercentages.filter((item) => typeof item.percentage === "number");

    const weightedSum = available.reduce((sum, item) => sum + item.percentage * EXAM_WEIGHTS[item.examType], 0);
    const weightTotal = available.reduce((sum, item) => sum + EXAM_WEIGHTS[item.examType], 0);
    const weightedScore = weightTotal ? weightedSum / weightTotal : 0;

    const first = available[0]?.percentage ?? 0;
    const last = available[available.length - 1]?.percentage ?? 0;
    const trend = available.length >= 2 ? last - first : 0;

    const values = available.map((item) => item.percentage);
    const consistency = values.length ? Math.max(0, 100 - stdDeviation(values)) : 0;
    const coverage = (available.length / EXAM_SEQUENCE.length) * 100;

    return {
      subjectName: row.subjectName,
      weightedScore: round2(weightedScore),
      firstScore: round2(first),
      latestScore: round2(last),
      trend: round2(trend),
      consistency: round2(consistency),
      coverage: round2(coverage),
      examPercentages: examPercentages.map((item) => ({
        examType: item.examType,
        percentage: typeof item.percentage === "number" ? round2(item.percentage) : null
      }))
    };
  });

  if (!subjectReports.length) {
    return {
      summary: {
        overallWeightedAverage: 0,
        yearlyTrend: 0,
        consistencyIndex: 0,
        coverageAverage: 0,
        riskLevel: "high",
        weakestSubjects: [],
        strongestSubjects: [],
        improvingSubjects: []
      },
      subjectReports: []
    };
  }

  const overallWeightedAverage =
    subjectReports.reduce((sum, subject) => sum + subject.weightedScore, 0) / subjectReports.length;
  const yearlyTrend = subjectReports.reduce((sum, subject) => sum + subject.trend, 0) / subjectReports.length;
  const consistencyIndex =
    subjectReports.reduce((sum, subject) => sum + subject.consistency, 0) / subjectReports.length;
  const coverageAverage =
    subjectReports.reduce((sum, subject) => sum + subject.coverage, 0) / subjectReports.length;

  const weakestSubjects = [...subjectReports]
    .sort((a, b) => a.weightedScore - b.weightedScore)
    .slice(0, 3)
    .map((item) => item.subjectName);

  const strongestSubjects = [...subjectReports]
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 2)
    .map((item) => item.subjectName);

  const improvingSubjects = subjectReports
    .filter((item) => item.trend > 4)
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 3)
    .map((item) => item.subjectName);

  return {
    summary: {
      overallWeightedAverage: round2(overallWeightedAverage),
      yearlyTrend: round2(yearlyTrend),
      consistencyIndex: round2(consistencyIndex),
      coverageAverage: round2(coverageAverage),
      riskLevel: getRiskLevel({ overallWeightedAverage, yearlyTrend, consistencyIndex }),
      weakestSubjects,
      strongestSubjects,
      improvingSubjects
    },
    subjectReports
  };
};

export const getAiInputFromAverages = (subjectAverages) => {
  return subjectAverages.map((item) => ({
    subject_name: item.subjectName,
    average_score: Number(item.averageScore)
  }));
};
