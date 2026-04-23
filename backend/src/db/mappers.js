const ensureArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export const mapSchoolRow = (row) => ({
  _id: row.id,
  name: row.name,
  code: row.code,
  address: row.address || "",
  contactEmail: row.contact_email || "",
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapUserRow = (row) => ({
  _id: row.id,
  fullName: row.full_name,
  email: row.email,
  role: row.role,
  schoolId: row.school_id || null,
  studentProfileId: row.student_profile_id || null,
  childStudentIds: ensureArray(row.child_student_ids),
  passwordHash: row.password_hash,
  passwordResetToken: row.password_reset_token || null,
  passwordResetExpiresAt: row.password_reset_expires_at || null,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapStudentRow = (row) => ({
  _id: row.id,
  schoolId: row.school_id,
  admissionNumber: row.admission_number,
  fullName: row.full_name,
  grade: row.grade,
  section: row.section,
  dateOfBirth: row.date_of_birth || null,
  parentUserIds: ensureArray(row.parent_user_ids),
  teacherUserIds: ensureArray(row.teacher_user_ids),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapSubjectRow = (row) => ({
  _id: row.id,
  schoolId: row.school_id,
  name: row.name,
  code: row.code,
  teacherUserId: row.teacher_user_id || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapPerformanceRow = (row) => ({
  _id: row.id,
  schoolId: row.school_id,
  studentId: row.student_id,
  subjectId: row.subject_id,
  teacherUserId: row.teacher_user_id,
  examType: row.exam_type,
  marksObtained: Number(row.marks_obtained),
  maxMarks: Number(row.max_marks),
  examDate: row.exam_date,
  remark: row.remark || "",
  riskLevel: row.risk_level || "Low",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapAttendanceRow = (row) => ({
  _id: row.id,
  schoolId: row.school_id,
  studentId: row.student_id,
  teacherUserId: row.teacher_user_id,
  date: row.date,
  status: row.status,
  remark: row.remark || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapNotificationRow = (row) => ({
  _id: row.id,
  schoolId: row.school_id,
  recipientUserId: row.recipient_user_id,
  senderUserId: row.sender_user_id || null,
  studentId: row.student_id || null,
  type: row.type,
  title: row.title,
  message: row.message,
  isRead: row.is_read,
  metadata: row.metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapTimeTableSlotRow = (row) => ({
  _id: row.id,
  schoolId: row.school_id,
  className: row.class_name,
  dayOfWeek: row.day_of_week,
  periodNo: row.period_no,
  startTime: row.start_time,
  endTime: row.end_time,
  subjectName: row.subject_name,
  roomLabel: row.room_label || "",
  teacherUserId: row.teacher_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapExtracurricularRow = (row) => ({
  _id: row.id,
  schoolId: row.school_id,
  studentId: row.student_id,
  teacherUserId: row.teacher_user_id,
  activityType: row.activity_type,
  activityName: row.activity_name,
  level: row.level || "School",
  participationDate: row.participation_date,
  remarks: row.remarks || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
