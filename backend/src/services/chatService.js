const weakSubjects = (subjectAverages) =>
  subjectAverages.filter((s) => Number(s.averageScore) < 55).map((s) => s.subjectName);

const toSummary = (yearlyInsights) => {
  const summary = yearlyInsights?.summary || {};
  return {
    overall: Number(summary.overallWeightedAverage || 0),
    trend: Number(summary.yearlyTrend || 0),
    consistency: Number(summary.consistencyIndex || 0),
    riskLevel: summary.riskLevel || "high",
    weakest: summary.weakestSubjects || [],
    strongest: summary.strongestSubjects || []
  };
};

const buildPlan = ({ weakest, riskLevel }) => {
  if (!weakest.length) {
    return "Weekly plan: 3 advanced practice blocks, 2 timed mock tests, 1 revision audit day.";
  }

  if (riskLevel === "high") {
    return `Recovery plan for ${weakest.join(", ")}: daily 45-minute concept rebuild + 20-question drill + 10-minute error journal.`;
  }

  return `Growth plan for ${weakest.join(", ")}: alternate concept revision and mixed practice, then run a timed mini-test every 3rd day.`;
};

export const buildAiChatReply = ({ role, message, subjectAverages, yearlyInsights, studentCode }) => {
  const normalizedMessage = String(message || "").toLowerCase();
  const weak = weakSubjects(subjectAverages || []);
  const summary = toSummary(yearlyInsights);

  const metricLine = `Metrics: weighted ${summary.overall.toFixed(1)}%, trend ${summary.trend >= 0 ? "+" : ""}${summary.trend.toFixed(1)} pts, consistency ${summary.consistency.toFixed(1)}%.`;

  if (role === "student") {
    if (normalizedMessage.includes("plan") || normalizedMessage.includes("schedule")) {
      return `${metricLine} ${buildPlan({ weakest: summary.weakest.length ? summary.weakest : weak, riskLevel: summary.riskLevel })}`;
    }

    if (normalizedMessage.includes("improve") || normalizedMessage.includes("weak")) {
      const focus = summary.weakest.length ? summary.weakest : weak;
      if (!focus.length) return `${metricLine} No weak zone detected. Shift to higher-difficulty and timed problem solving.`;
      return `${metricLine} Weak areas: ${focus.join(", ")}. Do concept recap -> targeted drill -> re-test loop every week.`;
    }

    if (normalizedMessage.includes("attendance")) {
      return `${metricLine} Keep attendance above 90% and pair absences with same-day recovery revision to avoid trend drop.`;
    }

    if (!weak.length && !summary.weakest.length) {
      return `${metricLine} Performance is stable. Ask for exam-specific advanced strategy (UT2, T1, or T2).`;
    }

    return `${metricLine} Ask for a weekly plan, chapter prioritization, or a mock-test correction strategy.`;
  }

  if (role === "teacher") {
    const targetWeak = summary.weakest.length ? summary.weakest : weak;

    if (studentCode && targetWeak.length) {
      return `${metricLine} ${studentCode} intervention: prioritize ${targetWeak.join(", ")}, run 7-day remediation cycles, and review with parent weekly.`;
    }

    if (studentCode && !targetWeak.length) {
      return `${metricLine} ${studentCode} is stable. Increase application-level tasks and monitor consistency before next term test.`;
    }

    if (normalizedMessage.includes("class") || normalizedMessage.includes("strategy")) {
      return "Class strategy: group by weak subjects, assign remedial worksheets by trend band, and measure improvement with weekly micro-assessments.";
    }

    return "Mention a student code (e.g. S1234) for individualized intervention using trend and consistency metrics.";
  }

  return "I can help with yearly progress analysis and actionable improvement strategies.";
};
