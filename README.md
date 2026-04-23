# Real-Time Student Progress Tracking (SPT)

Refined full-stack project for role-based student performance tracking with realtime updates.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express + Socket.io
- Database: MongoDB + Mongoose
- Auth: JWT + bcrypt
- ML integration: Python service via `/api/ml/predict` (with backend heuristic fallback)

## Implemented Roles
- Owner
- Admin (school-level)
- Teacher
- Student
- Parent

## Core Features (Refined)
- JWT login, signup, forgot-password, reset-password
- Role-protected dashboards
- Owner school allowlist control
- Only owner-allowed schools can register/login with school code
- Owner sees all schools + account breakdown
- Admin is restricted to one school (`schoolId`) and manages only that school's users/students/subjects/analytics
- Teacher marks, attendance, and timetable management
- Student and parent analytics views with charts
- Real-time dashboard refresh using Socket.io
- AI chat assistant (`/api/ai/chat`) for teacher/student
- PDF report download for student and parent
- Notification storage and realtime notification events
- Rate limiting, Helmet, Morgan logging, validation middleware

## Timetable Flow
- Teacher sets weekly slots in `Time table` page via `/api/teacher/timetable` APIs.
- Student reads class timetable from `/api/student/timetable`.
- Timetable updates are pushed in realtime (`timetable:updated`) to connected dashboards.

## Local Setup (VS Code)

### 1. Start MongoDB
Use local MongoDB (default expected URI in `.env.example`):
- `mongodb://127.0.0.1:27017/spt_db`

### 2. Backend
```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run seed
npm run dev
```
Backend runs on `http://localhost:5000`.

### 3. Frontend
```powershell
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.

## Demo Accounts (Quick Login)
- Owner (manual login only): `abc123@gmail.com` / `34567890`
- Admin: `admin@gfps.edu` / `Admin@123`
- Admin (manager): `mannatpangotra29@gmail.com` / `Mannu@2402`
- Teacher: `teacher@gfps.edu` / `Teacher@123`
- Student: `student@gfps.edu` / `Student@123`
- Parent: `parent@gfps.edu` / `Parent@123`

Seed school code for signup: `GFPS01`

## Accessing the Database

### MongoDB Compass
1. Open MongoDB Compass.
2. Connect to `mongodb://127.0.0.1:27017`.
3. Open database `spt_db`.

### Mongo Shell
```powershell
mongosh
use spt_db
show collections
```

## Notes
- Realtime events are emitted through Socket.io rooms by school/student/user.
- If Python ML service is down, backend falls back to heuristic risk prediction automatically.
- Owner can allow/remove schools from `Owner Dashboard`; blocked schools cannot log in or sign up.
