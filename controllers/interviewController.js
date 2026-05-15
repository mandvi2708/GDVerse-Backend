const { GoogleGenerativeAI } = require("@google/generative-ai");
const Interview = require("../models/Interview");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// 🛡️ API Key Sanitization
let API_KEY = (process.env.GEMINI_API_KEY || "").trim();
if (API_KEY.startsWith('YAIza')) API_KEY = API_KEY.substring(1);

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * 🚀 Robust AI Call Helper with Fallback Models
 */
async function callGeminiAI(prompt) {
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
      console.log(`🚀 Interview Engine: Trying ${modelName}...`);
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
      const text = result.response.text();
      if (text) return text.trim();
    } catch (err) {
      lastError = err.message;
      console.error(`⚠️ Interview Engine: ${modelName} failed:`, err.message);
    }
  }
  throw new Error(lastError || "All AI models failed to respond.");
}

const INTERVIEW_STAGES = ['Introduction', 'Technical', 'Behavioral', 'Conclusion'];

exports.startInterview = async (req, res) => {
  try {
    const { fullName, email, jobRole, yearsExperience, jdText } = req.body;
    let resumeText = "";

    if (!req.files || !req.files.resume) {
      return res.status(400).json({ message: "Resume upload is mandatory." });
    }

    const resumeFile = req.files.resume[0];
    if (resumeFile.mimetype === 'application/pdf') {
      const data = await pdf(resumeFile.buffer);
      resumeText = data.text;
    } else if (resumeFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const data = await mammoth.extractRawText({ buffer: resumeFile.buffer });
      resumeText = data.value;
    }

    let finalJdText = jdText || "";
    if (req.files.jd) {
      const jdFile = req.files.jd[0];
      if (jdFile.mimetype === 'application/pdf') {
        const data = await pdf(jdFile.buffer);
        finalJdText = data.text;
      } else if (jdFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const data = await mammoth.extractRawText({ buffer: jdFile.buffer });
        finalJdText = data.value;
      }
    }

    const interview = new Interview({
      candidateInfo: { fullName, email, jobRole, yearsExperience, resumeText, jdText: finalJdText },
      status: 'ongoing',
      stage: 'Introduction',
      shareLink: Math.random().toString(36).substring(2, 10),
      creator: req.user.id
    });

    await interview.save();

    // Initial AI Question Generation
    let initialQuestion;
    try {
      initialQuestion = await generateAIQuestion(interview);
    } catch (aiError) {
      console.error("AI Generation Failed:", aiError.message);
      return res.status(503).json({ 
        message: "AI Service Unavailable. Please verify your GEMINI_API_KEY in the production environment.",
        error: aiError.message 
      });
    }

    interview.conversation.push({
      role: 'ai',
      content: initialQuestion,
      stage: 'Introduction'
    });
    await interview.save();

    res.status(201).json({ 
      message: "Interview session initialized.", 
      interviewId: interview._id,
      firstQuestion: initialQuestion
    });

  } catch (error) {
    console.error("Critical Error starting interview:", error);
    res.status(500).json({ message: "Failed to initialize interview engine.", error: error.message });
  }
};

async function generateAIQuestion(interview) {
  const { candidateInfo, conversation, stage } = interview;
  const history = conversation.map(c => `${c.role.toUpperCase()}: ${c.content}`).join('\n');
  
  const systemInstruction = `
    You are an elite AI Recruiter and Senior Technical Interviewer at a top-tier tech firm (like Google or Meta).
    Your goal is to conduct a HIGHLY CONVERSATIONAL, context-aware, and deep technical interview.

    CANDIDATE PROFILE:
    - Name: ${candidateInfo.fullName}
    - Role: ${candidateInfo.jobRole}
    - Experience: ${candidateInfo.yearsExperience} years
    - Resume Context: ${candidateInfo.resumeText}
    - Job Description: ${candidateInfo.jdText || "Standard industry requirements for this role."}

    INTERVIEW STAGE: ${stage}

    STRICT GUIDELINES:
    1. BREVITY IS KEY: Keep your responses CONCISE. Never write long paragraphs. Your response should be 2-3 sentences max.
    2. CONVERSATIONAL FLOW: Acknowledge the candidate's last answer briefly and move to the next point.
    3. ONLY ONE SHORT QUESTION: Ask exactly one meaningful, concise question at a time.
    4. STAGE ADAPTATION:
       - Introduction: Short welcome and background check.
       - Technical: Focus on one concept at a time.
       - Behavioral: One scenario at a time.
       - Conclusion: Professional wrap-up.

    CURRENT HISTORY:
    ${history || "[Beginning of Interview]"}

    Respond only with the interviewer's next statement. Keep it short.
  `;

  return await callGeminiAI(systemInstruction);
}

exports.submitAnswer = async (req, res) => {
  try {
    const { interviewId, answer, forceComplete } = req.body;
    const interview = await Interview.findById(interviewId);
    if (!interview) return res.status(404).json({ message: "Interview session not found." });

    if (forceComplete) {
      interview.status = 'completed'; // Mark as completed to remove from 'Ongoing'
      await generateFinalReport(interview);
      await interview.save();
      return res.json({ message: "Session ended manually.", isCompleted: true });
    }

    // Save candidate answer
    interview.conversation.push({
      role: 'candidate',
      content: answer,
      stage: interview.stage
    });

    // Evaluate in background
    const evaluation = await evaluateResponse(interview, answer);
    interview.conversation[interview.conversation.length - 1].evaluation = evaluation;

    // Advance stage logic
    const totalQuestions = interview.conversation.filter(c => c.role === 'ai').length;
    if (totalQuestions < 2) interview.stage = 'Introduction';
    else if (totalQuestions < 8) interview.stage = 'Technical';
    else if (totalQuestions < 10) interview.stage = 'Behavioral';
    else interview.stage = 'Conclusion';

    const aiResponse = await generateAIQuestion(interview);
    
    interview.conversation.push({
      role: 'ai',
      content: aiResponse,
      stage: interview.stage
    });

    if (interview.stage === 'Conclusion' || totalQuestions >= 12) {
      interview.status = 'completed';
      await generateFinalReport(interview);
    }

    await interview.save();

    res.json({ 
      aiResponse,
      stage: interview.stage,
      isCompleted: interview.status === 'completed'
    });

  } catch (error) {
    console.error("Critical Error processing answer:", error);
    res.status(500).json({ message: "Failed to sync interview state." });
  }
};

async function evaluateResponse(interview, answer) {
  const lastAiMsg = interview.conversation.filter(c => c.role === 'ai').pop();
  const question = lastAiMsg ? lastAiMsg.content : "N/A";

  const prompt = `
    Evaluate the candidate's response in the context of the question.
    Question: ${question}
    Response: ${answer}

    Provide JSON:
    {
      "score": 1-10,
      "feedback": "Deep technical and behavioral feedback.",
      "technical": 1-10,
      "communication": 1-10,
      "confidence": 1-10,
      "isFollowUpNeeded": true/false
    }
  `;

  const result = await callGeminiAI(prompt);
  try {
    const jsonMatch = result.match(/\{.*\}/s);
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { score: 7, feedback: "Response processed successfully." };
  }
}

async function generateFinalReport(interview) {
  const history = interview.conversation.map(c => `${c.role.toUpperCase()}: ${c.content}`).join('\n');
  const prompt = `
    Conduct a comprehensive analysis of this interview for ${interview.candidateInfo.fullName}.
    Role: ${interview.candidateInfo.jobRole}
    
    History:
    ${history}

    Generate a detailed JSON report:
    {
      "overallScore": 0-100,
      "strengths": ["string"],
      "weaknesses": ["string"],
      "improvementSuggestions": ["string"],
      "aiSummary": "Executive level summary.",
      "readinessLevel": "Beginner|Intermediate|Interview Ready|Strong Hire",
      "categoryScores": {
        "technical": 0-100,
        "communication": 0-100,
        "confidence": 0-100,
        "problemSolving": 0-100,
        "resumeStrength": 0-100
      }
    }
  `;

  const result = await callGeminiAI(prompt);
  try {
    const jsonMatch = result.match(/\{.*\}/s);
    interview.finalReport = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Report generation failed.");
  }
}

exports.getReport = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);
        if (!interview) return res.status(404).json({ message: "Report artifact not found." });
        res.json(interview.finalReport);
    } catch (err) {
        res.status(500).json({ message: "Error syncing report data." });
    }
};

exports.getMyInterviews = async (req, res) => {
    try {
        const interviews = await Interview.find({ creator: req.user.id }).sort({ createdAt: -1 });
        res.json(interviews);
    } catch (err) {
        console.error("GET MY INTERVIEWS ERROR:", err);
        res.status(500).json({ message: "Failed to fetch interviews.", error: err.message });
    }
};

exports.getInterview = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);
        if (!interview || (interview.creator && interview.creator.toString() !== req.user.id)) {
            return res.status(404).json({ message: "Interview not found or unauthorized." });
        }
        res.json(interview);
    } catch (err) {
        res.status(500).json({ message: "Error fetching interview." });
    }
};

