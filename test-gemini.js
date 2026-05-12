require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Using API Key starting with:", apiKey.substring(0, 8));
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const testModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];
  
  for (const modelName of testModels) {
    try {
      console.log(`Testing ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Say 'Ready'");
      console.log(`✅ ${modelName} is working! Response: ${result.response.text()}`);
      return; // Exit if one works
    } catch (error) {
      console.error(`❌ ${modelName} failed: ${error.message}`);
    }
  }
}

testModels();
