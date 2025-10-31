import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const systemInstruction = `You are a machine that generates JSON. Your sole function is to return a single, valid JSON object based on a topic. Do not add any text or formatting outside the JSON object.

**CRITICAL PARSING DIRECTIVE: ESCAPE ALL INTERNAL DOUBLE QUOTES.**
This is the most important rule. All JSON string values must be valid. If a string's content contains a double quote character ("), it **MUST** be escaped with a backslash (\\"). Failure to do so will break the entire system. This is a non-negotiable, machine-enforced rule.

*   **CORRECT:** {"post_content": "Users say it's \\"extremely bad\\"."}
*   **INCORRECT (WILL CAUSE FAILURE):** {"post_content": "Users say it's "extremely bad"."}

**RESPONSE REQUIREMENTS:**

1.  **JSON ONLY:** Your entire output must be one single, raw, minified JSON object. No markdown, no introductory text, no explanations, nothing before the opening '{' or after the closing '}'.

2.  **DATA SOURCE & SYNTHESIS:**
    *   Use the provided search tool to find and analyze **as close to 40 recent public posts as possible** from twitter.com. Your primary goal is to maximize the number of analyzed posts up to this limit.
    *   **DO NOT copy posts verbatim.** You MUST paraphrase and synthesize the information. Recitation will be blocked.

3.  **FAILURE/NO-DATA SCENARIO:**
    *   If no relevant posts are found, you MUST return this exact JSON object:
{
  "summary": {"total_posts": 0, "overall_sentiment": "Neutral", "positive_percent": 0, "negative_percent": 0, "neutral_percent": 0},
  "posts": []
}

4.  **REQUIRED JSON STRUCTURE:**
    Your response MUST conform to this exact schema:
{
  "summary": {
    "total_posts": "integer: Total number of posts analyzed.",
    "overall_sentiment": "string: 'Positive', 'Negative', or 'Neutral'.",
    "positive_percent": "number: Percentage of positive posts (0-100).",
    "negative_percent": "number: Percentage of negative posts (0-100).",
    "neutral_percent": "number: Percentage of neutral posts (0-100)."
  },
  "posts": [
    {
      "post_content": "string: Concise summary (max 20 words). Paraphrase, do not copy verbatim.",
      "author": "string: The post author (e.g., '@username').",
      "sentiment": "string: 'Positive', 'Negative', or 'Neutral'.",
      "reason": "string: Extremely brief justification (max 5 words)."
    }
  ]
}

**FINAL CHECK:** Before outputting, verify that your response is a single JSON object and that all internal double quotes are correctly escaped. System failure will occur otherwise.`;

const generateContentWithRetry = async (topic: string, maxRetries = 3) => {
  let attempt = 0;
  let delay = 1000;
  while (attempt < maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ parts: [{ text: `Analyze sentiment for: ${topic}` }] }],
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
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