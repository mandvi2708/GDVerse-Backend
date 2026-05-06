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
      ROLE: ${isInterviewMode ? `Professional Senior Interviewer conducting a real mock interview for: ${jobDescription || 'Software Engineer'}` : "Discussion Participant"}
      TRANSCRIPT:
      ${transcriptStr || "[Start of conversation]"}

      GOAL:
      ${isInterviewMode 
        ? `Your behavior:
- Make the AI interviewer sound human and conversational.
- Ask one interview question at a time.
- Wait for candidate response.
- Evaluate the response gracefully and ask intelligent, context-aware follow-up questions.
- Keep the interview progression dynamic and natural.

Features to embrace:
- Natural speaking style
- Encouraging tone
- Intelligent follow-up questions
- Context-aware responses
- Dynamic interview progression

AVOID AT ALL COSTS:
- Robotic replies
- Short answers
- Repetitive questions
- Ending the interview quickly

Focus on evaluating:
- communication skills
- technical understanding
- confidence
- problem-solving

Behave exactly like a real senior interviewer in a top tech company.` 
        : "Provide a short, insightful, and highly conversational point (1-2 sentences)."}
      
      RULES: Plain text only. No emojis. Tone should be highly conversational, empathetic, and professional. End with a question if interviewing.
    `;

    let responseText = "";
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro"];

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
  const { sessionId } = req.body;
  const normalizedSessionId = sessionId?.trim().toLowerCase();
  console.log(`📝 [MOM Request] inviteLink: ${normalizedSessionId}`);

  try {
    const session = await Session.findOne({ inviteLink: normalizedSessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const transcriptText = (session.transcript || [])
      .map(t => `[Speech] ${t.sender}: ${t.text}`)
      .join("\n");

    const chatText = (session.chatMessages || [])
      .map(c => `[Chat] ${c.senderName}: ${c.content}`)
      .join("\n");

    const combinedHistory = `TRANSCRIPT:\n${transcriptText}\n\nCHAT LOG:\n${chatText}`;

    if (!transcriptText && !chatText) {
      return res.status(200).json({ 
        message: "No data", 
        minutesOfMeeting: "No conversation data found to summarize. Please engage in the chat or speak first." 
      });
    }

    if (!genAI) {
      console.error(`[MOM Request] ❌ Configuration Error: genAI not initialized`);
      return res.status(500).json({ message: "AI Configuration missing. Cannot generate MOM." });
    }

    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro"];
    let mom = "";
    
    const prompt = `
      You are an expert executive secretary. Based on the following meeting data (speech transcript and chat logs), generate professional Minutes of Meeting (MOM).
      
      CRITICAL INSTRUCTION:
      The MOM should be generated using the spoken voice/transcript of the AI Bot and the human participants. 
      If the AI Bot is not present in the session, generate the MOM solely on the basis of the human conversation (transcript) and text messages (chat logs).
      
      Include: Executive Summary, Key Discussion Points, Decisions Made, and Action Items.
      
      DATA:
      ${combinedHistory}

      Tone: Professional, concise, and structured. Use Markdown.
    `;

    for (const modelName of modelsToTry) {
      try {
        console.log(`📝 Trying ${modelName} for MOM...`);
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
        mom = result.response.text();
        if (mom) break;
      } catch (err) {
        console.error(`⚠️ ${modelName} MOM failed:`, err.message);
      }
    }

    if (!mom) {
      return res.status(500).json({ message: "Failed to generate MOM from all AI models." });
    }


    session.minutesOfMeeting = mom;
    await session.save();

    res.json({ message: "MOM generated", minutesOfMeeting: mom });
  } catch (error) {
    console.error("🔥 [MOM Error]:", error.message);
    res.status(500).json({ message: "MOM generation failed", error: error.message });
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

    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro"];
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

