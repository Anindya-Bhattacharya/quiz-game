import mongoose from "mongoose";

const answerReviewSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  selectedAnswer: {
    type: String,
    required: true,
  },
  correctAnswer: {
    type: String,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
});

const quizResultSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
    },
    answers: [answerReviewSchema],
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const QuizResult =
  mongoose.models.QuizResult ||
  mongoose.model("QuizResult", quizResultSchema);

export default QuizResult;
