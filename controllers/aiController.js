const { GoogleGenerativeAI } = require("@google/generative-ai");
const Session = require("../models/Session");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateMOM = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!session.transcript || session.transcript.length === 0) {
      return res.status(400).json({ message: "No transcript available for this session" });
    }

    // Format transcript for the AI
    const transcriptText = session.transcript
      .map((entry) => `${entry.sender}: ${entry.text}`)
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert secretary and meeting assistant. 
      Based on the following meeting transcript, generate a professional Minutes of Meeting (MOM).
      Include:
      1. Meeting Title (Session ID: ${session.inviteLink})
      2. Date and Time
      3. Participants Summary
      4. Key Discussion Points
      5. Decisions Made
      6. Action Items
      
      Transcript:
      ${transcriptText}
    `;

    const result = await model.generateContent(prompt);
    const mom = result.response.text();

    session.minutesOfMeeting = mom;
    await session.save();

    res.json({ message: "MOM generated successfully", minutesOfMeeting: mom });
  } catch (error) {
    console.error("Error generating MOM:", error);
    res.status(500).json({ message: "Error generating MOM", error: error.message });
  }
};

exports.getMOM = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await Session.findOne({ inviteLink: sessionId });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json({ minutesOfMeeting: session.minutesOfMeeting });
  } catch (error) {
    res.status(500).json({ message: "Error fetching MOM", error: error.message });
  }
};

exports.getBotResponse = async (req, res) => {
  const { transcript, botName, isInterviewMode, jobDescription } = req.body;

  try {
    const transcriptStr = (transcript || [])
      .map(t => `${t.senderName || t.sender || 'Unknown'}: ${t.content || t.text || ''}`)
      .join('\n');

    const prompt = `
      You are a professional HR and Technical Interviewer at a top tech company. 
      Context: ${isInterviewMode ? `You are interviewing a candidate for the role: ${jobDescription || 'Software Engineer'}` : "You are a participant in a group discussion."}
      
      Transcript of the conversation so far:
      ${transcriptStr}

      Your Goal:
      ${isInterviewMode 
        ? "1. If the candidate just spoke, briefly acknowledge or evaluate their last answer. 2. Then, ask the NEXT relevant technical or HR question. 3. If the transcript is empty, introduce yourself and ask the first question." 
        : "Contribute a short, insightful point to the discussion."}
      
      Rules:
      - Max 3 sentences.
      - No emojis. 
      - End with a question if interviewing.
    `;

    let model;
    let result;
    
    try {
      model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      result = await model.generateContent(prompt);
    } catch (primaryErr) {
      console.warn('⚠️ gemini-1.5-flash failed, falling back to gemini-pro:', primaryErr.message);
      model = genAI.getGenerativeModel({ model: "gemini-pro" });
      result = await model.generateContent(prompt);
    }

    const responseText = result.response.text();

    if (!responseText) {
      throw new Error("Gemini returned an empty response.");
    }

    res.json({ response: responseText });
  } catch (error) {
    console.error("❌ AI Bot Error Detail:", error);
    res.status(500).json({ 
      message: "AI service failed", 
      error: error.message 
    });
  }
};

exports.getInterviewFeedback = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await Session.findOne({ inviteLink: sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const transcriptText = session.transcript
      .map((entry) => `${entry.sender}: ${entry.text}`)
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      As an expert HR and Technical Evaluator, analyze the following interview transcript.
      Job Role: ${session.jobDescription || "General Candidate"}
      
      Evaluate the candidate on:
      1. Clarity of Thought
      2. Confidence Level
      3. Technical/HR Correctness
      
      Provide a detailed feedback report with a score (out of 10) for each category and an overall recommendation.
      
      Transcript:
      ${transcriptText}
    `;

    const result = await model.generateContent(prompt);
    const feedback = result.response.text();

    res.json({ feedback });
  } catch (error) {
    console.error("Interview Feedback Error:", error);
    res.status(500).json({ error: error.message });
  }
};
