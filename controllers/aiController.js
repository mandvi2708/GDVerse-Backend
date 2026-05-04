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
