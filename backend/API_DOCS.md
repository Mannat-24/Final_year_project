# SPT API Documentation

Base URL: `http://localhost:5000/api`

## Authentication
- JWT is returned from `/auth/login` and `/auth/register`.
- Send token in header: `Authorization: Bearer <token>`.
- Roles: `owner`, `admin`, `teacher`, `student`, `parent`.

## Database
- PostgreSQL with UUID primary keys.
- Schema file: `backend/sql/postgres_schema.sql`.

## Multi-School Isolation
- Every non-owner user has `schoolId`.
- Protected endpoints filter by `req.user.schoolId`.
- Cross-school access is rejected.

## Auth Endpoints
### `POST /auth/register`
Registers a user under a school code.

### `POST /auth/login`
Returns `{ token, user }`.

### `POST /auth/forgot-password`
Generates reset token (demo flow).

### `POST /auth/reset-password`
Resets password using reset token.

### `GET /auth/me`
Returns authenticated user profile.

## Owner Endpoints (`owner` only)
### `GET /owner/schools`
List all schools with allowlist/account summary.

### `POST /owner/schools`
Create school (optional immediate allowlist).

### `POST /owner/schools/:schoolId/allow`
Allow school login/signup.

### `DELETE /owner/schools/:schoolId/allow`
Remove school from allowlist.

## Admin Endpoints (`admin` only)
### `GET /admin/school`
Admin school profile + role counts.

### `POST /admin/users`
Create teacher/parent/admin/student user in current school.

### `GET /admin/users?role=teacher&page=1&limit=20`
List school users (paginated).

### `POST /admin/students`
Create student profile.

### `GET /admin/students?page=1&limit=20&grade=10`
List student profiles (paginated).

### `GET /admin/student-classes`
List grade-section groups.

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
- class-wise attendance table

## Teacher Endpoints (`teacher` only)
### `GET /teacher/dashboard`
Teacher summary and latest activity.

### `GET /teacher/reference`
Students + subjects for entry forms.

### `GET /teacher/performance`
Paginated performance records.

### `GET /teacher/attendance`
Paginated attendance records.

### `GET /teacher/timetable`
Class timetable view.

### `GET /teacher/extracurricular`
Paginated extracurricular records.

### `POST /teacher/performance`
Create or update marks (uses `recordId` for update).

### `POST /teacher/attendance`
Upsert attendance by date.

### `POST /teacher/timetable/slot`
Upsert timetable slot.

### `DELETE /teacher/timetable/slot`
Delete timetable slot.

### `POST /teacher/extracurricular`
Create or update extracurricular record (uses `recordId` for update).

## Student Endpoints (`student` only)
### `GET /student/dashboard`
Metrics, trends, insights, recent performance/attendance, notifications.

### `GET /student/performance?page=1&limit=20`
Paginated marks.

### `GET /student/attendance?page=1&limit=20`
Paginated attendance.

### `GET /student/timetable`
Weekly timetable for student class.

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

### `GET /ml/predict/student/:studentId`
Predict risk from stored student data (`admin`/`teacher`).

## AI Endpoints
### `POST /ai/chat`
AI assistant response with context-aware insight payload.

## Real-Time Events (Socket.io)
Client connects with auth payload:
```json
{
  "userId": "<UUID>",
  "schoolId": "<UUID>",
  "studentId": "<UUID optional>"
}
```

Broadcast events:
- `performance:updated`
- `attendance:updated`
- `notification:new`
- `timetable:updated`
- `extracurricular:updated`

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
