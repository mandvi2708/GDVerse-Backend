const { GoogleGenerativeAI } = require("@google/generative-ai");
const Session = require("../models/Session");

// 🛡️ API Key Sanitization
let API_KEY = (process.env.GEMINI_API_KEY || "").trim();
if (API_KEY.startsWith('YAIza')) API_KEY = API_KEY.substring(1);

console.log(`🔑 [AI Config] Key Masked: ${API_KEY ? API_KEY.substring(0, 8) + "..." : "NOT FOUND"}`);

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * 🔍 Diagnostic Route to verify API Key on Render
 */
exports.debugAI = async (req, res) => {
  const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
  const maskedKey = API_KEY ? `${API_KEY.substring(0, 6)}...${API_KEY.substring(API_KEY.length - 4)}` : "NOT FOUND";
  
  res.json({
    status: API_KEY ? "Key Present" : "Key Missing",
    maskedKey: maskedKey,
    nodeVersion: process.version,
    envStatus: process.env.NODE_ENV || "not set",
    tip: "If maskedKey says 'NOT FOUND', you must add GEMINI_API_KEY to your Render Environment Variables dashboard."
  });
};

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
    
    const history = (transcript || []).slice(-50);
    const transcriptStr = history
      .map(t => `${t.senderName || t.sender || 'Participant'}: ${t.content || t.text || ''}`)
      .join('\n');

    const prompt = `
      You are a professional AI Assistant in a live video meeting.
      ROLE: ${isInterviewMode ? `Professional Senior Interviewer conducting a real mock interview for: ${jobDescription || 'Software Engineer'}` : "Discussion Participant"}
      TRANSCRIPT:
      ${transcriptStr || "[Start of conversation]"}

      GOAL:
      ${isInterviewMode 
        ? `You are conducting a formal but conversational mock interview. 
Follow this strict flow based on the Transcript:
1. First, carefully analyze the transcript and count EXACTLY how many distinct interview questions you (the AI) have asked the candidate so far.
2. If you have asked LESS THAN 5 questions: Acknowledge the candidate's last answer briefly, then ask the NEXT relevant interview question.
3. If you have asked BETWEEN 5 and 9 questions: You may ask another question if needed, OR conclude the interview.
4. If you have asked 10 questions: You MUST conclude the interview.
5. TO CONCLUDE THE INTERVIEW: Do not ask any more questions. Write a professional thank you note, clearly state that the interview is now over, and wish the candidate all the best in their career.

CRITICAL RULES:
- Ask ONLY ONE question at a time. Do not overwhelm the candidate.
- NEVER ask a question if you are concluding the interview.
- Evaluate the candidate's previous response gracefully before asking the next question.
- Behave exactly like a real senior interviewer in a top tech company. Natural, encouraging, and highly context-aware.` 
        : "Provide a short, insightful, and highly conversational point (1-2 sentences)."}
      
      RULES: Plain text only. No emojis. Tone should be highly conversational, empathetic, and professional.
    `;

    let responseText = "";
    const modelsToTry = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro", "gemini-pro-latest"];

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
 * 🚀 Z/**
 * 🚀 ZERO-CRASH MOM Generation - Optimized for Stability
 */
exports.generateMOM = async (req, res) => {
  const { sessionId } = req.body;
  const normalizedSessionId = sessionId?.trim().toLowerCase();
  console.log(`📝 [MOM Request] inviteLink: ${normalizedSessionId}`);

  try {
    const session = await Session.findOne({ inviteLink: normalizedSessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const transcriptText = (session.transcript || [])
      .map(t => `[Speech] ${t.sender || 'Participant'}: ${t.text || ''}`)
      .filter(t => t.trim())
      .join("\n");

    const chatText = (session.chatMessages || [])
      .map(c => `[Chat] ${c.senderName || 'Participant'}: ${c.content || ''}`)
      .filter(c => c.trim())
      .join("\n");

    if (!transcriptText && !chatText) {
      return res.status(200).json({ 
        message: "No data", 
        minutesOfMeeting: "No conversation data found to summarize. Please engage in the chat or speak first." 
      });
    }

    if (!genAI) {
      console.error(`[MOM Request] ❌ Configuration Error: genAI not initialized`);
      return res.status(500).json({ message: "AI Configuration missing. Please check GEMINI_API_KEY." });
    }

    // Use full model paths for maximum compatibility with the SDK
    const modelsToTry = [
      "models/gemini-1.5-flash",
      "models/gemini-1.5-pro",
      "models/gemini-2.0-flash",
      "models/gemini-flash-latest"
    ];
    
    let mom = "";
    let lastError = "";
    
    const prompt = `
      You are an elite executive assistant. Create a crisp, concise, and high-impact Minutes of Meeting (MOM) based on the following conversation transcript and chat messages.
      
      CRITICAL GUIDELINES:
      1. BREVITY: Use sharp bullet points.
      2. SUMMARY: Max 2-3 sentences.
      3. DECISIONS & ACTIONS: Focus on outcomes and "Who does What".
      4. TONE: Professional and direct.

      TITLE: ${session.title || 'Meeting'}
      AGENDA: ${session.description || 'General Discussion'}

      TRANSCRIPT: 
      ${transcriptText}

      CHAT MESSAGES: 
      ${chatText}

      Format: Clean Markdown. Keep it under 400 words.
    `;

    for (const modelName of modelsToTry) {
      try {
        console.log(`📝 Trying ${modelName} for MOM...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        
        if (result && result.response) {
          mom = result.response.text();
          if (mom && mom.trim()) {
            console.log(`✅ MOM generated successfully with ${modelName}`);
            break;
          }
        }
      } catch (err) {
        lastError = err.message;
        console.error(`⚠️ ${modelName} MOM failed:`, err.message);
        // Continue to next model
      }
    }

    // Fallback: If AI fails, generate a basic structural MOM
    if (!mom) {
      console.warn("⚠️ AI Generation failed. Using structural fallback.");
      mom = `
# Minutes of Meeting (Auto-Generated Summary)

**Meeting:** ${session.title || 'Discussion'}
**Status:** AI Summary Unavailable (Quota/Limit reached)

### Summary of Activity
- **Speech Contributions:** ${session.transcript?.length || 0} segments recorded.
- **Chat Messages:** ${session.chatMessages?.length || 0} messages exchanged.

### Participants
${Array.from(new Set([
  ...(session.transcript || []).map(t => t.sender),
  ...(session.chatMessages || []).map(c => c.senderName)
])).filter(Boolean).map(name => `- ${name}`).join('\n')}

*Note: A detailed AI summary could not be generated at this time due to high traffic. Please try again later.*
      `.trim();
    }

    // Save the generated MOM (even if fallback)
    session.minutesOfMeeting = mom;
    await session.save();

    return res.json({ message: "MOM generated", minutesOfMeeting: mom });
  } catch (error) {
    console.error("🔥 [MOM Global Error]:", error.stack);
    return res.status(500).json({ 
      message: "MOM generation failed internally", 
      error: error.message 
    });
  }
};

exports.getInterviewFeedback = async (req, res) => {
  const { sessionId, userName } = req.body;
  const normalizedSessionId = sessionId?.trim().toLowerCase();
  
  console.log(`📊 [Feedback Request] Session: ${normalizedSessionId}, User: ${userName || 'All'}`);

  try {
    const session = await Session.findOne({ inviteLink: normalizedSessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Filter data for the specific user
    const userTranscript = (session.transcript || [])
      .filter(t => !userName || t.sender === userName)
      .map(t => t.text)
      .join("\n");

    const userChat = (session.chatMessages || [])
      .filter(c => !userName || c.senderName === userName)
      .map(c => c.content)
      .join("\n");

    const combinedUserContent = `SPEECH:\n${userTranscript}\n\nCHAT:\n${userChat}`;

    if (!userTranscript && !userChat) {
      return res.status(200).json({ 
        feedback: "No data found for this user to evaluate. Please participate in the session first." 
      });
    }

    if (!genAI) {
      console.error(`[Feedback Request] ❌ Configuration Error: genAI not initialized`);
      return res.status(500).json({ message: "AI Configuration missing. Cannot generate Feedback." });
    }

    const modelsToTry = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-pro", "gemini-pro-latest"];
    let feedbackText = "";
    
    const prompt = `
      You are an expert HR and Technical Evaluator. Analyze the following contributions from a participant named "${userName || 'the candidate'}" in a ${session.isInterviewMode ? 'Technical Interview' : 'Group Discussion'}.
      
      DATA:
      ${combinedUserContent}

      GOAL: Provide a detailed professional assessment.
      FORMAT:
      1. Overall Score (1-10)
      2. Key Strengths (Bulleted list)
      3. Primary Weaknesses (Bulleted list)
      4. Improvement Suggestions (Actionable advice)
      5. Category Scores (0-10): Clarity, Confidence, Technical Correctness.

      Tone: Constructive and professional.
    `;

    for (const modelName of modelsToTry) {
      try {
        console.log(`📊 Trying ${modelName} for Feedback...`);
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
        feedbackText = result.response.text();
        if (feedbackText) break;
      } catch (err) {
        console.error(`⚠️ ${modelName} Feedback failed:`, err.message);
      }
    }

    if (!feedbackText) {
      return res.status(500).json({ message: "Failed to generate Feedback from all AI models." });
    }


    // Persist assessment if userName is provided
    if (userName) {
      await Session.findOneAndUpdate(
        { inviteLink: normalizedSessionId },
        { $push: { userAssessments: { userName, feedback: feedbackText } } }
      );
    }

    res.json({ feedback: feedbackText });
  } catch (error) {
    console.error("🔥 [Feedback Error]:", error.message);
    res.status(500).json({ error: error.message });
  }
};

