import axios from "axios";
import { env } from "../config/env.js";

const heuristicRisk = ({ marks, attendance, pastPerformance }) => {
  const normalizedMarks = Math.max(0, Math.min(100, Number(marks || 0)));
  const normalizedAttendance = Math.max(0, Math.min(100, Number(attendance || 0)));
  const normalizedPast = Math.max(0, Math.min(100, Number(pastPerformance || 0)));

  const blendedScore = normalizedMarks * 0.45 + normalizedAttendance * 0.3 + normalizedPast * 0.25;

  if (blendedScore < 45) return "High";
  if (blendedScore < 65) return "Medium";
  return "Low";
};

export const predictRiskLevel = async (features) => {
  try {
    const { data } = await axios.post(
      `${env.mlServiceUrl}/predict`,
      {
        marks: Number(features.marks || 0),
        attendance: Number(features.attendance || 0),
        past_performance: Number(features.pastPerformance || 0)
      },
      {
        timeout: 3000
      }
    );

    if (data?.riskLevel && ["Low", "Medium", "High"].includes(data.riskLevel)) {
      return data;
    }
  } catch {
    // Fallback to local heuristic when ML service is unavailable.
  }

  return {
    riskLevel: heuristicRisk(features),
    model: "heuristic-fallback"
  };
};