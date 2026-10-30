import { useState } from "react";
import "./App.css";

import Login from "./Login";
import QuizSetup from "./QuizSetup";
import Quiz from "./Quiz";
import Result from "./Result";
import AdminDashboard from "./AdminDashboard";

function App() {
  const [adminToken, setAdminToken] = useState(() => {
    return sessionStorage.getItem("quiz_admin_token") || "";
  });

  const [page, setPage] = useState(() => {
    return sessionStorage.getItem("quiz_admin_token") ? "admin" : "login";
  });

  const [adminUser, setAdminUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("quiz_admin_user")) || null;
    } catch {
      return null;
    }
  });

  const [studentId, setStudentId] = useState("");
  const [homeTab, setHomeTab] = useState("home");
  const [quizSettings, setQuizSettings] = useState({
    subject: "",
    difficulty: "",
  });
  const [quizResult, setQuizResult] = useState({
    score: 0,
    total: 0,
    answers: [],
  });
  const [history, setHistory] = useState([]);
  // -----------------------------
  // STUDENT LOGIN
  // -----------------------------

  const handleLogin = async (id) => {
    setStudentId(id);

    let savedHistory = [];

    try {
      // Record login session and fetch past quizzes from database
      const response = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: id }),
      });

      const data = await response.json();

      if (data.success && data.history) {
        savedHistory = data.history.map((h) => ({
          score: h.score,
          total: h.total,
          answers: h.answers || [],
          subject: h.subject,
          difficulty: h.difficulty,
          percentage: h.percentage,
          date: new Date(h.completedAt).toLocaleString(),
        }));
      }
    } catch (err) {
      console.warn("Backend server offline, falling back to browser storage:", err);
      savedHistory = JSON.parse(
        localStorage.getItem(`quizHistory_${id}`) || "[]"
      );
    }

    setHistory(savedHistory);
    localStorage.setItem(`quizHistory_${id}`, JSON.stringify(savedHistory));

    setHomeTab("home");
    setPage("setup");
  };

  // -----------------------------
  // ADMIN AUTHENTICATION
  // -----------------------------

  const handleAdminLogin = (authData) => {
    setAdminToken(authData.token);
    setAdminUser(authData.admin);
    sessionStorage.setItem("quiz_admin_token", authData.token);
    sessionStorage.setItem("quiz_admin_user", JSON.stringify(authData.admin));
    setPage("admin");
  };

  const handleAdminLogout = () => {
    setAdminToken("");
    setAdminUser(null);
    sessionStorage.removeItem("quiz_admin_token");
    sessionStorage.removeItem("quiz_admin_user");
    setPage("login");
  };

  // -----------------------------
  // START QUIZ
  // -----------------------------

  const handleStartQuiz = (settings) => {
    setQuizSettings(settings);
    setPage("quiz");
  };

  // -----------------------------
  // QUIZ COMPLETE
  // -----------------------------

  const handleQuizComplete = async (score, total, answers) => {
    const percentage = Math.round((score / total) * 100);
    const result = {
      score,
      total,
      answers,
      subject: quizSettings.subject,
      difficulty: quizSettings.difficulty,
      percentage,
      date: new Date().toLocaleString(),
    };

    setQuizResult({
      score,
      total,
      answers,
    });

    // Add the new result to history state and local cache
    const updatedHistory = [...history, result];
    setHistory(updatedHistory);

    localStorage.setItem(
      `quizHistory_${studentId}`,
      JSON.stringify(updatedHistory)
    );

    // Save to database
    try {
      await fetch("/api/student/quiz-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          subject: quizSettings.subject,
          difficulty: quizSettings.difficulty,
          score,
          total,
          percentage,
          answers,
        }),
      });
    } catch (err) {
      console.error("Failed to sync quiz result to database server:", err);
    }

    setPage("result");
  };

  // -----------------------------
  // RESTART QUIZ
  // -----------------------------

  const handleRestart = () => {
    setHomeTab("home");
    setPage("setup");
  };

  // -----------------------------
  // LOGOUT
  // -----------------------------

  const handleLogout = () => {
    setStudentId("");

    setQuizSettings({
      subject: "",
      difficulty: "",
    });

    setQuizResult({
      score: 0,
      total: 0,
      answers: [],
    });

    setHistory([]);
    setHomeTab("home");
    setPage("login");
  };

  // -----------------------------
  // HOME NAVIGATION
  // -----------------------------

  const handleTabChange = (tab) => {
    setHomeTab(tab);
  };

  return (
    <div className="app">
      {/* =========================
          LOGIN (STUDENT OR ADMIN)
          ========================= */}
      {page === "login" && (
        <Login
          onLogin={handleLogin}
          onAdminLogin={handleAdminLogin}
        />
      )}

      {/* =========================
          ADMIN DATABASE DASHBOARD
          ========================= */}
      {page === "admin" && (
        <AdminDashboard
          adminToken={adminToken}
          adminUser={adminUser}
          onLogout={handleAdminLogout}
        />
      )}

      {/* =========================
          HOME / HISTORY / ABOUT
          ========================= */}
      {page === "setup" && (
        <div className="home-container">
          {/* Navigation */}
          <nav className="home-tabs">
            <button
              className={`home-tab ${
                homeTab === "home" ? "active" : ""
              }`}
              onClick={() => handleTabChange("home")}
            >
              Home
            </button>

            <button
              className={`home-tab ${
                homeTab === "history" ? "active" : ""
              }`}
              onClick={() => handleTabChange("history")}
            >
              History
            </button>

            <button
              className={`home-tab ${
                homeTab === "about" ? "active" : ""
              }`}
              onClick={() => handleTabChange("about")}
            >
              About
            </button>
          </nav>

          {/* =========================
              HOME TAB
              ========================= */}
          {homeTab === "home" && (
            <QuizSetup
              studentId={studentId}
              onStart={handleStartQuiz}
              onLogout={handleLogout}
            />
          )}

          {/* =========================
              HISTORY TAB
              ========================= */}
          {homeTab === "history" && (
            <div className="history-section">
              <div className="history-heading">
                <div>
                  <h2>Quiz History</h2>
                  <p>Your previous quiz attempts</p>
                </div>

                <div className="history-count">
                  {history.length}{" "}
                  {history.length === 1 ? "Attempt" : "Attempts"}
                </div>
              </div>

              {history.length === 0 ? (
                <div className="empty-history">
                  <div className="empty-history-icon">✓</div>
                  <h3>No quiz attempts yet</h3>
                  <p>
                    Complete a quiz and your result will appear here.
                  </p>
                </div>
              ) : (
                <div className="history-list">
                  {[...history].reverse().map((quiz, index) => (
                    <div className="history-card" key={index}>
                      <div className="history-card-main">
                        <div>
                          <h3>{quiz.subject}</h3>
                          <p>
                            {quiz.difficulty}
                            <span>&bull;</span>
                            {quiz.date}
                          </p>
                        </div>

                        <div className="history-score">
                          <strong>
                            {quiz.score}/{quiz.total}
                          </strong>
                          <span>{quiz.percentage}%</span>
                        </div>
                      </div>

                      <div className="history-progress">
                        <div
                          className="history-progress-fill"
                          style={{
                            width: `${quiz.percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================
              ABOUT TAB
              ========================= */}
          {homeTab === "about" && (
            <div className="about-section">
              <h2>About Quiz Project</h2>
              <p>
                Quiz Project is an interactive quiz application designed to help
                students test and improve their knowledge.
              </p>
              <p>
                Choose a subject, select a difficulty level, and complete the
                quiz to test your understanding.
              </p>
              <p>
                Your completed quizzes are automatically saved to the central
                database so your instructor and admin can review performance.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =========================
          QUIZ
          ========================= */}
      {page === "quiz" && (
        <Quiz
          subject={quizSettings.subject}
          difficulty={quizSettings.difficulty}
          onComplete={handleQuizComplete}
        />
      )}

      {/* =========================
          RESULT
          ========================= */}
      {page === "result" && (
        <Result
          score={quizResult.score}
          total={quizResult.total}
          answers={quizResult.answers}
          onRestart={handleRestart}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;