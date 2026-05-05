const { GoogleGenerativeAI } = require("@google/generative-ai");
const Session = require("../models/Session");

// 🛡️ API Key Sanitization
let API_KEY = (process.env.GEMINI_API_KEY || "").trim();
if (API_KEY.startsWith('YAIza')) API_KEY = API_KEY.substring(1);

console.log(`🔑 [AI Config] Key Masked: ${API_KEY ? API_KEY.substring(0, 8) + "..." : "NOT FOUND"}`);

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * 🚀 ZERO-CRASH AI Bot Response Controller
 * Designed to never return 500. Always returns a response or a safe fallback.
 */
exports.getBotResponse = async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[${reqId}] 📨 AI Bot Request Received`);

  try {
    // 1. Pre-checks
    if (!genAI) {
      console.error(`[${reqId}] ❌ Configuration Error: genAI not initialized`);
      return res.status(200).json({ 
        response: "I'm having trouble connecting to my brain right now. Let's keep the conversation going!",
        error: "Missing API Key" 
      });
    }

    const { transcript, isInterviewMode, jobDescription } = req.body;
    
    // 2. Data Preparation
    const history = (transcript || []).slice(-10);
    const transcriptStr = history
      .map(t => `${t.senderName || t.sender || 'Participant'}: ${t.content || t.text || ''}`)
      .join('\n');

    console.log(`[${reqId}] 📝 Transcript lines: ${history.length}`);

    // 3. Prompt Construction
    const prompt = `
      You are a professional AI Assistant in a live video meeting.
      ROLE: ${isInterviewMode ? `Technical Recruiter for: ${jobDescription || 'Software Engineer'}` : "Discussion Participant"}
      TRANSCRIPT:
      ${transcriptStr || "[Start of conversation]"}

      GOAL:
      ${isInterviewMode 
        ? "Evaluate the last answer briefly and ask the next relevant question. If starting, introduce yourself." 
        : "Provide a short, insightful point (2 sentences)."}
      
      RULES: Plain text only. No emojis. Professional tone. End with a question if interviewing.
    `;

    // 4. Gemini Call with Multi-Model Fallback and Safety Bypass
    let responseText = "";
    const modelsToTry = ["gemini-pro", "gemini-1.5-flash"];

    for (const modelName of modelsToTry) {
      try {
        console.log(`[${reqId}] 🚀 Trying ${modelName}...`);
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
        responseText = result.response.text();
        
        if (responseText) {
          console.log(`[${reqId}] ✅ Success with ${modelName}`);
          break; 
        }
      } catch (err) {
        console.error(`[${reqId}] ⚠️ ${modelName} failed:`, err.message);
      }
    }

    // 5. Final Fallback if all models fail
    if (!responseText) {
      console.warn(`[${reqId}] ⚠️ All AI models failed. Using static fallback.`);
      responseText = isInterviewMode 
        ? "That's an interesting perspective. Could you tell me more about your experience in this area?" 
        : "I agree with the direction this is going. What are your thoughts on the implementation details?";
    }

    return res.status(200).json({ response: responseText.trim() });

  } catch (globalErr) {
    console.error(`[${reqId}] 🔥 Global Crash Caught:`, globalErr.stack);
    return res.status(200).json({ 
      response: "I'm experiencing a slight technical glitch, but I'm still listening! Please continue.",
      error: globalErr.message 
    });
  }
};

/**
 * 🚀 ZERO-CRASH MOM Generation
 */
exports.generateMOM = async (req, res) => {
  const { sessionId } = req.params;
  console.log(`📝 [MOM] Request for ${sessionId}`);

  try {
    const session = await Session.findOne({ inviteLink: sessionId });
    if (!session) return res.status(200).json({ message: "Session not found", minutesOfMeeting: "Session data unavailable." });

    const transcriptText = (session.transcript || [])
      .map(t => `${t.sender}: ${t.text}`)
      .join("\n");

    if (!transcriptText) {
      return res.status(200).json({ message: "No transcript recorded", minutesOfMeeting: "No conversation was recorded to summarize." });
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(`Generate a professional MOM for this transcript:\n${transcriptText}`);
      const mom = result.response.text();
      session.minutesOfMeeting = mom;
      await session.save();
      return res.json({ message: "Success", minutesOfMeeting: mom });
    } catch (aiErr) {
      console.error("MOM AI Error:", aiErr.message);
      return res.json({ message: "AI Error", minutesOfMeeting: "Summary generation is currently unavailable, but your transcript is saved." });
    }
  } catch (err) {
    console.error("MOM Global Error:", err.message);
    res.json({ message: "Error", minutesOfMeeting: "A technical error occurred during summary generation." });
  }
};

exports.getMOM = async (req, res) => {
  try {
    const session = await Session.findOne({ inviteLink: req.params.sessionId });
    res.json({ minutesOfMeeting: session?.minutesOfMeeting || "No MOM found." });
  } catch (e) { res.json({ minutesOfMeeting: "Error fetching MOM." }); }
};

exports.getInterviewFeedback = async (req, res) => {
  try {
    const session = await Session.findOne({ inviteLink: req.params.sessionId });
    if (!session) return res.json({ feedback: "Session not found." });

    const transcriptText = (session.transcript || []).map(t => `${t.sender}: ${t.text}`).join("\n");
    
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(`Evaluate this interview transcript and provide a score 1-10:\n${transcriptText}`);
      return res.json({ feedback: result.response.text() });
    } catch (e) {
      return res.json({ feedback: "Evaluation service is temporarily offline. Please download the transcript for manual review." });
    }
  } catch (e) { res.json({ feedback: "Error generating feedback." }); }
};
