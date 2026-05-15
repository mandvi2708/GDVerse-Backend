const { GoogleGenerativeAI } = require("@google/generative-ai");
const Quiz = require("../models/Quiz");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// 🛡️ API Key Sanitization
let API_KEY = (process.env.GEMINI_API_KEY || "").trim();
if (API_KEY.startsWith('YAIza')) API_KEY = API_KEY.substring(1);

const genAI = new GoogleGenerativeAI(API_KEY);

exports.generateQuiz = async (req, res) => {
  try {
    const { topic, difficulty, fullName, email, jobRole, yearsExperience, jdText } = req.body;
    let resumeText = "";

    if (!req.files || !req.files.resume) {
      return res.status(400).json({ message: "Resume upload is mandatory for personalized assessment." });
    }

    const resumeFile = req.files.resume[0];
    if (resumeFile.mimetype === 'application/pdf') {
      const data = await pdf(resumeFile.buffer);
      resumeText = data.text;
    } else if (resumeFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const data = await mammoth.extractRawText({ buffer: resumeFile.buffer });
      resumeText = data.value;
    }

    const prompt = `
      Forge a highly personalized and randomized technical assessment.
      
      CONTEXT:
      - Role: ${jobRole}
      - Topic: ${topic}
      - Experience: ${yearsExperience} years
      - Candidate Resume: ${resumeText}
      - JD: ${jdText || "Standard industry standards"}

      REQUIREMENTS:
      1. Generate EXACTLY 20 questions.
      2. Question Types: 
         - 5 MCQ (Deep Conceptual)
         - 5 Scenario-based (Architecture/Problem Solving)
         - 4 Debugging (Find the bug in code snippets)
         - 3 Output Prediction (What will this code log?)
         - 3 Technical Depth (Implementation details)
      3. Difficulty: Adaptive (Start at ${difficulty}, increase/decrease based on common patterns).
      4. Avoid any hardcoded or generic questions. Every question must feel tailored to the resume and role.

      RESPONSE FORMAT (STRICT JSON ONLY):
      [
        {
          "question": "Question text here?",
          "type": "MCQ|Scenario|Debugging|Output|Technical",
          "difficulty": "Easy|Medium|Hard",
          "topic": "Specific sub-topic",
          "options": ["Option 0", "Option 1", "Option 2", "Option 3"],
          "correctAnswer": 0,
          "explanation": "Deep AI reasoning for the correct answer."
        }
      ]
    `;

    let questions;
    const modelsToTry = [
      "gemini-1.5-flash", 
      "gemini-2.0-flash", 
      "gemini-flash-latest", 
      "gemini-pro", 
      "models/gemini-1.5-flash"
    ];

    let lastError = "";
    for (const modelName of modelsToTry) {
      try {
        console.log(`🚀 Quiz Forge: Trying ${modelName}...`);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ]
        });

        const result = await model.generateContent(prompt);
        
        if (!result.response) {
          throw new Error("No response from Gemini");
        }

        const text = result.response.text();
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
          console.log(`✅ Quiz Forge: Success using ${modelName}`);
          break; 
        }
      } catch (aiError) {
        lastError = aiError.message;
        console.error(`⚠️ Quiz Forge: ${modelName} failed:`, aiError.message);
      }
    }

    if (!questions) {
      console.error("❌ Quiz Forge: ALL MODELS FAILED. Last Error:", lastError);
      return res.status(503).json({ 
        message: "AI Assessment Forge failed. This usually happens if your API Key is invalid or your Quota is reached.",
        error: lastError,
        tip: "Check your Render Logs for the specific Google error message."
      });
    }

    const quiz = new Quiz({
      title: `${topic} Expert Assessment`,
      topic,
      difficulty,
      questions,
      creator: req.user.id
    });

    await quiz.save();
    


    res.status(201).json(quiz);

  } catch (error) {
    console.error("Critical Quiz Forge Error:", error);
    res.status(500).json({ message: "Failed to generate AI Assessment.", error: error.message });
  }
};

exports.getQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz) return res.status(404).json({ message: "Assessment not found." });
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ message: "Error syncing quiz data." });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        const { quizId, score, totalQuestions, accuracy, averageSpeed, topicBreakdown } = req.body;
        const quiz = await Quiz.findById(quizId);
        if (!quiz) return res.status(404).json({ message: "Assessment record not found." });

        let readinessLevel = "Beginner";
        if (accuracy >= 90) readinessLevel = "Strong Hire Potential";
        else if (accuracy >= 75) readinessLevel = "Interview Ready";
        else if (accuracy >= 50) readinessLevel = "Intermediate";

        // AI Skill Gap Analysis
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const gapPrompt = `
          Based on the candidate's performance in a ${quiz.topic} quiz:
          Score: ${score}/${totalQuestions} (${accuracy}%)
          Readiness: ${readinessLevel}
          
          Provide a JSON Skill Gap Analysis:
          {
            "topGaps": ["skill 1", "skill 2"],
            "recommendations": ["resource/action 1", "resource/action 2"],
            "readinessSummary": "Deep analysis of current level."
          }
        `;
        
        let gapAnalysis = { topGaps: [], recommendations: [], readinessSummary: "Analyzing performance..." };
        try {
            const gapRes = await model.generateContent(gapPrompt);
            gapAnalysis = JSON.parse(gapRes.response.text().match(/\{.*\}/s)[0]);
        } catch (e) { console.error("Gap analysis failed"); }

        const result = {
            user: req.user.id,
            score,
            totalQuestions,
            accuracy,
            averageSpeed,
            readinessLevel,
            topicBreakdown,
            gapAnalysis
        };

        quiz.results.push(result);
        await quiz.save();

        res.json({ 
            message: "Assessment completed.", 
            result: quiz.results[quiz.results.length - 1] 
        });
    } catch (err) {
        console.error("Submit error:", err);
        res.status(500).json({ message: "Failed to finalize assessment." });
    }
};

exports.getMyQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ creator: req.user.id }).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (err) {
        console.error("GET MY QUIZZES ERROR:", err);
        res.status(500).json({ message: "Failed to fetch assessments.", error: err.message });
    }
};

exports.getQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        if (!quiz || (quiz.creator && quiz.creator.toString() !== req.user.id)) {
            return res.status(404).json({ message: "Assessment not found or unauthorized." });
        }
        res.json(quiz);
    } catch (err) {
        console.error("GET QUIZ ERROR:", err);
        res.status(500).json({ message: "Error fetching assessment." });
    }
};
