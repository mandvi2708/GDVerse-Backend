const { GoogleGenerativeAI } = require("@google/generative-ai");
const Session = require("../models/Session");

// 🛡️ API Key Sanitization
let API_KEY = (process.env.GEMINI_API_KEY || "").trim();
if (API_KEY.startsWith('YAIza')) API_KEY = API_KEY.substring(1);

console.log(`🔑 [AI Config] Key Masked: ${API_KEY ? API_KEY.substring(0, 8) + "..." : "NOT FOUND"}`);

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * 🚀 ZERO-CRASH AI Bot Response Controller
 */
exports.getBotResponse = async (req, res) => {
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[${reqId}] 📨 AI Bot Request Received`);

  try {
    if (!genAI) {
      console.error(`[${reqId}] ❌ Configuration Error: genAI not initialized`);
      return res.status(200).json({ 
        response: "I'm having trouble connecting to my brain right now. Let's keep the conversation going!",
        error: "Missing API Key" 
      });
    }

    const { transcript, isInterviewMode, jobDescription } = req.body;
    
    const history = (transcript || []).slice(-10);
    const transcriptStr = history
      .map(t => `${t.senderName || t.sender || 'Participant'}: ${t.content || t.text || ''}`)
      .join('\n');

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
        if (responseText) break; 
      } catch (err) {
        console.error(`[${reqId}] ⚠️ ${modelName} failed:`, err.message);
      }
    }

    if (!responseText) {
      responseText = isInterviewMode 
        ? "That's an interesting perspective. Could you tell me more about your experience in this area?" 
        : "I agree with the direction this is going. What are your thoughts on the implementation details?";
    }

    return res.status(200).json({ response: responseText.trim() });

  } catch (globalErr) {
    console.error(`[${reqId}] 🔥 Global Crash Caught:`, globalErr.stack);
    return res.status(200).json({ response: "Technical glitch, please continue!" });
  }
};

/**
 * 🚀 ZERO-CRASH MOM Generation
 */
exports.generateMOM = async (req, res) => {
  const { sessionId } = req.params;
  console.log(`📝 [MOM Request] inviteLink: ${sessionId}`);

  try {
    const session = await Session.findOne({ inviteLink: sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const transcriptText = (session.transcript || [])
      .map(t => `[Speech] ${t.sender}: ${t.text}`)
      .join("\n");

    const chatText = (session.chatMessages || [])
      .map(c => `[Chat] ${c.senderName}: ${c.content}`)
      .join("\n");

    const combinedHistory = `TRANSCRIPT:\n${transcriptText}\n\nCHAT LOG:\n${chatText}`;

    if (!transcriptText && !chatText) {
      return res.status(400).json({ message: "No data found to summarize" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
      You are an expert executive secretary. Based on the following meeting data (speech transcript and chat logs), generate professional Minutes of Meeting (MOM).
      Include: Executive Summary, Key Discussion Points, Decisions Made, and Action Items.
      
      DATA:
      ${combinedHistory}

      Tone: Professional, concise, and structured. Use Markdown.
    `;

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
      const result = await model.generateContent(`Analyze this interview and provide a score 1-10 with feedback on Clarity, Confidence, and Correctness:\n${transcriptText}`);
      return res.json({ feedback: result.response.text() });
    } catch (e) {
      return res.json({ feedback: "Evaluation service is temporarily offline." });
    }
  } catch (e) { res.json({ feedback: "Error generating feedback." }); }
};
