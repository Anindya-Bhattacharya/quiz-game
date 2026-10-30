function Result({
  score,
  total,
  answers,
  onRestart,
  onLogout,
}) {
  const percentage = Math.round((score / total) * 100);

  return (
    <div className="result-container">

      <h1>Quiz Completed!</h1>

      <div className="score">
        {score}

        <span className="score-total">
          {" "}
          / {total}
        </span>
      </div>

      <p className="percentage">
        You scored {percentage}%
      </p>

      <p className="result-message">
        {score === total
          ? "Excellent! Perfect score."
          : score >= total / 2
          ? "Good job! Keep improving."
          : "Keep practicing and try again."}
      </p>

      <div className="answer-review">

        <h2>Answer Review</h2>

        {answers.map((item, index) => {

          const isCorrect =
            item.selectedAnswer === item.correctAnswer;

          return (
            <div
              key={index}
              className={`review-card ${
                isCorrect ? "correct" : "wrong"
              }`}
            >

              <div className="review-header">

                <span>
                  Question {index + 1}
                </span>

                <span className="review-status">
                  {isCorrect
                    ? "✓ Correct"
                    : "✗ Wrong"}
                </span>

              </div>

              <h3>
                {item.question}
              </h3>

              <p>
                <strong>Your answer:</strong>{" "}
                {item.selectedAnswer}
              </p>

              {!isCorrect && (
                <p>
                  <strong>Correct answer:</strong>{" "}
                  {item.correctAnswer}
                </p>
              )}

            </div>
          );
        })}

      </div>

      <div className="result-buttons">

        <button
          className="primary-button"
          onClick={onRestart}
        >
          Try Again
        </button>

        <button
          className="secondary-button"
          onClick={onLogout}
        >
          Logout
        </button>

      </div>

    </div>
  );
}

export default Result;