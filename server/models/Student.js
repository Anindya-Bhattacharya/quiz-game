import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  ip: {
    type: String,
    default: "127.0.0.1",
  },
  userAgent: {
    type: String,
    default: "Unknown Browser",
  },
});

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    loginHistory: [loginHistorySchema],
    totalQuizzes: {
      type: Number,
      default: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema);

export default Student;
