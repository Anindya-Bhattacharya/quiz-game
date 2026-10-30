import { useState, useEffect } from "react";

function AdminDashboard({ adminToken, adminUser, onLogout }) {
  const [activeTab, setActiveTab] = useState("users"); // "users" | "results"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dbStatus, setDbStatus] = useState({ connected: false, text: "Checking..." });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Data states
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalQuizzes: 0,
    overallAvg: 0,
  });
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);

  // Search & Filter states
  const [studentSearch, setStudentSearch] = useState("");
  const [resultFilterSubject, setResultFilterSubject] = useState("");
  const [resultFilterDifficulty, setResultFilterDifficulty] = useState("");

  // Modals
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [selectedStudentDetailTab, setSelectedStudentDetailTab] = useState("logins"); // "logins" | "quizzes"
  const [selectedQuizReview, setSelectedQuizReview] = useState(null);

  // --- Question Bank state ---
  const [questions, setQuestions] = useState([]);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState("");
  const [qFilterSubject, setQFilterSubject] = useState("");
  const [qFilterDifficulty, setQFilterDifficulty] = useState("");
  const [qSearch, setQSearch] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Question form (add / edit)
  const EMPTY_FORM = {
    subject: "",
    difficulty: "Easy",
    question: "",
    options: ["", "", "", ""],
    answer: "",
  };
  const [qForm, setQForm] = useState(EMPTY_FORM);
  const [qFormError, setQFormError] = useState("");
  const [qFormSaving, setQFormSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null); // null = add mode
  const [showQForm, setShowQForm] = useState(false);

  // Synchronize admin data
  useEffect(() => {
    let ignore = false;

    async function loadAdminData() {
      try {
        const headers = {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        };

        const [overviewRes, studentsRes, resultsRes, statusRes] = await Promise.all([
          fetch("/api/admin/overview", { headers }),
          fetch("/api/admin/students", { headers }),
          fetch("/api/admin/quiz-results", { headers }),
          fetch("/api/status"),
        ]);

        if (overviewRes.status === 401 || overviewRes.status === 403) {
          onLogout();
          return;
        }

        const [overviewData, studentsData, resultsData, statusData] = await Promise.all([
          overviewRes.json(),
          studentsRes.json(),
          resultsRes.json(),
          statusRes.json(),
        ]);

        if (!ignore) {
          if (overviewData.success) {
            setStats(overviewData.stats);
          }
          if (studentsData.success) {
            setStudents(studentsData.students || []);
          }
          if (resultsData.success) {
            setResults(resultsData.results || []);
          }
          if (statusData.database) {
            setDbStatus({
              connected: statusData.isMongoConnected,
              text: statusData.database,
            });
          }
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Admin fetch error:", err);
          setError("Failed to synchronize with backend database. Please ensure server is running.");
          setLoading(false);
        }
      }
    }

    loadAdminData();

    return () => {
      ignore = true;
    };
  }, [adminToken, onLogout, refreshTrigger]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  // --- QUESTION BANK HANDLERS ---

  const loadQuestions = async () => {
    setQLoading(true);
    setQError("");
    try {
      const params = new URLSearchParams();
      if (qFilterSubject) params.set("subject", qFilterSubject);
      if (qFilterDifficulty) params.set("difficulty", qFilterDifficulty);
      if (qSearch.trim()) params.set("search", qSearch.trim());

      const res = await fetch(`/api/admin/questions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      if (data.success) {
        setQuestions(data.questions || []);
      } else {
        setQError(data.message || "Failed to load questions.");
      }

      // Also load available subjects from public metadata endpoint
      const metaRes = await fetch("/api/questions/meta");
      const metaData = await metaRes.json();
      if (metaData.success) {
        setAvailableSubjects(metaData.subjects || []);
      }
    } catch (err) {
      console.error(err);
      setQError("Failed to connect to server. Please ensure the backend is running.");
    } finally {
      setQLoading(false);
    }
  };

  // Call loadQuestions whenever questions tab is activated or filters change
  useEffect(() => {
    if (activeTab === "questions") {
      loadQuestions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, qFilterSubject, qFilterDifficulty]);

  const openAddForm = () => {
    setEditingQuestion(null);
    setQForm({
      subject: availableSubjects[0] || "",
      difficulty: "Easy",
      question: "",
      options: ["", "", "", ""],
      answer: "",
    });
    setQFormError("");
    setShowQForm(true);
  };

  const openEditForm = (q) => {
    setEditingQuestion(q);
    setQForm({
      subject: q.subject,
      difficulty: q.difficulty,
      question: q.question,
      options: [...q.options],
      answer: q.answer,
    });
    setQFormError("");
    setShowQForm(true);
  };

  const closeQForm = () => {
    setShowQForm(false);
    setEditingQuestion(null);
    setQFormError("");
  };

  const handleQFormOptionChange = (index, value) => {
    const updated = [...qForm.options];
    updated[index] = value;
    // If the changed option was the answer, clear the answer
    const newAnswer = qForm.answer === qForm.options[index] ? "" : qForm.answer;
    setQForm((prev) => ({ ...prev, options: updated, answer: newAnswer }));
  };

  const handleAddOption = () => {
    setQForm((prev) => ({ ...prev, options: [...prev.options, ""] }));
  };

  const handleRemoveOption = (index) => {
    if (qForm.options.length <= 2) return;
    const updated = qForm.options.filter((_, i) => i !== index);
    const newAnswer = qForm.answer === qForm.options[index] ? "" : qForm.answer;
    setQForm((prev) => ({ ...prev, options: updated, answer: newAnswer }));
  };

  const handleQFormSave = async () => {
    setQFormError("");

    // Validate
    if (!qForm.subject.trim()) {
      setQFormError("Subject is required.");
      return;
    }
    if (!qForm.question.trim()) {
      setQFormError("Question text is required.");
      return;
    }
    const cleanOptions = qForm.options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setQFormError("At least 2 non-empty answer options are required.");
      return;
    }
    if (!qForm.answer) {
      setQFormError("Please select the correct answer from the options.");
      return;
    }
    if (!cleanOptions.includes(qForm.answer)) {
      setQFormError("The correct answer must match one of the non-empty options.");
      return;
    }

    setQFormSaving(true);
    try {
      const payload = {
        subject: qForm.subject.trim(),
        difficulty: qForm.difficulty,
        question: qForm.question.trim(),
        options: cleanOptions,
        answer: qForm.answer,
      };

      const isEditing = editingQuestion !== null;
      const url = isEditing
        ? `/api/admin/questions/${editingQuestion._id}`
        : "/api/admin/questions";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        closeQForm();
        loadQuestions();
        // Also refresh overview stats (question count)
        handleRefresh();
      } else {
        setQFormError(data.message || "Failed to save question.");
      }
    } catch (err) {
      console.error(err);
      setQFormError("Server error. Please try again.");
    } finally {
      setQFormSaving(false);
    }
  };

  const handleDeleteQuestion = async (qId, qText) => {
    if (!window.confirm(`Delete this question?\n\n"${qText}"\n\nThis cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/questions/${qId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (data.success) {
        loadQuestions();
        handleRefresh();
      } else {
        alert(data.message || "Failed to delete question.");
      }
    } catch (err) {
      console.error(err);
      alert("Server error deleting question.");
    }
  };

  const handleResetDefaults = async () => {
    if (
      !window.confirm(
        "This will REPLACE ALL current questions with the default question set. Are you sure?"
      )
    )
      return;

    try {
      const res = await fetch("/api/admin/questions/reset-defaults", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadQuestions();
        handleRefresh();
      } else {
        alert(data.message || "Failed to reset questions.");
      }
    } catch (err) {
      console.error(err);
      alert("Server error resetting questions.");
    }
  };

  // Open specific student detail modal
  const openStudentModal = async (studentId) => {
    setSelectedStudentDetailTab("logins");
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setSelectedStudentDetail(data);
      } else {
        alert(data.message || "Could not load student profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching student details.");
    }
  };

  // Delete student
  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm(`Are you sure you want to permanently delete student "${studentId}" and all their quiz records?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (data.success) {
        handleRefresh();
        if (selectedStudentDetail?.student?.studentId === studentId) {
          setSelectedStudentDetail(null);
        }
      } else {
        alert(data.message || "Failed to delete student.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting student.");
    }
  };

  // Filter students
  const filteredStudents = students.filter((s) =>
    s.studentId.toLowerCase().includes(studentSearch.trim().toLowerCase())
  );

  // Filter quiz results
  const filteredResults = results.filter((r) => {
    const matchesSearch =
      !studentSearch.trim() ||
      r.studentId.toLowerCase().includes(studentSearch.trim().toLowerCase());
    const matchesSubject =
      !resultFilterSubject || r.subject === resultFilterSubject;
    const matchesDifficulty =
      !resultFilterDifficulty || r.difficulty === resultFilterDifficulty;
    return matchesSearch && matchesSubject && matchesDifficulty;
  });

  return (
    <div className="admin-container">
      {/* Top Header Bar */}
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-brand-icon">🗄️</div>
          <div>
            <h1>Admin Database Management</h1>
            <p className="admin-brand-subtitle">
              Secure Central Repository &bull; Users, Login History & Quiz Results
            </p>
          </div>
        </div>

        <div className="admin-actions">
          <div
            className={`db-status-pill ${
              dbStatus.connected ? "connected" : "fallback"
            }`}
            title="Database Connection State"
          >
            <span className="status-indicator-dot"></span>
            <span>{dbStatus.text}</span>
          </div>

          <div className="admin-user-pill">
            <span>👤 Admin:</span>
            <strong>{adminUser?.username || "Admin"}</strong>
          </div>

          <button
            type="button"
            className="secondary-button compact-btn"
            onClick={handleRefresh}
            title="Refresh Database Records"
          >
            🔄 Refresh
          </button>

          <button
            type="button"
            className="logout-button compact-btn"
            onClick={onLogout}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="admin-alert-banner">
          <span>⚠️ {error}</span>
          <button type="button" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="admin-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon users-icon">👥</div>
          <div className="metric-info">
            <span className="metric-label">Total Registered Users</span>
            <strong className="metric-value">{stats.totalStudents || students.length}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon quizzes-icon">📝</div>
          <div className="metric-info">
            <span className="metric-label">Total Quizzes Taken</span>
            <strong className="metric-value">{stats.totalQuizzes || results.length}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon score-icon">🎯</div>
          <div className="metric-info">
            <span className="metric-label">Overall Class Average</span>
            <strong className="metric-value">{stats.overallAvg || 0}%</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon db-icon">⚡</div>
          <div className="metric-info">
            <span className="metric-label">Backend Engine</span>
            <strong className="metric-value">
              {dbStatus.connected ? "MongoDB Atlas" : "Local Mongoose"}
            </strong>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-nav-tabs">
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          👥 Past Users &amp; Login History ({students.length})
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === "results" ? "active" : ""}`}
          onClick={() => setActiveTab("results")}
        >
          📊 All Quiz Submissions &amp; Results ({results.length})
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === "questions" ? "active" : ""}`}
          onClick={() => setActiveTab("questions")}
        >
          📝 Question Bank Management
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="admin-filter-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by Student ID..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
          {studentSearch && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setStudentSearch("")}
            >
              ✕
            </button>
          )}
        </div>

        {activeTab === "results" && (
          <div className="filter-dropdowns">
            <select
              value={resultFilterSubject}
              onChange={(e) => setResultFilterSubject(e.target.value)}
            >
              <option value="">All Subjects</option>
              <option value="Science">Science</option>
              <option value="History">History</option>
            </select>

            <select
              value={resultFilterDifficulty}
              onChange={(e) => setResultFilterDifficulty(e.target.value)}
            >
              <option value="">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: USERS & LOGIN INFO */}
      {activeTab === "users" && (
        <div className="admin-table-container">
          {loading ? (
            <div className="admin-loading-state">
              <div className="spinner"></div>
              <p>Fetching user database records...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="admin-empty-state">
              <p>No students found matching your criteria.</p>
              <small>When students sign in to take a quiz, their profile and login history will appear here.</small>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>First Joined</th>
                  <th>Last Logged In</th>
                  <th>Total Logins</th>
                  <th>Quizzes Taken</th>
                  <th>Avg. Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.studentId}>
                    <td className="student-id-cell">
                      <strong>{s.studentId}</strong>
                    </td>
                    <td>
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td>
                      {s.lastLogin
                        ? new Date(s.lastLogin).toLocaleString()
                        : "N/A"}
                    </td>
                    <td>
                      <span className="count-badge">
                        {s.loginHistory?.length || 1} logins
                      </span>
                    </td>
                    <td>
                      <span className="count-badge quiz-count">
                        {s.totalQuizzes || 0} quizzes
                      </span>
                    </td>
                    <td>
                      <span
                        className={`score-badge ${
                          s.averageScore >= 80
                            ? "high"
                            : s.averageScore >= 50
                            ? "medium"
                            : "low"
                        }`}
                      >
                        {s.averageScore || 0}%
                      </span>
                    </td>
                    <td>
                      <div className="row-action-buttons">
                        <button
                          type="button"
                          className="view-details-btn"
                          onClick={() => openStudentModal(s.studentId)}
                        >
                          👁️ View History
                        </button>
                        <button
                          type="button"
                          className="delete-row-btn"
                          title="Delete user and all their quiz data"
                          onClick={() => handleDeleteStudent(s.studentId)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: ALL QUIZ SUBMISSIONS & RESULTS */}
      {activeTab === "results" && (
        <div className="admin-table-container">
          {loading ? (
            <div className="admin-loading-state">
              <div className="spinner"></div>
              <p>Fetching quiz result records...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="admin-empty-state">
              <p>No quiz results recorded yet.</p>
              <small>Completed student quizzes will be automatically archived here.</small>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Subject</th>
                  <th>Difficulty</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Date &amp; Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, index) => (
                  <tr key={r._id || index}>
                    <td className="student-id-cell">
                      <button
                        type="button"
                        className="text-link-btn"
                        onClick={() => openStudentModal(r.studentId)}
                      >
                        {r.studentId}
                      </button>
                    </td>
                    <td>
                      <span className="subject-tag">{r.subject}</span>
                    </td>
                    <td>
                      <span className={`diff-tag ${r.difficulty?.toLowerCase()}`}>
                        {r.difficulty}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {r.score} / {r.total}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`score-badge ${
                          r.percentage >= 80
                            ? "high"
                            : r.percentage >= 50
                            ? "medium"
                            : "low"
                        }`}
                      >
                        {r.percentage}%
                      </span>
                    </td>
                    <td>
                      {r.completedAt
                        ? new Date(r.completedAt).toLocaleString()
                        : "N/A"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="view-details-btn compact"
                        onClick={() => setSelectedQuizReview(r)}
                      >
                        📝 Review Answers
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: QUESTION BANK MANAGEMENT */}
      {activeTab === "questions" && (
        <div className="qbank-container">
          {/* Top bar: search / filter / add */}
          <div className="qbank-top-bar">
            <div className="search-box" style={{ maxWidth: "340px" }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search questions..."
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") loadQuestions(); }}
              />
              {qSearch && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => { setQSearch(""); loadQuestions(); }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="filter-dropdowns">
              <select
                value={qFilterSubject}
                onChange={(e) => setQFilterSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={qFilterDifficulty}
                onChange={(e) => setQFilterDifficulty(e.target.value)}
              >
                <option value="">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>

              <button
                type="button"
                className="view-details-btn"
                onClick={loadQuestions}
              >
                🔍 Search
              </button>
            </div>

            <div className="qbank-action-btns">
              <button
                type="button"
                className="primary-button compact-btn"
                onClick={openAddForm}
              >
                ＋ Add Question
              </button>
              <button
                type="button"
                className="secondary-button compact-btn"
                title="Reset to the original set of default questions"
                onClick={handleResetDefaults}
              >
                ↩ Reset Defaults
              </button>
            </div>
          </div>

          {/* Question count label */}
          <div className="qbank-count-row">
            <span>{questions.length} question{questions.length !== 1 ? "s" : ""} found</span>
          </div>

          {/* Table */}
          <div className="admin-table-container">
            {qLoading ? (
              <div className="admin-loading-state">
                <div className="spinner"></div>
                <p>Loading question bank...</p>
              </div>
            ) : qError ? (
              <div className="admin-empty-state">
                <p>⚠️ {qError}</p>
                <button type="button" className="secondary-button" style={{ marginTop: "12px" }} onClick={loadQuestions}>Retry</button>
              </div>
            ) : questions.length === 0 ? (
              <div className="admin-empty-state">
                <p>No questions found for the selected filters.</p>
                <small>Use the <strong>＋ Add Question</strong> button above, or reset to defaults.</small>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject</th>
                    <th>Difficulty</th>
                    <th>Question</th>
                    <th>Options</th>
                    <th>Correct Answer</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, idx) => (
                    <tr key={q._id || idx}>
                      <td style={{ color: "#64748b", fontSize: "13px" }}>{idx + 1}</td>
                      <td><span className="subject-tag">{q.subject}</span></td>
                      <td>
                        <span className={`diff-tag ${q.difficulty?.toLowerCase()}`}>
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="qbank-question-cell">{q.question}</td>
                      <td>
                        <ul className="qbank-options-list">
                          {q.options.map((opt, oi) => (
                            <li key={oi} className={opt === q.answer ? "correct-opt" : ""}>
                              {opt === q.answer ? "✓ " : ""}{opt}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <span className="score-badge high">{q.answer}</span>
                      </td>
                      <td>
                        <div className="row-action-buttons">
                          <button
                            type="button"
                            className="view-details-btn compact"
                            onClick={() => openEditForm(q)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="delete-row-btn"
                            onClick={() => handleDeleteQuestion(q._id, q.question)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* QUESTION FORM MODAL (Add / Edit) */}
      {showQForm && (
        <div className="admin-modal-backdrop" onClick={closeQForm}>
          <div
            className="admin-modal-card large-modal qform-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>{editingQuestion ? "Edit Question" : "Add New Question"}</h2>
                <p className="modal-subtitle">
                  {editingQuestion
                    ? "Update the question text, options, or correct answer."
                    : "Create a new question for the student quiz bank."}
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={closeQForm}>✕</button>
            </div>

            <div className="qform-body">
              <div className="qform-row">
                <div className="qform-field">
                  <label htmlFor="qfSubject">Subject</label>
                  <input
                    id="qfSubject"
                    type="text"
                    list="qfSubjectList"
                    placeholder="e.g. Science, History…"
                    value={qForm.subject}
                    onChange={(e) => setQForm((p) => ({ ...p, subject: e.target.value }))}
                  />
                  <datalist id="qfSubjectList">
                    {availableSubjects.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>

                <div className="qform-field">
                  <label htmlFor="qfDifficulty">Difficulty</label>
                  <select
                    id="qfDifficulty"
                    value={qForm.difficulty}
                    onChange={(e) => setQForm((p) => ({ ...p, difficulty: e.target.value }))}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="qform-field">
                <label htmlFor="qfQuestion">Question Text</label>
                <textarea
                  id="qfQuestion"
                  rows="3"
                  placeholder="Enter the full question text…"
                  value={qForm.question}
                  onChange={(e) => setQForm((p) => ({ ...p, question: e.target.value }))}
                />
              </div>

              <div className="qform-options-section">
                <div className="qform-options-header">
                  <label>Answer Options</label>
                  <button
                    type="button"
                    className="add-option-btn"
                    onClick={handleAddOption}
                    disabled={qForm.options.length >= 6}
                  >
                    ＋ Add Option
                  </button>
                </div>

                {qForm.options.map((opt, idx) => (
                  <div key={idx} className="qform-option-row">
                    <input
                      type="radio"
                      id={`qfAnswer_${idx}`}
                      name="correctAnswer"
                      checked={qForm.answer === opt && opt.trim() !== ""}
                      onChange={() => {
                        if (opt.trim()) setQForm((p) => ({ ...p, answer: opt }));
                      }}
                      title="Mark as correct answer"
                    />
                    <label htmlFor={`qfAnswer_${idx}`} className="radio-correct-label">
                      {qForm.answer === opt && opt.trim() ? "✓" : "○"}
                    </label>
                    <input
                      type="text"
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => handleQFormOptionChange(idx, e.target.value)}
                      className={qForm.answer === opt && opt.trim() ? "option-input is-answer" : "option-input"}
                    />
                    <button
                      type="button"
                      className="remove-option-btn"
                      onClick={() => handleRemoveOption(idx)}
                      disabled={qForm.options.length <= 2}
                      title="Remove option"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <p className="qform-hint">
                  Click the circle (○) to the left of an option to mark it as the correct answer.
                </p>
              </div>

              {qFormError && (
                <p className="qform-error">{qFormError}</p>
              )}
            </div>

            <div className="modal-footer" style={{ gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={closeQForm}
                disabled={qFormSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleQFormSave}
                disabled={qFormSaving}
              >
                {qFormSaving
                  ? "Saving..."
                  : editingQuestion
                  ? "Save Changes"
                  : "Add Question"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: STUDENT FULL DETAILS (LOGINS & QUIZZES) */}
      {selectedStudentDetail && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelectedStudentDetail(null)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Student Profile: {selectedStudentDetail.student.studentId}</h2>
                <p className="modal-subtitle">
                  Joined:{" "}
                  {new Date(
                    selectedStudentDetail.student.createdAt ||
                      selectedStudentDetail.student.lastLogin
                  ).toLocaleDateString()}
                  &nbsp;&bull;&nbsp; Last Login:{" "}
                  {new Date(
                    selectedStudentDetail.student.lastLogin
                  ).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedStudentDetail(null)}
              >
                ✕
              </button>
            </div>

            {/* Quick Stats in Modal */}
            <div className="modal-stats-row">
              <div className="modal-stat-pill">
                <span>Total Logins:</span>
                <strong>
                  {selectedStudentDetail.student.loginHistory?.length || 1}
                </strong>
              </div>
              <div className="modal-stat-pill">
                <span>Quizzes Taken:</span>
                <strong>{selectedStudentDetail.quizzes?.length || 0}</strong>
              </div>
              <div className="modal-stat-pill">
                <span>Average Score:</span>
                <strong>
                  {selectedStudentDetail.student.averageScore || 0}%
                </strong>
              </div>
            </div>

            {/* Sub-tab Switcher */}
            <div className="modal-tabs">
              <button
                type="button"
                className={`modal-tab ${
                  selectedStudentDetailTab === "logins" ? "active" : ""
                }`}
                onClick={() => setSelectedStudentDetailTab("logins")}
              >
                🕒 Log-In History (
                {selectedStudentDetail.student.loginHistory?.length || 1})
              </button>
              <button
                type="button"
                className={`modal-tab ${
                  selectedStudentDetailTab === "quizzes" ? "active" : ""
                }`}
                onClick={() => setSelectedStudentDetailTab("quizzes")}
              >
                📚 Quiz History ({selectedStudentDetail.quizzes?.length || 0})
              </button>
            </div>

            <div className="modal-tab-content">
              {/* Logins tab */}
              {selectedStudentDetailTab === "logins" && (
                <div className="login-history-list">
                  {selectedStudentDetail.student.loginHistory &&
                  selectedStudentDetail.student.loginHistory.length > 0 ? (
                    [...selectedStudentDetail.student.loginHistory]
                      .reverse()
                      .map((item, idx) => (
                        <div key={idx} className="login-entry-item">
                          <div className="login-entry-badge">
                            🔑 Session #{selectedStudentDetail.student.loginHistory.length - idx}
                          </div>
                          <div className="login-entry-details">
                            <div className="login-entry-time">
                              {new Date(item.timestamp).toLocaleString()}
                            </div>
                            <div className="login-entry-meta">
                              <span>IP: {item.ip || "127.0.0.1"}</span>
                              <span>&bull;</span>
                              <span title={item.userAgent}>
                                Browser: {item.userAgent ? item.userAgent.split(" ")[0] : "Browser"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="no-data-notice">No session logs available.</p>
                  )}
                </div>
              )}

              {/* Quizzes tab */}
              {selectedStudentDetailTab === "quizzes" && (
                <div className="student-quiz-list">
                  {selectedStudentDetail.quizzes &&
                  selectedStudentDetail.quizzes.length > 0 ? (
                    selectedStudentDetail.quizzes.map((quiz, idx) => (
                      <div key={quiz._id || idx} className="student-quiz-card">
                        <div className="student-quiz-card-head">
                          <div>
                            <h4>
                              {quiz.subject} &bull; {quiz.difficulty}
                            </h4>
                            <small>
                              {new Date(quiz.completedAt).toLocaleString()}
                            </small>
                          </div>
                          <div className="student-quiz-score-badge">
                            <strong>
                              {quiz.score}/{quiz.total}
                            </strong>
                            <span>({quiz.percentage}%)</span>
                          </div>
                        </div>

                        {quiz.answers && quiz.answers.length > 0 && (
                          <button
                            type="button"
                            className="review-answers-toggle-btn"
                            onClick={() => setSelectedQuizReview(quiz)}
                          >
                            👁️ View Questions &amp; Selected Answers &rarr;
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="no-data-notice">
                      This student has not completed any quizzes yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedStudentDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAILED ANSWER REVIEW MODAL */}
      {selectedQuizReview && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelectedQuizReview(null)}
        >
          <div
            className="admin-modal-card large-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Quiz Review &bull; {selectedQuizReview.studentId}
                </h2>
                <p className="modal-subtitle">
                  {selectedQuizReview.subject} ({selectedQuizReview.difficulty}) &bull;{" "}
                  {new Date(selectedQuizReview.completedAt).toLocaleString()} &bull;{" "}
                  Final Score: <strong>{selectedQuizReview.score}/{selectedQuizReview.total} ({selectedQuizReview.percentage}%)</strong>
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedQuizReview(null)}
              >
                ✕
              </button>
            </div>

            <div className="review-cards-container">
              {selectedQuizReview.answers && selectedQuizReview.answers.length > 0 ? (
                selectedQuizReview.answers.map((ans, idx) => {
                  const isCorrect =
                    ans.isCorrect !== undefined
                      ? ans.isCorrect
                      : ans.selectedAnswer === ans.correctAnswer;

                  return (
                    <div
                      key={idx}
                      className={`admin-review-card ${
                        isCorrect ? "correct-card" : "wrong-card"
                      }`}
                    >
                      <div className="review-card-top">
                        <span className="q-number">Question {idx + 1}</span>
                        <span
                          className={`verdict-pill ${
                            isCorrect ? "correct" : "wrong"
                          }`}
                        >
                          {isCorrect ? "✓ Correct (+1)" : "✗ Incorrect (0)"}
                        </span>
                      </div>
                      <h4 className="q-text">{ans.question}</h4>
                      <div className="q-answers-grid">
                        <div
                          className={`user-ans-box ${
                            isCorrect ? "box-correct" : "box-wrong"
                          }`}
                        >
                          <span>Student's Choice:</span>
                          <strong>{ans.selectedAnswer || "(No answer selected)"}</strong>
                        </div>
                        {!isCorrect && (
                          <div className="correct-ans-box">
                            <span>Expected Answer:</span>
                            <strong>{ans.correctAnswer}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="no-data-notice">No detailed question responses stored for this quiz attempt.</p>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="primary-button"
                onClick={() => setSelectedQuizReview(null)}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
