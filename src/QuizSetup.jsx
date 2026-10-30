import { useState, useEffect } from "react";

function QuizSetup({ studentId, onStart, onLogout }) {
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [difficulties, setDifficulties] = useState(["Easy", "Intermediate", "Advanced"]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState("");

  // Load available subjects from the database
  useEffect(() => {
    let ignore = false;

    async function loadMeta() {
      try {
        const res = await fetch("/api/questions/meta");
        const data = await res.json();
        if (!ignore && data.success) {
          setSubjects(data.subjects || []);
          setDifficulties(data.difficulties || ["Easy", "Intermediate", "Advanced"]);
        }
      } catch {
        if (!ignore) {
          // Fallback subjects if server is unreachable
          setSubjects(["Science", "General Knowledge",]);
          setMetaError("Could not load subjects from server. Showing defaults.");
        }
      } finally {
        if (!ignore) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => { ignore = true; };
  }, []);

  const handleStart = () => {
    if (!subject || !difficulty) {
      alert("Please select a subject and difficulty.");
      return;
    }

    onStart({ subject, difficulty });
  };

  return (
    <div className="setup-container">
      <h1>Quiz Project</h1>

      <p className="welcome">
        Welcome, <strong>{studentId}</strong>
      </p>

      {metaError && (
        <p className="error" style={{ marginBottom: "12px", fontSize: "13px" }}>
          {metaError}
        </p>
      )}

      <div className="form-group">
        <label>Subject</label>

        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={metaLoading}
        >
          <option value="">
            {metaLoading ? "Loading subjects..." : "Select a subject"}
          </option>

          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Difficulty</label>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">Select difficulty</option>

          {difficulties.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <button
        className="primary-button"
        onClick={handleStart}
        disabled={metaLoading}
      >
        Start Quiz
      </button>

      <button
        className="secondary-button"
        onClick={onLogout}
      >
        Logout
      </button>
    </div>
  );
}

export default QuizSetup;