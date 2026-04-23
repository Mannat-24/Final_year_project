import bcrypt from "bcryptjs";
import { connectDb, query } from "../src/config/db.js";

const buildPastDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
};

const hashPassword = (plain) => bcrypt.hash(plain, 12);

const seed = async () => {
  await connectDb();

  await query(
    `TRUNCATE TABLE
      notifications,
      attendance_records,
      performance_records,
      extracurricular_records,
      timetable_slots,
      allowed_schools,
      users,
      subjects,
      students,
      schools
     RESTART IDENTITY CASCADE`
  );

  const schoolResult = await query(
    `INSERT INTO schools (name, code, address, contact_email)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    ["Greenfield Public School", "GFPS01", "Bengaluru, India", "office@gfps.edu"]
  );
  const school = schoolResult.rows[0];

  const secondSchoolResult = await query(
    `INSERT INTO schools (name, code, address, contact_email)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    ["Horizon International School", "HIS02", "Pune, India", "admin@horizon.edu"]
  );
  const secondSchool = secondSchoolResult.rows[0];

  const [ownerPassword, managerPassword, adminPassword, teacherPassword, studentPassword, parentPassword] = await Promise.all([
    hashPassword("34567890"),
    hashPassword("Mannu@2402"),
    hashPassword("Admin@123"),
    hashPassword("Teacher@123"),
    hashPassword("Student@123"),
    hashPassword("Parent@123")
  ]);

  const ownerResult = await query(
    `INSERT INTO users (full_name, email, password_hash, role, school_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    ["Owner", "abc123@gmail.com", ownerPassword, "owner", null]
  );
  const owner = ownerResult.rows[0];

  await query(
    `INSERT INTO users (full_name, email, password_hash, role, school_id)
     VALUES ($1, $2, $3, $4, $5)`,
    ["Mannat Pangotra", "mannatpangotra29@gmail.com", managerPassword, "admin", school.id]
  );

  await query(
    `INSERT INTO users (full_name, email, password_hash, role, school_id)
     VALUES ($1, $2, $3, $4, $5)`,
    ["School Admin", "admin@gfps.edu", adminPassword, "admin", school.id]
  );

  const teacherResult = await query(
    `INSERT INTO users (full_name, email, password_hash, role, school_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    ["Anita Sharma", "teacher@gfps.edu", teacherPassword, "teacher", school.id]
  );
  const teacher = teacherResult.rows[0];

  const studentProfileResult = await query(
    `INSERT INTO students (
      school_id,
      admission_number,
      full_name,
      grade,
      section,
      teacher_user_ids
    )
    VALUES ($1, $2, $3, $4, $5, $6::uuid[])
    RETURNING *`,
    [school.id, "GFPS-1001", "Rahul Verma", "10", "A", [teacher.id]]
  );
  const studentProfile = studentProfileResult.rows[0];

  const secondStudentResult = await query(
    `INSERT INTO students (
      school_id,
      admission_number,
      full_name,
      grade,
      section,
      teacher_user_ids
    )
    VALUES ($1, $2, $3, $4, $5, $6::uuid[])
    RETURNING *`,
    [school.id, "GFPS-1002", "Aarav Gupta", "10", "A", [teacher.id]]
  );
  const secondStudent = secondStudentResult.rows[0];

  const parentResult = await query(
    `INSERT INTO users (
      full_name,
      email,
      password_hash,
      role,
      school_id,
      child_student_ids
    )
    VALUES ($1, $2, $3, $4, $5, $6::uuid[])
    RETURNING *`,
    ["Priya Verma", "parent@gfps.edu", parentPassword, "parent", school.id, [studentProfile.id]]
  );
  const parent = parentResult.rows[0];

  const studentUserResult = await query(
    `INSERT INTO users (
      full_name,
      email,
      password_hash,
      role,
      school_id,
      student_profile_id
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    ["Rahul Verma", "student@gfps.edu", studentPassword, "student", school.id, studentProfile.id]
  );
  const studentUser = studentUserResult.rows[0];

  await query(
    `UPDATE students
     SET parent_user_ids = $1::uuid[],
         teacher_user_ids = $2::uuid[]
     WHERE id = $3`,
    [[parent.id], [teacher.id], studentProfile.id]
  );

  const mathResult = await query(
    `INSERT INTO subjects (school_id, name, code, teacher_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [school.id, "Mathematics", "MATH", teacher.id]
  );
  const math = mathResult.rows[0];

  const scienceResult = await query(
    `INSERT INTO subjects (school_id, name, code, teacher_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [school.id, "Science", "SCI", teacher.id]
  );
  const science = scienceResult.rows[0];

  const englishResult = await query(
    `INSERT INTO subjects (school_id, name, code, teacher_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [school.id, "English", "ENG", teacher.id]
  );
  const english = englishResult.rows[0];

  const performanceRows = [
    [school.id, studentProfile.id, math.id, teacher.id, "UT-1", 15, 20, buildPastDate(35), "Good start", "Low"],
    [school.id, studentProfile.id, science.id, teacher.id, "UT-1", 9, 20, buildPastDate(35), "Needs concept revision", "Medium"],
    [school.id, studentProfile.id, english.id, teacher.id, "UT-1", 14, 20, buildPastDate(35), "Consistent", "Low"],
    [school.id, studentProfile.id, math.id, teacher.id, "UT-2", 11, 20, buildPastDate(15), "Declining attention", "Medium"],
    [school.id, studentProfile.id, science.id, teacher.id, "UT-2", 7, 20, buildPastDate(15), "Critical improvement needed", "High"],
    [school.id, secondStudent.id, math.id, teacher.id, "UT-2", 18, 20, buildPastDate(12), "Excellent", "Low"]
  ];

  for (const row of performanceRows) {
    await query(
      `INSERT INTO performance_records (
        school_id,
        student_id,
        subject_id,
        teacher_user_id,
        exam_type,
        marks_obtained,
        max_marks,
        exam_date,
        remark,
        risk_level
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      row
    );
  }

  const attendanceRows = [
    [school.id, studentProfile.id, teacher.id, buildPastDate(6), "Present"],
    [school.id, studentProfile.id, teacher.id, buildPastDate(5), "Absent"],
    [school.id, studentProfile.id, teacher.id, buildPastDate(4), "Late"],
    [school.id, studentProfile.id, teacher.id, buildPastDate(3), "Absent"],
    [school.id, studentProfile.id, teacher.id, buildPastDate(2), "Present"],
    [school.id, secondStudent.id, teacher.id, buildPastDate(2), "Present"]
  ];

  for (const row of attendanceRows) {
    await query(
      `INSERT INTO attendance_records (
        school_id,
        student_id,
        teacher_user_id,
        date,
        status
      )
      VALUES ($1, $2, $3, $4::date, $5)
      ON CONFLICT (student_id, date)
      DO UPDATE SET
        school_id = EXCLUDED.school_id,
        teacher_user_id = EXCLUDED.teacher_user_id,
        status = EXCLUDED.status`,
      [row[0], row[1], row[2], row[3].toISOString().slice(0, 10), row[4]]
    );
  }

  const timetableRows = [
    [school.id, "Class 10-A", "Monday", 1, "08:00", "08:45", "Mathematics", "Room 101", teacher.id],
    [school.id, "Class 10-A", "Monday", 2, "08:50", "09:35", "Science", "Lab 2", teacher.id],
    [school.id, "Class 10-A", "Tuesday", 1, "08:00", "08:45", "English", "Room 103", teacher.id]
  ];

  for (const row of timetableRows) {
    await query(
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      row
    );
  }

  await query(
    `INSERT INTO notifications (
      school_id,
      recipient_user_id,
      sender_user_id,
      student_id,
      type,
      title,
      message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      school.id,
      parent.id,
      teacher.id,
      studentProfile.id,
      "attendance",
      "Low attendance detected",
      "Rahul has frequent absences in the past week."
    ]
  );

  await query(
    `INSERT INTO notifications (
      school_id,
      recipient_user_id,
      sender_user_id,
      student_id,
      type,
      title,
      message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      school.id,
      studentUser.id,
      teacher.id,
      studentProfile.id,
      "performance",
      "Science performance alert",
      "Science score dropped below 40%."
    ]
  );

  await query(
    `INSERT INTO allowed_schools (school_id, updated_by)
     VALUES ($1, $2), ($3, $2)`,
    [school.id, owner.id, secondSchool.id]
  );

  console.log("Seed complete");
  console.log("School codes: GFPS01, HIS02");
  console.log("Owner: abc123@gmail.com / 34567890");
  console.log("Admin: admin@gfps.edu / Admin@123");
  console.log("Admin (manager): mannatpangotra29@gmail.com / Mannu@2402");
  console.log("Teacher: teacher@gfps.edu / Teacher@123");
  console.log("Student: student@gfps.edu / Student@123");
  console.log("Parent: parent@gfps.edu / Parent@123");

  process.exit(0);
};

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
