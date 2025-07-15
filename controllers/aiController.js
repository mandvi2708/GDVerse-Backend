// const { OpenAI } = require('openai'); // or Gemini SDK
// require('dotenv').config();

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// exports.getAISummary = async (req, res) => {
//   try {
//     const { chatHistory } = req.body;

//     const response = await openai.chat.completions.create({
//       model: 'gpt-4',
//       messages: [
//         { role: 'system', content: 'You are a GD evaluator. Provide feedback on user communication, clarity, leadership, and relevance.' },
//         { role: 'user', content: `Here is the group discussion transcript:\n${chatHistory}` }
//       ],
//       temperature: 0.7,
//     });

//     const summary = response.choices[0].message.content;
//     res.status(200).json({ summary });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };
