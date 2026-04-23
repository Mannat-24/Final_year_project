# SPT API Documentation

Base URL: `http://localhost:5000/api`

## Authentication
- JWT is returned from `/auth/login` and `/auth/register`.
- Send token in header: `Authorization: Bearer <token>`.
- Roles: `admin`, `teacher`, `student`, `parent`.

## Multi-School Isolation
- Every user has `schoolId`.
- Protected endpoints always filter by `req.user.schoolId`.
- Cross-school access is rejected.

## Auth Endpoints
### `POST /auth/register`
Registers a user under a school code.
```json
{
  "fullName": "Rahul Verma",
  "email": "student@gfps.edu",
  "password": "Student@123",
  "role": "student",
  "schoolCode": "GFPS01",
  "admissionNumber": "GFPS-1001",
  "grade": "10",
  "section": "A"
}
```

### `POST /auth/login`
```json
{
  "email": "teacher@gfps.edu",
  "password": "Teacher@123"
}
```

### `GET /auth/me`
Returns authenticated user profile.

## Admin Endpoints (`admin` only)
### `POST /admin/schools`
Create a school.

### `GET /admin/schools?page=1&limit=20`
List schools (paginated).

### `POST /admin/users`
Create teacher/parent/admin/student in current school.

### `GET /admin/users?role=teacher&page=1&limit=20`
List school users (paginated).

### `POST /admin/students`
Create student profile.

### `GET /admin/students?page=1&limit=20&grade=10`
List student profiles (paginated).

### `POST /admin/subjects`
Create subject.

### `GET /admin/subjects`
List subjects.

### `GET /admin/analytics`
School-wide analytics:
- average marks by subject
- attendance percentage
- monthly performance trend
- role distribution

## Teacher Endpoints (`teacher` only)
### `GET /teacher/dashboard`
Teacher summary and latest activity.

### `GET /teacher/reference`
Students + subjects for entry forms.

### `POST /teacher/performance`
Create or update marks.
```json
{
  "studentId": "<ObjectId>",
  "subjectId": "<ObjectId>",
  "examType": "UT-2",
  "marksObtained": 13,
  "maxMarks": 20,
  "examDate": "2026-03-20T00:00:00.000Z",
  "remark": "Needs more revision"
}
```

### `POST /teacher/attendance`
Upsert attendance by date.
```json
{
  "studentId": "<ObjectId>",
  "date": "2026-03-26T00:00:00.000Z",
  "status": "Absent",
  "remark": "Medical leave"
}
```

### `GET /teacher/performance?page=1&limit=20&studentId=<id>`
Paginated marks records.

### `GET /teacher/attendance?page=1&limit=20&studentId=<id>`
Paginated attendance records.

## Student Endpoints (`student` only)
### `GET /student/dashboard`
Returns metrics, trends, insights, recent performance and attendance.

### `GET /student/performance?page=1&limit=20`
Paginated marks.

### `GET /student/attendance?page=1&limit=20`
Paginated attendance.

### `GET /student/report`
Downloads PDF report card.

## Parent Endpoints (`parent` only)
### `GET /parent/dashboard`
All child summaries + notifications.

### `GET /parent/children/:studentId`
Detailed progress for one child.

### `GET /parent/children/:studentId/report`
Downloads child report PDF.

## Notifications (All Authenticated Roles)
### `GET /notifications?page=1&limit=20`
List notifications + unread count.

### `PATCH /notifications/:notificationId/read`
Mark one notification as read.

### `PATCH /notifications/read-all`
Mark all notifications as read.

## ML Endpoints
### `POST /ml/predict`
Manual risk prediction.
```json
{
  "marks": 58,
  "attendance": 72,
  "pastPerformance": 61
}
```

### `GET /ml/predict/student/:studentId`
Predict risk from stored student data (`admin`/`teacher`).

## Real-Time Events (Socket.io)
Client connects with auth payload:
```json
{
  "userId": "<ObjectId>",
  "schoolId": "<ObjectId>",
  "studentId": "<ObjectId optional>"
}
```

Broadcast events:
- `performance:updated`
- `attendance:updated`
- `notification:new`

Rooms:
- `school:<schoolId>`
- `student:<studentId>`
- `user:<userId>`

## Error Format
```json
{
  "message": "Validation failed",
  "errors": [
    { "field": "email", "msg": "A valid email is required" }
  ]
}
```