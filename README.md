# Quiz App 🧠

A full-stack, comprehensive quiz platform built with the MERN stack (MongoDB, Express, React, Node.js). 

This platform allows **admins** to create, organize, and manage quizzes, while **students** can sign up, take timed quizzes, and view detailed analytics on their performance.

## ✨ Features

### Student Experience
- **Authentication:** Secure signup and login system for students.
- **Categorized Browsing:** Browse quizzes easily through a horizontally-scrolling tab system filtered by folders (e.g., "JEE Mains", "PYQs", "ALL").
- **Real-Time Quiz Taking:** 
  - Live countdown timer with auto-submit functionality when time expires.
  - Clean, distraction-free UI to focus on questions.
- **Results & Analytics:** 
  - Instant scoring immediately after submission.
  - Review mode to see which answers were correct vs. incorrect.
  - Comprehensive student dashboard tracking historical attempts and performance.
- **Negative Marking Support:** Quizzes indicate if they penalize incorrect answers.

### Admin Experience
- **Secure Admin Portal:** Separate login system exclusively for administrators.
- **Quiz Management:** Complete CRUD capabilities to create, edit, publish/draft, and delete quizzes.
- **Advanced Scoring:** Ability to assign custom negative marking penalties for incorrect answers.
- **Folder Organization:** 
  - Tag quizzes with multiple folders (many-to-many relationship).
  - Create new folders inline while building a quiz.
  - Dedicated "Manage Folders" view.
- **Analytics Dashboard:** Platform-wide metrics showing student engagement, average scores, and per-quiz attempt statistics.

---

## 🏗️ Architecture

This project is built using modern web development practices:

- **Frontend:** React (Vite) + Tailwind CSS + Lucide Icons.
- **Backend:** Node.js + Express.js REST API.
- **Database:** MongoDB Atlas (Mongoose ODM).
- **Authentication:** JWT (JSON Web Tokens) with bcrypt password hashing.

### Deployment Structure

- **Frontend:** Hosted on Vercel.
- **Backend:** Hosted on Render.
- **Database:** Hosted on MongoDB Atlas.

---

## 🚀 Local Development

To run this project locally on your machine:

### 1. Clone the repository
```bash
git clone https://github.com/nasarwaljatin/QuizApp.git
cd QuizApp
```

### 2. Setup the Backend
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory with the following:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:5173
```
Start the backend server:
```bash
npm run dev
```

### 3. Setup the Frontend
Open a new terminal window:
```bash
cd client
npm install
```
Create a `.env` file in the `client` directory:
```env
VITE_API_URL=http://localhost:5000/api
```
Start the frontend development server:
```bash
npm run dev
```

### 4. Admin Access
By default, the system requires a seeded admin account to access the admin portal. You can manually create an admin user in your MongoDB database by setting the `role` field to `admin`.

---

## 📝 License
This project is open-source and available under the MIT License.
