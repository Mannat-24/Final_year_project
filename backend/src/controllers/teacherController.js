import { emitSchoolEvent, emitStudentEvent } from "../config/socket.js";
import { query } from "../config/db.js";
import { mapAttendanceRow, mapPerformanceRow, mapStudentRow, mapSubjectRow } from "../db/mappers.js";
import { evaluateStudentInsights } from "../services/insightService.js";
import { createNotifications } from "../services/notificationService.js";
import { buildPageMeta, getPagination } from "../utils/pagination.js";

const dayOrder = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

const normalizeDate = (input) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfWeek = (inputDate = new Date()) => {
  const date = new Date(inputDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (inputDate = new Date()) => {
  const date = new Date(inputDate);
  date.setHours(23, 59, 59, 999);
  return date;
};

const getElapsedSchoolDaysInWeek = (today = new Date()) => {
  const weekStart = startOfWeek(today);
  const pointer = new Date(weekStart);
  const end = endOfDay(today);

  let count = 0;

  while (pointer <= end) {
    const day = pointer.getDay();
    if (day >= 1 && day <= 6) {
      count += 1;
    }
    pointer.setDate(pointer.getDate() + 1);
  }

  return count;
};

const toClassName = (grade, section) => `Class ${String(grade).trim()}-${String(section || "A").trim()}`;

const mapPerformanceWithSubject = (row) => {
  const record = mapPerformanceRow(row);
  return {
    ...record,
    subjectId: {
      _id: row.subject_id,
      name: row.subject_name,
      code: row.subject_code
    }
  };
};

const ensureSchoolEntities = async (schoolId, studentId, subjectId) => {
  const [studentResult, subjectResult] = await Promise.all([
    query(
      `SELECT *
       FROM students
       WHERE id = $1 AND school_id = $2
       LIMIT 1`,
      [studentId, schoolId]
    ),
    query(
      `SELECT *
       FROM subjects
       WHERE id = $1 AND school_id = $2
       LIMIT 1`,
      [subjectId, schoolId]
    )
  ]);

  const student = studentResult.rows.length ? mapStudentRow(studentResult.rows[0]) : null;
  const subject = subjectResult.rows.length ? mapSubjectRow(subjectResult.rows[0]) : null;

  if (!student) {
    return { error: { status: 404, message: "Student not found in your school" } };
  }

  if (!subject) {
    return { error: { status: 404, message: "Subject not found in your school" } };
  }

  return { student, subject };
};

export const upsertPerformanceRecord = async (req, res) => {
  const { recordId, studentId, subjectId, examType, marksObtained, maxMarks, examDate, remark } = req.body;

  const schoolId = req.user.schoolId;
  const { student, subject, error } = await ensureSchoolEntities(schoolId, studentId, subjectId);
  if (error) {
    return res.status(error.status).json({ message: error.message });
  }

  const payload = {
    schoolId,
    studentId,
    subjectId,
    teacherUserId: req.user._id,
    examType,
    marksObtained: Number(marksObtained),
    maxMarks: Number(maxMarks),
    examDate: new Date(examDate),
    remark: remark || ""
  };

  let record;

  if (recordId) {
    const updateResult = await query(
      `UPDATE performance_records
       SET school_id = $1,
           student_id = $2,
           subject_id = $3,
           teacher_user_id = $4,
           exam_type = $5,
           marks_obtained = $6,
           max_marks = $7,
           exam_date = $8,
           remark = $9
       WHERE id = $10
         AND school_id = $1
       RETURNING *`,
      [
        payload.schoolId,
        payload.studentId,
        payload.subjectId,
        payload.teacherUserId,
        payload.examType,
        payload.marksObtained,
        payload.maxMarks,
        payload.examDate,
        payload.remark,
        recordId
      ]
    );

    if (!updateResult.rows.length) {
      return res.status(404).json({ message: "Performance record not found" });
    }

    const enrichedResult = await query(
      `SELECT pr.*, subj.name AS subject_name, subj.code AS subject_code
       FROM performance_records pr
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       WHERE pr.id = $1`,
      [updateResult.rows[0].id]
    );

    record = mapPerformanceWithSubject(enrichedResult.rows[0]);
  } else {
    const insertResult = await query(
      `INSERT INTO performance_records (
        school_id,
        student_id,
        subject_id,
        teacher_user_id,
        exam_type,
        marks_obtained,
        max_marks,
        exam_date,
        remark
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        payload.schoolId,
        payload.studentId,
        payload.subjectId,
        payload.teacherUserId,
        payload.examType,
        payload.marksObtained,
        payload.maxMarks,
        payload.examDate,
        payload.remark
      ]
    );

    const enrichedResult = await query(
      `SELECT pr.*, subj.name AS subject_name, subj.code AS subject_code
       FROM performance_records pr
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       WHERE pr.id = $1`,
      [insertResult.rows[0].id]
    );

    record = mapPerformanceWithSubject(enrichedResult.rows[0]);
  }

  const insightsResult = await evaluateStudentInsights({
    schoolId,
    studentId,
    senderUserId: req.user._id
  });

  await query(
    `UPDATE performance_records
     SET risk_level = $1
     WHERE id = $2`,
    [insightsResult.riskLevel, record._id]
  );

  record.riskLevel = insightsResult.riskLevel;

  const scorePercent = (Number(marksObtained) / Number(maxMarks)) * 100;
  if (scorePercent < 40) {
    const studentUserResult = await query(
      `SELECT id
       FROM users
       WHERE school_id = $1
         AND role = 'student'
         AND student_profile_id = $2
       LIMIT 1`,
      [schoolId, studentId]
    );

    const studentUserId = studentUserResult.rows[0]?.id;
    const recipients = [...(student.parentUserIds || []), ...(studentUserId ? [studentUserId] : [])];

    await createNotifications({
      schoolId,
      recipientUserIds: recipients,
      senderUserId: req.user._id,
      studentId,
      type: "performance",
      title: `Low score alert: ${student.fullName}`,
      message: `${subject.name} ${examType} score is ${Number(scorePercent.toFixed(2))}%`,
      metadata: {
        marksObtained,
        maxMarks,
        examType
      }
    });
  }

  const realtimePayload = {
    studentId,
    schoolId,
    record,
    insights: insightsResult.insights,
    riskLevel: insightsResult.riskLevel,
    updatedAt: new Date().toISOString()
  };

  emitSchoolEvent(String(schoolId), "performance:updated", realtimePayload);
  emitStudentEvent(String(studentId), "performance:updated", realtimePayload);

  return res.status(recordId ? 200 : 201).json({
    record,
    insights: insightsResult.insights,
    riskLevel: insightsResult.riskLevel
  });
};

export const upsertAttendanceRecord = async (req, res) => {
  const { studentId, date, status, remark } = req.body;
  const schoolId = req.user.schoolId;

  const studentResult = await query(
    `SELECT *
     FROM students
     WHERE id = $1 AND school_id = $2
     LIMIT 1`,
    [studentId, schoolId]
  );

  if (!studentResult.rows.length) {
    return res.status(404).json({ message: "Student not found in your school" });
  }

  const student = mapStudentRow(studentResult.rows[0]);

  const normalizedDate = normalizeDate(date);
  const normalizedDateString = normalizedDate.toISOString().slice(0, 10);

  const recordResult = await query(
    `INSERT INTO attendance_records (
      school_id,
      student_id,
      teacher_user_id,
      date,
      status,
      remark
    )
    VALUES ($1, $2, $3, $4::date, $5, $6)
    ON CONFLICT (student_id, date)
    DO UPDATE SET
      school_id = EXCLUDED.school_id,
      teacher_user_id = EXCLUDED.teacher_user_id,
      status = EXCLUDED.status,
      remark = EXCLUDED.remark
    RETURNING *`,
    [schoolId, studentId, req.user._id, normalizedDateString, status, remark || ""]
  );

  const record = mapAttendanceRow(recordResult.rows[0]);

  const insightsResult = await evaluateStudentInsights({
    schoolId,
    studentId,
    senderUserId: req.user._id
  });

  if (status === "Absent") {
    await createNotifications({
      schoolId,
      recipientUserIds: student.parentUserIds || [],
      senderUserId: req.user._id,
      studentId,
      type: "attendance",
      title: `Attendance alert: ${student.fullName}`,
      message: `Student was marked absent on ${normalizedDate.toLocaleDateString("en-IN")}`,
      metadata: {
        date: normalizedDate,
        status
      }
    });
  }

  const realtimePayload = {
    studentId,
    schoolId,
    record,
    insights: insightsResult.insights,
    riskLevel: insightsResult.riskLevel,
    updatedAt: new Date().toISOString()
  };

  emitSchoolEvent(String(schoolId), "attendance:updated", realtimePayload);
  emitStudentEvent(String(studentId), "attendance:updated", realtimePayload);

  return res.json({
    record,
    insights: insightsResult.insights,
    riskLevel: insightsResult.riskLevel
  });
};

export const listPerformanceRecords = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const whereParts = ["pr.school_id = $1"];
  const params = [req.user.schoolId];

  if (req.query.studentId) {
    params.push(req.query.studentId);
    whereParts.push(`pr.student_id = $${params.length}`);
  }

  if (req.query.subjectId) {
    params.push(req.query.subjectId);
    whereParts.push(`pr.subject_id = $${params.length}`);
  }

  const whereClause = `WHERE ${whereParts.join(" AND ")}`;

  const dataParams = [...params, limit, skip];

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT
         pr.*,
         st.full_name AS student_full_name,
         st.admission_number AS student_admission_number,
         st.grade AS student_grade,
         st.section AS student_section,
         subj.name AS subject_name,
         subj.code AS subject_code
       FROM performance_records pr
       INNER JOIN students st ON st.id = pr.student_id
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       ${whereClause}
       ORDER BY pr.exam_date DESC
       OFFSET $${dataParams.length}
       LIMIT $${dataParams.length - 1}`,
      dataParams
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM performance_records pr
       ${whereClause}`,
      params
    )
  ]);

  const items = itemsResult.rows.map((row) => {
    const record = mapPerformanceRow(row);
    return {
      ...record,
      studentId: {
        _id: row.student_id,
        fullName: row.student_full_name,
        admissionNumber: row.student_admission_number,
        grade: row.student_grade,
        section: row.student_section
      },
      subjectId: {
        _id: row.subject_id,
        name: row.subject_name,
        code: row.subject_code
      }
    };
  });

  const total = Number(totalResult.rows[0]?.count || 0);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const listAttendanceRecords = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const whereParts = ["ar.school_id = $1"];
  const params = [req.user.schoolId];

  if (req.query.studentId) {
    params.push(req.query.studentId);
    whereParts.push(`ar.student_id = $${params.length}`);
  }

  const whereClause = `WHERE ${whereParts.join(" AND ")}`;
  const dataParams = [...params, limit, skip];

  const [itemsResult, totalResult] = await Promise.all([
    query(
      `SELECT
         ar.*,
         st.full_name AS student_full_name,
         st.admission_number AS student_admission_number,
         st.grade AS student_grade,
         st.section AS student_section
       FROM attendance_records ar
       INNER JOIN students st ON st.id = ar.student_id
       ${whereClause}
       ORDER BY ar.date DESC
       OFFSET $${dataParams.length}
       LIMIT $${dataParams.length - 1}`,
      dataParams
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM attendance_records ar
       ${whereClause}`,
      params
    )
  ]);

  const items = itemsResult.rows.map((row) => {
    const record = mapAttendanceRow(row);
    return {
      ...record,
      studentId: {
        _id: row.student_id,
        fullName: row.student_full_name,
        admissionNumber: row.student_admission_number,
        grade: row.student_grade,
        section: row.student_section
      }
    };
  });

  const total = Number(totalResult.rows[0]?.count || 0);

  return res.json({
    items,
    meta: buildPageMeta(page, limit, total)
  });
};

export const teacherDashboard = async (req, res) => {
  const schoolId = req.user.schoolId;
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfDay(now);
  const elapsedSchoolDays = getElapsedSchoolDaysInWeek(now);

  const weekStartString = weekStart.toISOString().slice(0, 10);
  const weekEndString = weekEnd.toISOString().slice(0, 10);

  const [recentPerformanceResult, recentAttendanceResult, totalStudentsResult, weekAttendanceCountResult] = await Promise.all([
    query(
      `SELECT
         pr.*,
         st.full_name AS student_full_name,
         subj.name AS subject_name
       FROM performance_records pr
       INNER JOIN students st ON st.id = pr.student_id
       INNER JOIN subjects subj ON subj.id = pr.subject_id
       WHERE pr.school_id = $1
         AND pr.teacher_user_id = $2
       ORDER BY pr.created_at DESC
       LIMIT 10`,
      [schoolId, req.user._id]
    ),
    query(
      `SELECT
         ar.*,
         st.full_name AS student_full_name
       FROM attendance_records ar
       INNER JOIN students st ON st.id = ar.student_id
       WHERE ar.school_id = $1
         AND ar.teacher_user_id = $2
       ORDER BY ar.created_at DESC
       LIMIT 10`,
      [schoolId, req.user._id]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM students
       WHERE school_id = $1`,
      [schoolId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM attendance_records
       WHERE school_id = $1
         AND date BETWEEN $2::date AND $3::date`,
      [schoolId, weekStartString, weekEndString]
    )
  ]);

  const recentPerformance = recentPerformanceResult.rows.map((row) => {
    const record = mapPerformanceRow(row);
    return {
      ...record,
      studentId: {
        _id: row.student_id,
        fullName: row.student_full_name
      },
      subjectId: {
        _id: row.subject_id,
        name: row.subject_name
      }
    };
  });

  const recentAttendance = recentAttendanceResult.rows.map((row) => {
    const record = mapAttendanceRow(row);
    return {
      ...record,
      studentId: {
        _id: row.student_id,
        fullName: row.student_full_name
      }
    };
  });

  const totalStudents = Number(totalStudentsResult.rows[0]?.count || 0);
  const weekAttendanceCount = Number(weekAttendanceCountResult.rows[0]?.count || 0);

  const expectedWeekAttendance = totalStudents * elapsedSchoolDays;
  const pendingAttendanceThisWeek = Math.max(0, expectedWeekAttendance - weekAttendanceCount);

  return res.json({
    totals: {
      totalStudents,
      performanceUpdates: recentPerformance.length,
      attendanceUpdates: recentAttendance.length,
      pendingAttendanceThisWeek
    },
    recentPerformance,
    recentAttendance
  });
};

export const teacherReferenceData = async (req, res) => {
  const [studentsResult, subjectsResult] = await Promise.all([
    query(
      `SELECT id, full_name, admission_number, grade, section
       FROM students
       WHERE school_id = $1
       ORDER BY full_name ASC`,
      [req.user.schoolId]
    ),
    query(
      `SELECT id, name, code
       FROM subjects
       WHERE school_id = $1
       ORDER BY name ASC`,
      [req.user.schoolId]
    )
  ]);

  const students = studentsResult.rows.map((row) => ({
    _id: row.id,
    fullName: row.full_name,
    admissionNumber: row.admission_number,
    grade: row.grade,
    section: row.section
  }));

  const subjects = subjectsResult.rows.map((row) => ({
    _id: row.id,
    name: row.name,
    code: row.code
  }));

  const classes = [...new Set(students.map((student) => toClassName(student.grade, student.section)))]
    .sort((a, b) => a.localeCompare(b))
    .map((className) => ({ className }));

  return res.json({ students, subjects, classes });
};

export const teacherTimetable = async (req, res) => {
  const schoolId = req.user.schoolId;

  const studentsResult = await query(
    `SELECT grade, section
     FROM students
     WHERE school_id = $1`,
    [schoolId]
  );

  const classes = [...new Set(studentsResult.rows.map((student) => toClassName(student.grade, student.section)))]
    .sort((a, b) => a.localeCompare(b))
    .map((className) => ({ className }));

  const selectedClass = String(req.query.className || classes[0]?.className || "").trim();

  if (!selectedClass) {
    return res.json({ classes, className: "", slots: [] });
  }

  const slotsResult = await query(
    `SELECT
       ts.*,
       u.full_name AS teacher_full_name,
       u.email AS teacher_email
     FROM timetable_slots ts
     LEFT JOIN users u ON u.id = ts.teacher_user_id
     WHERE ts.school_id = $1
       AND ts.class_name = $2`,
    [schoolId, selectedClass]
  );

  const mappedSlots = slotsResult.rows
    .map((row) => ({
      id: row.id,
      className: row.class_name,
      dayOfWeek: row.day_of_week,
      periodNo: row.period_no,
      startTime: row.start_time,
      endTime: row.end_time,
      subjectName: row.subject_name,
      roomLabel: row.room_label,
      teacherName: row.teacher_full_name || "Teacher",
      teacherEmail: row.teacher_email || ""
    }))
    .sort((a, b) => {
      if (dayOrder[a.dayOfWeek] !== dayOrder[b.dayOfWeek]) return dayOrder[a.dayOfWeek] - dayOrder[b.dayOfWeek];
      return a.periodNo - b.periodNo;
    });

  return res.json({ classes, className: selectedClass, slots: mappedSlots });
};

export const upsertTeacherTimetableSlot = async (req, res) => {
  const { className, dayOfWeek, periodNo, startTime, endTime, subjectName, roomLabel } = req.body;
  const schoolId = req.user.schoolId;

  const slotResult = await query(
    `INSERT INTO timetable_slots (
      school_id,
      class_name,
      day_of_week,
      period_no,
      start_time,
      end_time,
      subject_name,
      room_label,
      teacher_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (school_id, class_name, day_of_week, period_no)
    DO UPDATE SET
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      subject_name = EXCLUDED.subject_name,
      room_label = EXCLUDED.room_label,
      teacher_user_id = EXCLUDED.teacher_user_id
    RETURNING *`,
    [
      schoolId,
      String(className).trim(),
      dayOfWeek,
      Number(periodNo),
      String(startTime).trim(),
      String(endTime).trim(),
      String(subjectName).trim(),
      String(roomLabel || "").trim(),
      req.user._id
    ]
  );

  const slot = slotResult.rows[0];

  emitSchoolEvent(String(schoolId), "timetable:updated", {
    className: slot.class_name,
    dayOfWeek: slot.day_of_week,
    periodNo: slot.period_no,
    updatedAt: new Date().toISOString()
  });

  return res.status(201).json({
    slot: {
      id: slot.id,
      className: slot.class_name,
      dayOfWeek: slot.day_of_week,
      periodNo: slot.period_no,
      startTime: slot.start_time,
      endTime: slot.end_time,
      subjectName: slot.subject_name,
      roomLabel: slot.room_label
    }
  });
};

export const deleteTeacherTimetableSlot = async (req, res) => {
  const { className, dayOfWeek, periodNo } = req.body;
  const schoolId = req.user.schoolId;

  const deleteResult = await query(
    `DELETE FROM timetable_slots
     WHERE school_id = $1
       AND class_name = $2
       AND day_of_week = $3
       AND period_no = $4
     RETURNING *`,
    [schoolId, String(className).trim(), dayOfWeek, Number(periodNo)]
  );

  if (!deleteResult.rows.length) {
    return res.status(404).json({ message: "Timetable slot not found" });
  }

  const deleted = deleteResult.rows[0];

  emitSchoolEvent(String(schoolId), "timetable:updated", {
    className: deleted.class_name,
    dayOfWeek: deleted.day_of_week,
    periodNo: deleted.period_no,
    removed: true,
    updatedAt: new Date().toISOString()
  });

  return res.json({ message: "Timetable slot removed" });
};
