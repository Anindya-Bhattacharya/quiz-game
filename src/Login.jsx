import { useState } from "react";

function Login({ onLogin, onAdminLogin }) {
  const [mode, setMode] = useState("student"); // "student" | "admin"
  const [studentId, setStudentId] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStudentSubmit = async (e) => {
    e.preventDefault();

    if (!studentId.trim()) {
      setError("Please enter your Student ID.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await onLogin(studentId.trim());
    } catch (err) {
      setError(err.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();

    if (!adminUsername.trim() || !adminPassword.trim()) {
      setError("Please enter both Admin username and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Invalid credentials. Admin access denied."
        );
      }

      // Successful admin login
      if (onAdminLogin) {
        onAdminLogin(data);
      }
    } catch (err) {
      setError(err.message || "Connection error to database server.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
  };

  return (
    <div className="login-container">
      {/* Portal Mode Switcher */}
      <div className="login-mode-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "student"}
          className={`login-mode-tab ${mode === "student" ? "active" : ""}`}
          onClick={() => switchMode("student")}
        >
          🎓 Student Access
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "admin"}
          className={`login-mode-tab ${mode === "admin" ? "active" : ""}`}
          onClick={() => switchMode("admin")}
        >
          🔒 Admin Database
        </button>
      </div>

      {mode === "student" ? (
        <>
          <h1>Online Quiz Portal</h1>
          <p className="subtitle">Enter your Student ID to begin your quiz</p>

          <form onSubmit={handleStudentSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="studentIdInput">Student ID</label>
              <input
                id="studentIdInput"
                type="text"
                placeholder="e.g. STU-1049 or your name"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>

            {error && <p className="error">{error}</p>}

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Continue to Quiz"}
            </button>
          </form>

          <div className="admin-hint-bar">
            <span>Are you an instructor or admin?</span>
            <button
              type="button"
              className="link-button"
              onClick={() => switchMode("admin")}
            >
              Open Admin Database &rarr;
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="admin-badge">
            <span className="admin-badge-icon">🛡️</span>
            <span>Restricted Database Area</span>
          </div>

          <h1>Admin Portal</h1>
          <p className="subtitle">
            Enter administrator credentials to view all students, quiz history, and results.
          </p>

          <form onSubmit={handleAdminSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="adminUsername">Admin Username</label>
              <input
                id="adminUsername"
                type="text"
                placeholder="e.g. admin"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                autoFocus
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="input-group">
              <label htmlFor="adminPassword">Admin Password</label>
              <div className="password-wrapper">
                <input
                  id="adminPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </div>

            {error && <p className="error">{error}</p>}

            <button
              type="submit"
              className="primary-button admin-submit-btn"
              disabled={loading}
            >
              {loading ? "Authenticating Admin..." : "Unlock Database Records"}
            </button>
          </form>

          <div className="credentials-info-box">
            <strong>Default Credentials:</strong>
            <code>Username: admin | Password: admin123</code>
            <small>(Configurable in .env file)</small>
          </div>

          <div className="admin-hint-bar">
            <button
              type="button"
              className="link-button"
              onClick={() => switchMode("student")}
            >
              &larr; Return to Student Sign-in
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Login;