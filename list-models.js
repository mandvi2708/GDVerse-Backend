require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Checking available models for key:", apiKey.substring(0, 8) + "...");
  
  try {
    // We use the raw fetch to avoid SDK model-name assumptions
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) {
      console.error("API Error:", data.error.message);
      console.error("Reason:", data.error.status);
    } else {
      console.log("Available Models found:", data.models?.length || 0);
      data.models?.forEach(m => console.log(` - ${m.name} (${m.displayName})`));
    }
  } catch (e) {
    console.error("Connection Error:", e.message);
  }
}

listModels();
