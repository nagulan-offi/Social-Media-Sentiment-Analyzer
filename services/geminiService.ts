import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const systemInstruction = `You are a highly specialized AI assistant that functions exclusively as a JSON API endpoint. Your ONLY task is to process a given topic and return a single, valid JSON object with a sentiment analysis based on recent public posts from twitter.com.

**RESPONSE REQUIREMENTS (ABSOLUTE & NON-NEGOTIABLE):**

1.  **JSON ONLY:** Your entire output MUST be a single, raw, minified JSON object. There should be NO markdown (like \`\`\`json), no introductory text, no summaries outside the JSON, no explanations, no apologies, and no characters of any kind before the opening '{' or after the closing '}'.

2.  **STRICT JSON VALIDITY:** Your response will be parsed by a machine. Any error will cause a total failure.
    *   **CRITICAL RULE FOR DOUBLE QUOTES:** The most common error is failing to escape double quotes inside a string. Any double quote character (") that is part of the text content *inside* a string value **MUST** be escaped with a backslash (\\").
        *   Example of CORRECT formatting: "post_content": "Users say it's \\"the best phone ever\\""
        *   Example of INCORRECT formatting that WILL FAIL: "post_content": "Users say it's "the best phone ever""
    *   Your JSON structure must be 100% perfect. Do not include trailing commas. Ensure all brackets and braces are correctly matched.

3.  **DATA SOURCE & SYNTHESIS:**
    *   Use the provided search tool to find up to 40 recent and relevant public posts from twitter.com. Analyze as many as you can find if 40 are not available.
    *   **DO NOT copy posts verbatim.** You MUST paraphrase and synthesize the information to create a unique analysis. Recitation will be blocked.

4.  **FAILURE/NO-DATA SCENARIO:**
    *   If you find no relevant posts, or if you cannot perform the analysis for any reason, you MUST return this specific JSON object. DO NOT output any error messages or natural language.
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

5.  **REQUIRED JSON STRUCTURE:**
    Your response MUST conform to this exact schema:
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
      "post_content": "string: A very concise summary (maximum 20 words). **Crucially, you must paraphrase and summarize; do NOT copy the entire post verbatim to avoid recitation.**",
      "author": "string: The author of the post (e.g., '@username'). If there are multiple sources, list only the primary one.",
      "sentiment": "string: The sentiment of this specific post ('Positive', 'Negative', 'Neutral').",
      "reason": "string: An extremely brief justification (max 5 words) for the assigned sentiment."
    }
  ]
}

**FINAL WARNING:** The output is processed by an automated system. Any text or formatting outside of the single required JSON object will result in a critical failure. Adhere to these rules without exception.`;

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
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('resource has been exhausted') || errorMessage.includes('Rpc failed')) {
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
    
    if (!response) {
        throw new Error("Received an empty response object from the API.");
    }

    const finishReason = response.candidates?.[0]?.finishReason;

    // Check for explicit blocks (e.g., safety) which result in an empty response text.
    if (response.promptFeedback?.blockReason) {
        throw new Error(`Analysis failed because the request was blocked. Reason: ${response.promptFeedback.blockReason}. This can happen if the topic violates safety policies. Please try a different topic.`);
    }

    // Check for recitation blocks
    if (finishReason === 'RECITATION') {
      console.error("API response was blocked due to recitation. Full response:", JSON.stringify(response, null, 2));
      throw new Error("The analysis was blocked to avoid plagiarism. This can happen when the search results for a topic are very repetitive or directly quoted. Please try a different or broader topic to get a more unique summary.");
    }

    if (!response.text || response.text.trim() === '') {
        console.error("API returned an empty text response. Finish reason:", finishReason, "Full response:", JSON.stringify(response, null, 2));
        throw new Error("The AI returned an empty response. This might be due to a highly restrictive topic, a temporary issue with the service, or if no relevant content could be found. Please try rephrasing your topic or try again later.");
    }
    
    // Check if the response was truncated, which would lead to invalid JSON.
    if (finishReason === 'MAX_TOKENS') {
      console.error("API response was truncated due to token limit. Finish reason:", finishReason, "Full response:", JSON.stringify(response, null, 2));
      throw new Error("The AI's response was too long and was cut short, resulting in incomplete data. This can happen with very broad topics that generate extensive results. Please try again with a more specific topic.");
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
        // This is a JSON parsing error. The model likely returned a non-JSON response or truncated JSON.
        throw new Error("The AI returned an incomplete or malformed response. This can happen if the topic is too broad, ambiguous, or if there's a temporary service issue. Please try rephrasing your topic.");
    }
    
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    if (errorMessage.includes("API key not valid")) {
        throw new Error("Invalid API Key. Please check your configuration.");
    }

    // Pass through custom, user-friendly errors
    if (
        errorMessage.includes("The AI returned a response") ||
        errorMessage.includes("Invalid data structure") ||
        errorMessage.includes("request was blocked") ||
        errorMessage.includes("The AI returned an empty response") ||
        errorMessage.includes("response was too long") ||
        errorMessage.includes("The analysis was blocked to avoid plagiarism")
    ) {
        throw error;
    }

    throw new Error(`Failed to analyze sentiment: ${errorMessage}`);
  }
};