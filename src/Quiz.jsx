import { useState, useEffect } from "react";
import Question from "./Question";

function Quiz({ subject, difficulty, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);

  // Fetch questions from the backend API
  useEffect(() => {
    let ignore = false;

    async function loadQuestions() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ subject, difficulty });
        const res = await fetch(`/api/questions?${params.toString()}`);
        const data = await res.json();

        if (!ignore) {
          if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
            setQuestions(data.questions);
          } else {
            setError(
              data.message ||
                `No questions found for ${subject} - ${difficulty}. The admin may need to add questions for this combination.`
            );
          }
        }
      } catch {
        if (!ignore) {
          setError(
            "Could not connect to the quiz server. Please make sure the backend is running."
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadQuestions();
    return () => { ignore = true; };
  }, [subject, difficulty]);

  const handleAnswer = (selectedAnswer) => {
    const current = questions[currentQuestion];
    const isCorrect = selectedAnswer === current.answer;

    let newScore = score;
    if (isCorrect) {
      newScore = score + 1;
      setScore(newScore);
    }

    const answerData = {
      question: current.question,
      selectedAnswer,
      correctAnswer: current.answer,
      isCorrect,
    };

    const updatedAnswers = [...answers, answerData];
    setAnswers(updatedAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      onComplete(newScore, questions.length, updatedAnswers);
    }
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="quiz-container">
        <div className="quiz-loading-state">
          <div className="quiz-spinner"></div>
          <h2>Loading Questions</h2>
          <p>
            Fetching <strong>{subject}</strong> &bull; <strong>{difficulty}</strong> from the database...
          </p>
        </div>
      </div>
    );
  }

  // --- Error / no questions state ---
  if (error || questions.length === 0) {
    return (
      <div className="quiz-container">
        <div className="quiz-error-state">
          <div className="quiz-error-icon">⚠️</div>
          <h2>Questions Not Available</h2>
          <p>{error || `No questions found for ${subject} - ${difficulty}.`}</p>
          <p className="quiz-error-hint">
            Please ask your administrator to add questions for this subject and difficulty.
          </p>
        </div>
      </div>
    );
  }

  const current = questions[currentQuestion];

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <div>
          <h1>{subject}</h1>
          <p>{difficulty}</p>
        </div>

        <span className="counter">
          {currentQuestion + 1} / {questions.length}
        </span>
      </div>

      <Question
        question={current.question}
        options={current.options}
        onAnswer={handleAnswer}
      />
    </div>
  );
}

export default Quiz;