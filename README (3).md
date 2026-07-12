# Quiz App 📝

A full-stack quiz platform where an **admin** creates and manages quizzes, and **students** sign up, take quizzes with a live timer (with auto-submit), and view their score, correct answers, and full attempt history — all inside one deployed website.

---

## ✨ Features

### Student-facing
- **Signup** — Full name, email, phone number, and password.
- **Login** — Email **or** phone number + password, with an additional **"Login with OTP"** option (OTP sent to email or phone, no password needed).
- **Browse Quizzes** — See all quizzes the admin has published.
- **Take Quiz** — Google Forms–like UI, with:
  - **Timer** per quiz, with **auto-submit** when time runs out.
  - **Shuffled questions and options** on every attempt.
- **Instant Results** — Score shown immediately after submission.
- **Answer Review** — See each question, the correct answer, and what they answered.
- **Student Dashboard** — History of all previous attempts, with detailed per-attempt analysis (score trends, time taken, weak topics, etc.).

### Admin-facing
- **Separate Admin Login** — Fixed, confidential credentials. **No public admin signup** — there is only ever one admin account, seeded directly in the database / via environment variables.
- **Quiz Management (CRUD)** — Create, edit, and delete quizzes and their questions.
- **Admin Dashboard** — Analytics across all students and quizzes: attempt counts, average scores, question-level difficulty (e.g. which questions are most-missed), per-quiz performance trends.

---

## 🏗️ Architecture

```
┌─────────────┐        HTTPS/API calls        ┌──────────────┐        ┌──────────────┐
│   Frontend  │  ───────────────────────────▶ │   Backend    │ ─────▶ │   Database   │
│   (React)   │ ◀─────────────────────────── │ (Node/Express)│ ◀───── │  (MongoDB)   │
│  on Vercel  │        JSON + JWT auth         │  on Render   │        │  Atlas (free)│
└─────────────┘                                └──────────────┘        └──────────────┘
```

- **Frontend:** React, deployed on **Vercel** (free tier).
- **Backend:** Node.js + Express REST API, deployed on **Render** (free tier).
- **Database:** **MongoDB Atlas** (free M0 cluster) — good fit for quiz/question documents and flexible schemas.
  - *Alternative:* PostgreSQL via Render's free tier or Supabase, if you'd rather work with relational data. MongoDB is recommended here since quiz structures (nested questions/options) map naturally to documents.
- **Auth:** JWT-based sessions. Passwords hashed with bcrypt.

> ⚠️ Free-tier note: Render's free web services spin down after inactivity and take ~30–60s to "wake up" on the next request. Fine for a personal/college project, worth knowing so it doesn't look broken on first load.

---

## 👥 User Roles

| Role | Signup | Login | Capabilities |
|------|--------|-------|--------------|
| **Student** | Public signup form | Own email/password | Take quizzes, view own results & history |
| **Admin** | ❌ No signup route — single seeded account | Separate `/admin/login` page | Create/edit/delete quizzes, view analytics across all students |

- Admin credentials are stored as environment variables (or a one-time seed script) on the backend — never exposed in frontend code or committed to git.
- Backend routes are protected by role-based middleware: student routes check for a valid student JWT; admin routes check for a valid **admin** JWT specifically, so a student token can never access admin endpoints even if guessed.

---

## 🔐 Authentication

**Signup**
- Fields: full name, email, phone number, password.
- Password is hashed (bcrypt) before storing; email and phone number are both unique.

**Login — two modes:**

1. **Password login** — Student enters email *or* phone number + password → backend verifies against `passwordHash` → issues JWT.
2. **OTP login** — Student enters email or phone number → backend generates a random OTP, hashes it, stores it with a short expiry (e.g. 5–10 min) on the user doc, and sends it via email/SMS → student enters the OTP → backend verifies (and checks expiry) → issues JWT on success.

**OTP delivery (needs a free provider):**
- **Email OTP:** a free-tier transactional email service (e.g. Brevo, Resend, or Gmail SMTP for low volume) — simplest to set up for a project like this.
- **SMS OTP:** free tiers are more limited (e.g. Twilio trial credits) — if SMS costs/limits become a blocker, email OTP alone is a reasonable starting point, with phone number kept just as a login identifier for password-based login.

**Suggested endpoints:**
- `POST /auth/signup`
- `POST /auth/login` — password-based
- `POST /auth/otp/request` — sends OTP to email or phone
- `POST /auth/otp/verify` — verifies OTP, returns JWT

---

## 🗄️ Database Schema (Planned)

**`User`**
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string (unique)",
  "phoneNumber": "string (unique)",
  "passwordHash": "string",
  "role": "student",
  "otp": {
    "code": "string (hashed, temporary)",
    "expiresAt": "date"
  },
  "createdAt": "date"
}
```
> `otp` is only populated temporarily when a login-with-OTP request is made, and cleared/expired after use or timeout (e.g. 5–10 minutes).

**`Quiz`**
```json
{
  "_id": "ObjectId",
  "title": "string",
  "durationMinutes": "number",
  "createdBy": "adminId",
  "questions": [
    {
      "questionText": "string",
      "options": ["string"],
      "correctAnswer": "string"
    }
  ],
  "createdAt": "date",
  "updatedAt": "date"
}
```

**`Attempt`** (one per student per quiz-taking session)
```json
{
  "_id": "ObjectId",
  "studentId": "ObjectId",
  "quizId": "ObjectId",
  "answers": [
    { "questionText": "string", "selectedAnswer": "string", "correctAnswer": "string", "isCorrect": "boolean" }
  ],
  "score": "number",
  "totalQuestions": "number",
  "timeTakenSeconds": "number",
  "submittedAt": "date",
  "autoSubmitted": "boolean"
}
```

This `Attempt` collection powers both the **student's history/dashboard** and the **admin's analytics** — queried per-student for personal history, and aggregated across students per-quiz for admin insights.

---

## 🧩 Core Flow

**Student:**
1. Sign up / log in.
2. Browse available quizzes on the home/dashboard page.
3. Open a quiz → questions & options load shuffled → timer starts.
4. Submit manually, or get auto-submitted when time runs out.
5. See score + correct-answer review immediately.
6. Result is saved as an `Attempt` — visible later in their **Dashboard → History**.

**Admin:**
1. Log in via the separate admin login page (not linked from student signup).
2. Create/edit/delete quizzes from the admin panel.
3. View the **Admin Dashboard** — overall analytics: attempts per quiz, average scores, most-missed questions, student performance trends.

---

## ⏱️ Timer & Auto-Submit Logic

- Timer duration comes from the quiz document (`durationMinutes`), fetched from the backend when the quiz loads.
- A `useTimer` hook manages the countdown client-side and exposes `timeLeft` and `isTimeUp`.
- When `isTimeUp` is `true`, the same submit function used for manual submission is triggered, and the attempt is flagged `autoSubmitted: true` — useful for admin analytics later (e.g. how many students run out of time).

## 🔀 Shuffle Logic

- Questions and their options are shuffled **client-side, once per attempt** (e.g. via a Fisher–Yates shuffle), after fetching the quiz from the backend.
- Scoring always compares against the stored `correctAnswer` **value**, not its position, so shuffling never breaks correctness checks.

---

## 🛠️ Tech Stack Summary

| Layer | Choice |
|-------|--------|
| Frontend | React (deployed on Vercel) |
| Backend | Node.js + Express (deployed on Render) |
| Database | MongoDB Atlas (free tier) |
| Auth | JWT + bcrypt |
| Styling | *(to be decided — Tailwind CSS recommended)* |

---

## 📂 Planned Project Structure

```
quiz-app/
├── client/                     # React frontend (deployed to Vercel)
│   ├── src/
│   │   ├── components/
│   │   │   ├── QuizForm.jsx
│   │   │   ├── Timer.jsx
│   │   │   ├── ResultSummary.jsx
│   │   │   └── QuestionItem.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx / Signup.jsx
│   │   │   ├── QuizPage.jsx
│   │   │   ├── ResultPage.jsx
│   │   │   ├── StudentDashboard.jsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminLogin.jsx
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   └── ManageQuizzes.jsx
│   │   ├── hooks/
│   │   │   └── useTimer.js
│   │   └── App.jsx
│   └── package.json
│
├── server/                      # Node/Express backend (deployed to Render)
│   ├── models/
│   │   ├── User.js
│   │   ├── Quiz.js
│   │   └── Attempt.js
│   ├── routes/
│   │   ├── auth.js              # student signup, password login, OTP request/verify
│   │   ├── adminAuth.js         # admin login only (no signup)
│   │   ├── quizzes.js           # CRUD (admin) + fetch (student)
│   │   └── attempts.js          # submit + fetch history
│   ├── middleware/
│   │   ├── verifyStudent.js
│   │   └── verifyAdmin.js
│   ├── seed/
│   │   └── seedAdmin.js         # one-time script to create the single admin account
│   ├── server.js
│   └── package.json
│
└── README.md
```

---

## 🚀 Deployment Plan

1. **Database:** Create a free MongoDB Atlas cluster, whitelist Render's IP (or allow all for simplicity during dev), get the connection string.
2. **Backend (Render):** Deploy `server/` as a Web Service. Add environment variables:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (or run the seed script once after first deploy)
   - `EMAIL_PROVIDER_API_KEY` (and/or `SMS_PROVIDER_API_KEY`) for sending OTPs
3. **Frontend (Vercel):** Deploy `client/` as a static/React project. Add an environment variable pointing to the deployed Render backend URL (e.g. `VITE_API_URL` or `REACT_APP_API_URL`).
4. **CORS:** Configure the backend to only accept requests from your Vercel domain.
5. Test the full flow live: student signup → take quiz → auto-submit → dashboard, and admin login → create quiz → view analytics.

---

## 🚧 Roadmap

- [ ] Set up backend (Express + MongoDB connection)
- [ ] Build `User` model + student signup (name, email, phone, password) and password login (JWT)
- [ ] Integrate an email/SMS provider and build OTP request + verify endpoints
- [ ] Seed the single admin account (no public signup route)
- [ ] Build admin-only quiz CRUD endpoints + middleware
- [ ] Build quiz-taking flow (fetch, shuffle, timer, auto-submit)
- [ ] Build `Attempt` model + submit-attempt endpoint
- [ ] Build student dashboard (attempt history + per-attempt analysis)
- [ ] Build admin dashboard (cross-student analytics)
- [ ] Deploy backend to Render, frontend to Vercel
- [ ] Connect frontend to deployed backend via env variable
- [ ] End-to-end test on the live deployed site

---

## 📌 Notes

This README will evolve as the app is built. Update the **Roadmap** section as progress is made, and the **Database Schema** section if models change.
