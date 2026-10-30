import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["Easy", "Intermediate", "Advanced"],
      index: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: [
        (arr) => arr && arr.length >= 2,
        "A question must have at least 2 options.",
      ],
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Question =
  mongoose.models.Question || mongoose.model("Question", questionSchema);

export default Question;
