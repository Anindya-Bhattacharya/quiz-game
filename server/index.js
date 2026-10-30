import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Student from "./models/Student.js";
import QuizResult from "./models/QuizResult.js";
import Question from "./models/Question.js";
import { defaultQuestions } from "./seedQuestions.js";
import { authenticateAdmin, generateAdminToken } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/quiz_project";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

let isMongoConnected = false;

// Middleware
app.use(cors());
app.use(express.json());

// In-Memory fallback store when MongoDB is not yet running / configured
const fallbackStore = {
  students: new Map(),
  quizResults: [],
  questions: defaultQuestions.map((q, idx) => ({
    ...q,
    _id: "q_" + (idx + 1),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
};

// Seed default questions if MongoDB collection is empty
async function seedDatabaseIfEmpty() {
  try {
    const count = await Question.countDocuments();
    if (count === 0) {
      await Question.insertMany(defaultQuestions);
      console.log(
        `[Database Seed] Successfully seeded ${defaultQuestions.length} default questions into MongoDB.`
      );
    }
  } catch (err) {
    console.error("Error seeding default questions:", err.message);
  }
}

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
    });
    isMongoConnected = true;
    console.log(
      `[Database] Successfully connected to MongoDB at ${mongoose.connection.host}`
    );
    await seedDatabaseIfEmpty();
  } catch (error) {
    isMongoConnected = false;
    console.warn(
      `[Database Notice] Could not connect to MongoDB (${error.message}).`
    );
    console.warn(
      `[Database Notice] Running with in-memory persistence fallback. Configure MONGODB_URI in .env to connect your MongoDB Atlas or local instance.`
    );
  }
}

connectToDatabase();

// ----------------------------------------------------
// SYSTEM / HEALTH STATUS ENDPOINT
// ----------------------------------------------------
app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    database: isMongoConnected
      ? "MongoDB Connected"
      : "Local In-Memory Mode (Set MONGODB_URI in .env)",
    isMongoConnected,
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// ADMIN AUTHENTICATION
// ----------------------------------------------------
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required.",
    });
  }

  // Verify against configured admin credentials
  if (
    username.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
    password === ADMIN_PASSWORD
  ) {
    const token = generateAdminToken({ username: ADMIN_USERNAME });
    return res.json({
      success: true,
      token,
      admin: {
        username: ADMIN_USERNAME,
        role: "admin",
      },
      message: "Admin authentication successful.",
    });
  }

  return res.status(401).json({
    success: false,
    message:
      "Invalid admin credentials. Please check your username and password.",
  });
});

// ----------------------------------------------------
// PUBLIC / STUDENT QUESTION ENDPOINTS
// ----------------------------------------------------

// 1. Get Questions for a Quiz (Filtered by subject & difficulty)
app.get("/api/questions", async (req, res) => {
  try {
    const { subject, difficulty } = req.query;

    const query = {};
    if (subject) query.subject = new RegExp(`^${subject}$`, "i");
    if (difficulty) query.difficulty = new RegExp(`^${difficulty}$`, "i");

    if (isMongoConnected) {
      const questions = await Question.find(query).sort({ createdAt: 1 });
      return res.json({
        success: true,
        count: questions.length,
        questions,
      });
    } else {
      let filtered = [...fallbackStore.questions];
      if (subject) {
        filtered = filtered.filter(
          (q) => q.subject.toLowerCase() === subject.toLowerCase()
        );
      }
      if (difficulty) {
        filtered = filtered.filter(
          (q) => q.difficulty.toLowerCase() === difficulty.toLowerCase()
        );
      }

      return res.json({
        success: true,
        count: filtered.length,
        questions: filtered,
      });
    }
  } catch (error) {
    console.error("Error fetching questions for quiz:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching questions.",
    });
  }
});

// 2. Get Available Subjects and Difficulties (Metadata)
app.get("/api/questions/meta", async (req, res) => {
  try {
    let subjects = [];

    if (isMongoConnected) {
      subjects = await Question.distinct("subject");
    } else {
      subjects = Array.from(
        new Set(fallbackStore.questions.map((q) => q.subject))
      );
    }

    // Sort alphabetically
    subjects.sort();

    // Default fallbacks if empty
    if (subjects.length === 0) {
      subjects = ["Science", "General Knowledge", "History"];
    }

    const difficulties = ["Easy", "Intermediate", "Advanced"];

    return res.json({
      success: true,
      subjects,
      difficulties,
    });
  } catch (error) {
    console.error("Error fetching question metadata:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching question metadata.",
    });
  }
});

// ----------------------------------------------------
// STUDENT / USER ENDPOINTS
// ----------------------------------------------------

// 1. Student Login / Record Session
app.post("/api/student/login", async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId || !studentId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required.",
      });
    }

    const trimmedId = studentId.trim();
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "Web Browser";
    const now = new Date();

    let studentData;
    let history = [];

    if (isMongoConnected) {
      let student = await Student.findOne({ studentId: trimmedId });

      const loginRecord = {
        timestamp: now,
        ip: clientIp,
        userAgent,
      };

      if (!student) {
        student = new Student({
          studentId: trimmedId,
          lastLogin: now,
          loginHistory: [loginRecord],
          totalQuizzes: 0,
          averageScore: 0,
        });
      } else {
        student.lastLogin = now;
        student.loginHistory.push(loginRecord);
      }

      await student.save();
      studentData = student;

      // Fetch past quiz history
      history = await QuizResult.find({ studentId: trimmedId }).sort({
        completedAt: -1,
      });
    } else {
      // Fallback in-memory logic
      let student = fallbackStore.students.get(trimmedId);
      const loginRecord = {
        timestamp: now,
        ip: clientIp,
        userAgent,
      };

      if (!student) {
        student = {
          studentId: trimmedId,
          createdAt: now,
          lastLogin: now,
          loginHistory: [loginRecord],
          totalQuizzes: 0,
          averageScore: 0,
        };
      } else {
        student.lastLogin = now;
        student.loginHistory.push(loginRecord);
      }
      fallbackStore.students.set(trimmedId, student);
      studentData = student;

      history = fallbackStore.quizResults
        .filter((r) => r.studentId === trimmedId)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    }

    return res.json({
      success: true,
      student: studentData,
      history,
    });
  } catch (error) {
    console.error("Error logging in student:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during student login.",
    });
  }
});

// 2. Submit Quiz Result
app.post("/api/student/quiz-result", async (req, res) => {
  try {
    const {
      studentId,
      subject,
      difficulty,
      score,
      total,
      percentage,
      answers,
    } = req.body;

    if (!studentId || score === undefined || total === undefined) {
      return res.status(400).json({
        success: false,
        message: "Missing required quiz result data.",
      });
    }

    const trimmedId = studentId.trim();
    const finalPercentage =
      percentage !== undefined
        ? percentage
        : Math.round((Number(score) / Number(total)) * 100);

    const now = new Date();

    let savedResult;

    if (isMongoConnected) {
      const newResult = new QuizResult({
        studentId: trimmedId,
        subject,
        difficulty,
        score: Number(score),
        total: Number(total),
        percentage: finalPercentage,
        answers: answers || [],
        completedAt: now,
      });

      savedResult = await newResult.save();

      // Update student statistics
      const allResults = await QuizResult.find({ studentId: trimmedId });
      const totalQuizzes = allResults.length;
      const totalPercentage = allResults.reduce(
        (acc, curr) => acc + (curr.percentage || 0),
        0
      );
      const averageScore = Math.round(totalPercentage / totalQuizzes);

      await Student.findOneAndUpdate(
        { studentId: trimmedId },
        {
          $set: {
            totalQuizzes,
            averageScore,
          },
        },
        { upsert: true }
      );
    } else {
      // In-memory fallback
      savedResult = {
        _id:
          "res_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substring(2, 7),
        studentId: trimmedId,
        subject,
        difficulty,
        score: Number(score),
        total: Number(total),
        percentage: finalPercentage,
        answers: answers || [],
        completedAt: now,
      };

      fallbackStore.quizResults.push(savedResult);

      const allResults = fallbackStore.quizResults.filter(
        (r) => r.studentId === trimmedId
      );
      const totalQuizzes = allResults.length;
      const totalPercentage = allResults.reduce(
        (acc, curr) => acc + (curr.percentage || 0),
        0
      );
      const averageScore = Math.round(totalPercentage / totalQuizzes);

      let student = fallbackStore.students.get(trimmedId);
      if (student) {
        student.totalQuizzes = totalQuizzes;
        student.averageScore = averageScore;
      }
    }

    return res.json({
      success: true,
      result: savedResult,
    });
  } catch (error) {
    console.error("Error saving quiz result:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error saving quiz result.",
    });
  }
});

// 3. Get Student History
app.get("/api/student/:studentId/history", async (req, res) => {
  try {
    const { studentId } = req.params;

    if (isMongoConnected) {
      const history = await QuizResult.find({ studentId }).sort({
        completedAt: -1,
      });
      return res.json({ success: true, history });
    } else {
      const history = fallbackStore.quizResults
        .filter((r) => r.studentId === studentId)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      return res.json({ success: true, history });
    }
  } catch (error) {
    console.error("Error retrieving student history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error retrieving history.",
    });
  }
});

// ----------------------------------------------------
// ADMIN PROTECTED ENDPOINTS
// ----------------------------------------------------

// 1. Admin Dashboard Overview & Metrics
app.get("/api/admin/overview", authenticateAdmin, async (req, res) => {
  try {
    if (isMongoConnected) {
      const totalStudents = await Student.countDocuments();
      const totalQuizzes = await QuizResult.countDocuments();
      const totalQuestions = await Question.countDocuments();

      const allQuizzes = await QuizResult.find({}, "percentage");
      const overallAvg =
        allQuizzes.length > 0
          ? Math.round(
              allQuizzes.reduce((acc, curr) => acc + curr.percentage, 0) /
                allQuizzes.length
            )
          : 0;

      // Recent 5 logins
      const recentStudents = await Student.find()
        .sort({ lastLogin: -1 })
        .limit(5);

      // Recent 5 quiz submissions
      const recentQuizzes = await QuizResult.find()
        .sort({ completedAt: -1 })
        .limit(5);

      return res.json({
        success: true,
        stats: {
          totalStudents,
          totalQuizzes,
          totalQuestions,
          overallAvg,
          dbStatus: "MongoDB Connected",
          isMongoConnected: true,
        },
        recentStudents,
        recentQuizzes,
      });
    } else {
      const totalStudents = fallbackStore.students.size;
      const totalQuizzes = fallbackStore.quizResults.length;
      const totalQuestions = fallbackStore.questions.length;
      const overallAvg =
        totalQuizzes > 0
          ? Math.round(
              fallbackStore.quizResults.reduce(
                (acc, curr) => acc + curr.percentage,
                0
              ) / totalQuizzes
            )
          : 0;

      const recentStudents = Array.from(fallbackStore.students.values())
        .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
        .slice(0, 5);

      const recentQuizzes = [...fallbackStore.quizResults]
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 5);

      return res.json({
        success: true,
        stats: {
          totalStudents,
          totalQuizzes,
          totalQuestions,
          overallAvg,
          dbStatus: "Local In-Memory Mode (Connect MongoDB in .env)",
          isMongoConnected: false,
        },
        recentStudents,
        recentQuizzes,
      });
    }
  } catch (error) {
    console.error("Error fetching admin overview:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error retrieving admin overview.",
    });
  }
});

// 2. Admin: Get all students with their summary stats & login counts
app.get("/api/admin/students", authenticateAdmin, async (req, res) => {
  try {
    if (isMongoConnected) {
      const students = await Student.find().sort({ lastLogin: -1 });
      return res.json({ success: true, students });
    } else {
      const students = Array.from(fallbackStore.students.values()).sort(
        (a, b) => new Date(b.lastLogin) - new Date(a.lastLogin)
      );
      return res.json({ success: true, students });
    }
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error retrieving students.",
    });
  }
});

// 3. Admin: Get full details of a single student (profile, logins, all quiz attempts)
app.get(
  "/api/admin/students/:studentId",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      if (isMongoConnected) {
        const student = await Student.findOne({ studentId });
        const quizzes = await QuizResult.find({ studentId }).sort({
          completedAt: -1,
        });

        if (!student) {
          return res.status(404).json({
            success: false,
            message: `Student with ID "${studentId}" was not found.`,
          });
        }

        return res.json({
          success: true,
          student,
          quizzes,
        });
      } else {
        const student = fallbackStore.students.get(studentId);
        if (!student) {
          return res.status(404).json({
            success: false,
            message: `Student with ID "${studentId}" was not found.`,
          });
        }

        const quizzes = fallbackStore.quizResults
          .filter((r) => r.studentId === studentId)
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        return res.json({
          success: true,
          student,
          quizzes,
        });
      }
    } catch (error) {
      console.error("Error fetching student details:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error retrieving student details.",
      });
    }
  }
);

// 4. Admin: Get all quiz results across all users
app.get("/api/admin/quiz-results", authenticateAdmin, async (req, res) => {
  try {
    const { studentId, subject, difficulty } = req.query;

    if (isMongoConnected) {
      const query = {};
      if (studentId) query.studentId = studentId;
      if (subject) query.subject = subject;
      if (difficulty) query.difficulty = difficulty;

      const results = await QuizResult.find(query).sort({ completedAt: -1 });
      return res.json({ success: true, results });
    } else {
      let results = [...fallbackStore.quizResults];
      if (studentId) {
        results = results.filter((r) => r.studentId === studentId);
      }
      if (subject) {
        results = results.filter((r) => r.subject === subject);
      }
      if (difficulty) {
        results = results.filter((r) => r.difficulty === difficulty);
      }

      results.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      return res.json({ success: true, results });
    }
  } catch (error) {
    console.error("Error fetching quiz results:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error retrieving quiz results.",
    });
  }
});

// 5. Admin: Delete student (and their quiz history)
app.delete(
  "/api/admin/students/:studentId",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      if (isMongoConnected) {
        await Student.deleteOne({ studentId });
        await QuizResult.deleteMany({ studentId });
      } else {
        fallbackStore.students.delete(studentId);
        fallbackStore.quizResults = fallbackStore.quizResults.filter(
          (r) => r.studentId !== studentId
        );
      }

      return res.json({
        success: true,
        message: `Student "${studentId}" and associated history were deleted.`,
      });
    } catch (error) {
      console.error("Error deleting student:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error deleting student.",
      });
    }
  }
);

// ----------------------------------------------------
// ADMIN: QUESTION BANK MANAGEMENT CRUD ENDPOINTS
// ----------------------------------------------------

// 6. Admin: Get all questions with filters
app.get("/api/admin/questions", authenticateAdmin, async (req, res) => {
  try {
    const { subject, difficulty, search } = req.query;

    if (isMongoConnected) {
      const query = {};
      if (subject) query.subject = subject;
      if (difficulty) query.difficulty = difficulty;
      if (search) {
        query.$or = [
          { question: new RegExp(search, "i") },
          { subject: new RegExp(search, "i") },
        ];
      }

      const questions = await Question.find(query).sort({
        subject: 1,
        difficulty: 1,
        createdAt: -1,
      });

      return res.json({
        success: true,
        count: questions.length,
        questions,
      });
    } else {
      let filtered = [...fallbackStore.questions];
      if (subject) {
        filtered = filtered.filter((q) => q.subject === subject);
      }
      if (difficulty) {
        filtered = filtered.filter((q) => q.difficulty === difficulty);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(
          (q) =>
            q.question.toLowerCase().includes(s) ||
            q.subject.toLowerCase().includes(s)
        );
      }

      return res.json({
        success: true,
        count: filtered.length,
        questions: filtered,
      });
    }
  } catch (error) {
    console.error("Error fetching questions for admin:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching questions.",
    });
  }
});

// 7. Admin: Create a new question
app.post("/api/admin/questions", authenticateAdmin, async (req, res) => {
  try {
    const { subject, difficulty, question, options, answer } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required.",
      });
    }

    if (!difficulty || !["Easy", "Intermediate", "Advanced"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be 'Easy', 'Intermediate', or 'Advanced'.",
      });
    }

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question text is required.",
      });
    }

    if (!Array.isArray(options) || options.filter((o) => o && o.trim()).length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 non-empty options are required.",
      });
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!answer || !answer.trim()) {
      return res.status(400).json({
        success: false,
        message: "Correct answer is required.",
      });
    }

    const cleanAnswer = answer.trim();

    if (!cleanOptions.includes(cleanAnswer)) {
      return res.status(400).json({
        success: false,
        message: "The correct answer must match one of the provided options.",
      });
    }

    const questionData = {
      subject: subject.trim(),
      difficulty,
      question: question.trim(),
      options: cleanOptions,
      answer: cleanAnswer,
    };

    if (isMongoConnected) {
      const newQuestion = new Question(questionData);
      const saved = await newQuestion.save();
      return res.status(201).json({
        success: true,
        message: "Question created successfully.",
        question: saved,
      });
    } else {
      const newQ = {
        ...questionData,
        _id: "q_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      fallbackStore.questions.unshift(newQ);
      return res.status(201).json({
        success: true,
        message: "Question created successfully.",
        question: newQ,
      });
    }
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error creating question.",
    });
  }
});

// 8. Admin: Update an existing question
app.put("/api/admin/questions/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, difficulty, question, options, answer } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required.",
      });
    }

    if (!difficulty || !["Easy", "Intermediate", "Advanced"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be 'Easy', 'Intermediate', or 'Advanced'.",
      });
    }

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question text is required.",
      });
    }

    if (!Array.isArray(options) || options.filter((o) => o && o.trim()).length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 non-empty options are required.",
      });
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    const cleanAnswer = answer ? answer.trim() : "";

    if (!cleanAnswer || !cleanOptions.includes(cleanAnswer)) {
      return res.status(400).json({
        success: false,
        message: "The correct answer must match one of the provided options.",
      });
    }

    const updatePayload = {
      subject: subject.trim(),
      difficulty,
      question: question.trim(),
      options: cleanOptions,
      answer: cleanAnswer,
      updatedAt: new Date(),
    };

    if (isMongoConnected) {
      const updated = await Question.findByIdAndUpdate(
        id,
        { $set: updatePayload },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Question not found.",
        });
      }

      return res.json({
        success: true,
        message: "Question updated successfully.",
        question: updated,
      });
    } else {
      const index = fallbackStore.questions.findIndex((q) => q._id === id);
      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: "Question not found.",
        });
      }

      fallbackStore.questions[index] = {
        ...fallbackStore.questions[index],
        ...updatePayload,
      };

      return res.json({
        success: true,
        message: "Question updated successfully.",
        question: fallbackStore.questions[index],
      });
    }
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error updating question.",
    });
  }
});

// 9. Admin: Delete a question
app.delete("/api/admin/questions/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (isMongoConnected) {
      const deleted = await Question.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Question not found.",
        });
      }
    } else {
      const index = fallbackStore.questions.findIndex((q) => q._id === id);
      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: "Question not found.",
        });
      }
      fallbackStore.questions.splice(index, 1);
    }

    return res.json({
      success: true,
      message: "Question deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error deleting question.",
    });
  }
});

// 10. Admin: Reset to default questions
app.post(
  "/api/admin/questions/reset-defaults",
  authenticateAdmin,
  async (req, res) => {
    try {
      if (isMongoConnected) {
        await Question.deleteMany({});
        await Question.insertMany(defaultQuestions);
      } else {
        fallbackStore.questions = defaultQuestions.map((q, idx) => ({
          ...q,
          _id: "q_" + (idx + 1),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      }

      return res.json({
        success: true,
        message: `Question bank reset to ${defaultQuestions.length} default questions.`,
      });
    } catch (error) {
      console.error("Error resetting questions to defaults:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error resetting questions.",
      });
    }
  }
);

// Start Express server
app.listen(PORT, () => {
  console.log(`[Quiz Server] Backend running at http://localhost:${PORT}`);
});
