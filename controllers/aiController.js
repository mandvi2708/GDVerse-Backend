const { GoogleGenerativeAI } = require("@google/generative-ai");
const Session = require("../models/Session");

// 🛡️ Pre-flight Check: Ensure API Key exists and is valid
let API_KEY = (process.env.GEMINI_API_KEY || "").trim();

// Auto-fix: Remove common typo prefix 'Y' or spaces
if (API_KEY.startsWith('YAIza')) {
  API_KEY = API_KEY.substring(1);
}

if (!API_KEY) {
  console.error("❌ CRITICAL: GEMINI_API_KEY is not defined!");
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * AI Bot Response Controller
 */
exports.getBotResponse = async (req, res) => {
  console.log("📨 [AI Request] Received:", JSON.stringify(req.body).substring(0, 200) + "...");
  
  try {
    if (!genAI) throw new Error("GEMINI_API_KEY is missing or invalid");

    const { transcript, botName, isInterviewMode, jobDescription } = req.body;
    
    // Construct Prompt
    const transcriptStr = (transcript || [])
      .map(t => `${t.senderName || t.sender || 'Participant'}: ${t.content || t.text || ''}`)
      .join('\n');

    const prompt = `
      You are a professional AI Assistant in a live video meeting.
      ROLE: ${isInterviewMode ? `Technical Recruiter for: ${jobDescription || 'Software Engineer'}` : "Discussion Participant"}
      TRANSCRIPT:
      ${transcriptStr || "[Start of conversation]"}

      GOAL:
      ${isInterviewMode 
        ? "Evaluate the last answer and ask the next relevant question. If starting, introduce yourself." 
        : "Provide a short, insightful point (2 sentences)."}
      RULES: No emojis. Professional tone. End with a question if interviewing.
    `;

    // Try Flash first, then Pro
    let result;
    try {
      console.log("🚀 [AI API] Attempting Flash...");
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
      });
      result = await model.generateContent(prompt);
    } catch (e) {
      console.warn("⚠️ Flash failed, trying Pro fallback...");
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      result = await model.generateContent(prompt);
    }

    const responseText = result.response.text();
    console.log("✅ [AI Success] Reply:", responseText.substring(0, 50) + "...");

    return res.status(200).json({ response: responseText.trim() });

  } catch (error) {
    console.error("🔥 [AI ERROR]:", error.message);
    return res.status(500).json({ 
      message: "AI service error", 
      error: error.message,
      reply: "I'm having trouble connecting. Please continue!" 
    });
  }
};

/**
 * Generate Minutes of Meeting (MOM)
 */
exports.generateMOM = async (req, res) => {
  const { sessionId } = req.params;
  console.log(`📝 [MOM Request] inviteLink: ${sessionId}`);

  try {
    // FIX: Using findOne with inviteLink instead of findById
    const session = await Session.findOne({ inviteLink: sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (!session.transcript || session.transcript.length === 0) {
      return res.status(400).json({ message: "No transcript recorded for this session" });
    }

    const transcriptText = session.transcript
      .map(t => `${t.sender}: ${t.text}`)
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Generate a professional Minutes of Meeting (MOM) for Session ${session.inviteLink}. Include Discussion Points, Decisions, and Action Items. \n\nTranscript:\n${transcriptText}`;

    const result = await model.generateContent(prompt);
    const mom = result.response.text();

    session.minutesOfMeeting = mom;
    await session.save();

    res.json({ message: "MOM generated", minutesOfMeeting: mom });
  } catch (error) {
    console.error("🔥 [MOM Error]:", error.message);
    res.status(500).json({ message: "MOM generation failed", error: error.message });
  }
};

/**
 * Get MOM
 */
exports.getMOM = async (req, res) => {
  try {
    const session = await Session.findOne({ inviteLink: req.params.sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json({ minutesOfMeeting: session.minutesOfMeeting });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get Interview Feedback
 */
exports.getInterviewFeedback = async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = await Session.findOne({ inviteLink: sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const transcriptText = (session.transcript || [])
      .map(t => `${t.sender}: ${t.text}`)
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Evaluate this interview for ${session.jobDescription || 'Candidate'}. Provide scores (0-10) for Clarity, Confidence, and Correctness. \n\nTranscript:\n${transcriptText}`;

    const result = await model.generateContent(prompt);
    res.json({ feedback: result.response.text() });
  } catch (error) {
    console.error("🔥 [Feedback Error]:", error.message);
    res.status(500).json({ error: error.message });
  }
};
