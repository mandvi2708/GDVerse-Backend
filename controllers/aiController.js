const { GoogleGenerativeAI } = require("@google/generative-ai");
const Session = require("../models/Session");

// 🛡️ Pre-flight Check: Ensure API Key exists
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("❌ CRITICAL: GEMINI_API_KEY is not defined in environment variables!");
}

// Initialize Gemini API safely
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * AI Bot Response Controller
 * Handles real-time conversation and interview logic
 */
exports.getBotResponse = async (req, res) => {
  // 1. Initial Logging
  console.log("📨 [AI Request] Received at /api/ai/bot-response");
  
  try {
    // 2. Validate API Key
    if (!genAI) {
      console.error("❌ [AI Error] Gemini API Key is missing");
      return res.status(500).json({ 
        message: "AI Configuration Error", 
        error: "API Key not found on server" 
      });
    }

    // 3. Validate Input
    const { transcript, botName, isInterviewMode, jobDescription } = req.body;
    
    if (!transcript || !Array.isArray(transcript)) {
      console.warn("⚠️ [AI Warning] Missing or invalid transcript in request");
      return res.status(400).json({ message: "Invalid request: Transcript is required" });
    }

    console.log(`🤖 [AI Context] Mode: ${isInterviewMode ? 'Interview' : 'GD'}, Job: ${jobDescription || 'N/A'}`);

    // 4. Construct Structured Prompt
    const transcriptStr = transcript
      .map(t => `${t.senderName || t.sender || 'Participant'}: ${t.content || t.text || ''}`)
      .join('\n');

    const prompt = `
      You are a professional AI Assistant participating in a live video conference.
      
      ROLE: ${isInterviewMode ? `Professional Technical Recruiter interviewing for: ${jobDescription || 'Software Engineer'}` : "Expert Discussion Participant"}
      
      TRANSCRIPT OF CONVERSATION:
      ${transcriptStr || "[Conversation just started]"}

      GOAL:
      ${isInterviewMode 
        ? "Evaluate the candidate's last answer briefly (if any) and ask the next relevant technical or HR question. If no messages exist, introduce yourself and ask the first question." 
        : "Provide a short, insightful, and natural-sounding contribution to the discussion."}
      
      CONSTRAINTS:
      - Response length: 2-3 sentences.
      - Tone: Professional, clear, and encouraging.
      - Format: Plain text only. NO EMOJIS. NO MARKDOWN.
      - Always end with a question if in Interview Mode.
    `;

    // 5. Execute Gemini Call with Fallback Model Support
    let model;
    let result;
    
    try {
      console.log("🚀 [AI API] Calling Gemini-1.5-Flash...");
      model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // Use the structured format requested by the user for internal SDK processing
      result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
    } catch (primaryErr) {
      console.error("⚠️ [AI API] Gemini-1.5-Flash failed:", primaryErr.message);
      
      console.log("🔄 [AI API] Falling back to Gemini-Pro...");
      model = genAI.getGenerativeModel({ model: "gemini-pro" });
      result = await model.generateContent(prompt);
    }

    // 6. Safe Response Parsing
    if (!result || !result.response) {
      throw new Error("Gemini API returned an empty or invalid response object");
    }

    const responseText = result.response.text();
    
    if (!responseText || responseText.trim() === "") {
      console.warn("⚠️ [AI API] Gemini returned empty text");
      return res.status(200).json({ 
        response: isInterviewMode ? "Could you please elaborate on that?" : "I agree with that point. What do others think?" 
      });
    }

    console.log("✅ [AI Success] Generated response length:", responseText.length);

    // 7. Final Clean Response
    return res.status(200).json({
      response: responseText.trim()
    });

  } catch (error) {
    // 8. Comprehensive Error Logging
    console.error("🔥 [AI CRITICAL ERROR]:", error.stack);
    
    return res.status(500).json({ 
      message: "Internal AI Processing Error", 
      error: error.message,
      reply: "I'm having a bit of trouble connecting right now. Please continue, and I'll jump back in shortly."
    });
  }
};

/**
 * Generate Minutes of Meeting (MOM)
 */
exports.generateMOM = async (req, res) => {
  const { sessionId } = req.params;
  console.log(`📝 [MOM Request] Session: ${sessionId}`);

  try {
    const session = await Session.findById(sessionId);
    if (!session || !session.transcript || session.transcript.length === 0) {
      return res.status(400).json({ message: "No transcript found for summary" });
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
    console.error("🔥 [MOM Error]:", error);
    res.status(500).json({ message: "MOM generation failed", error: error.message });
  }
};

/**
 * Get MOM for a session
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
 * Get Interview Evaluation Feedback
 */
exports.getInterviewFeedback = async (req, res) => {
  const { sessionId } = req.params;
  console.log(`📊 [Feedback Request] Session: ${sessionId}`);

  try {
    const session = await Session.findOne({ inviteLink: sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const transcriptText = session.transcript
      .map(t => `${t.sender}: ${t.text}`)
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analyze this interview for a ${session.jobDescription || 'Candidate'}. Provide scores (0-10) and feedback for Clarity, Confidence, and Technical Correctness.\n\nTranscript:\n${transcriptText}`;

    const result = await model.generateContent(prompt);
    res.json({ feedback: result.response.text() });
  } catch (error) {
    console.error("🔥 [Feedback Error]:", error);
    res.status(500).json({ error: error.message });
  }
};
