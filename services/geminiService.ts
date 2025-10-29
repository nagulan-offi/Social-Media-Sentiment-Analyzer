import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const systemInstruction = `Your primary and ONLY function is to act as a JSON API. You will receive a topic and you MUST respond with a JSON object containing a sentiment analysis of that topic based on recent posts from X (formerly Twitter).

- Your entire response MUST be a single, raw JSON object. Do NOT include any explanatory text, markdown formatting (like \`\`\`json), or anything else outside of the JSON structure.
- Use your search tool to find 20 recent, relevant public posts from twitter.com.
- If you cannot find 20 posts, analyze as many as you can find.
- **CRITICAL:** If you cannot find ANY relevant posts for the given topic, or if you are unable to perform the analysis for any reason, you MUST return the following valid JSON object with empty/zero values, NOT an error message or explanation:
{
  "summary": {
    "total_posts": 0,
    "overall_sentiment": "Neutral",
    "positive_percent": 0,
    "negative_percent": 0,
    "neutral_percent": 0
  },
  "posts": []
}

The JSON object you return must follow this exact structure:
{
  "summary": {
    "total_posts": "integer: The total number of posts analyzed.",
    "overall_sentiment": "string: The overall sentiment ('Positive', 'Negative', or 'Neutral').",
    "positive_percent": "number: The percentage of positive posts (0-100).",
    "negative_percent": "number: The percentage of negative posts (0-100).",
    "neutral_percent": "number: The percentage of neutral posts (0-100)."
  },
  "posts": [
    {
      "post_content": "string: The full content of the post.",
      "author": "string: The author of the post (e.g., '@username').",
      "sentiment": "string: The sentiment of this specific post ('Positive', 'Negative', or 'Neutral').",
      "reason": "string: A brief justification for the assigned sentiment."
    }
  ]
}`;

const generateContentWithRetry = async (topic: string, maxRetries = 3) => {
  let attempt = 0;
  let delay = 1000;
  while (attempt < maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: `Analyze sentiment for: ${topic}` }] }],
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 0 }, // Prioritize speed
        },
      });
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('resource has been exhausted')) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error('Max retries reached. The service is temporarily unavailable.');
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error('An unexpected error occurred after retries.');
};


export const analyzeSentiment = async (topic: string): Promise<AnalysisResult> => {
  if (!topic.trim()) {
    throw new Error("Topic cannot be empty.");
  }
  
  let rawText = ''; // To have it available in the catch block for logging.
  try {
    const response = await generateContentWithRetry(topic);
    
    if (!response || !response.text) {
        throw new Error("Received an empty response from the API.");
    }

    rawText = response.text.trim();
    
    // Attempt to find a JSON object within the response text, even if it's surrounded by other text.
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        // If we can't even find a basic JSON structure, throw an error.
        // Log the actual response for debugging.
        console.error("Malformed response from API (no JSON object found):", rawText);
        throw new Error("The AI returned a response that was not in the expected format. Please try rephrasing your topic.");
    }
    
    const jsonText = rawText.substring(firstBrace, lastBrace + 1);
    
    const result = JSON.parse(jsonText);
    
    // Basic validation
    if (!result.summary || !result.posts) {
        throw new Error("Invalid data structure received from API.");
    }

    return result as AnalysisResult;

  } catch (error) {
    // Log the problematic text from the API for easier debugging
    if (rawText) {
        console.error("Full text from API on error:", rawText);
    }
    console.error("Error analyzing sentiment:", error);

    if (error instanceof SyntaxError) {
        // This is a JSON parsing error. The model likely returned a non-JSON response.
        throw new Error("The AI returned an unexpected response. This can happen if the topic is too niche, ambiguous, or violates safety policies. Please try rephrasing your topic.");
    }
    
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    if (errorMessage.includes("API key not valid")) {
        throw new Error("Invalid API Key. Please check your configuration.");
    }

    // Pass through custom, user-friendly errors
    if (errorMessage.includes("The AI returned a response") || errorMessage.includes("Invalid data structure")) {
        throw error;
    }

    throw new Error(`Failed to analyze sentiment: ${errorMessage}`);
  }
};