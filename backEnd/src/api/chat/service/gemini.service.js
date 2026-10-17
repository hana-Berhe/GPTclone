import { GoogleGenAI } from "@google/genai";
import { toGeminiHistory } from "./gemini-history.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 4096;

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = [
  "You are a helpful, knowledgeable assistant.",
  "Answer clearly and directly. Use Markdown for structure when it helps:",
  "headings, lists, tables, and fenced code blocks with a language tag.",
].join(" ");

// Streams the answer. Yields { text } pieces, then a final { totalTokens }.
export async function* streamAnswer({ history, question, signal }) {
  const contents = toGeminiHistory([...history, { role: "user", content: question }]);

  const stream = await client.models.generateContentStream({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      abortSignal: signal,
    },
  });

  let totalTokens = 0;
  for await (const chunk of stream) {
    if (chunk.usageMetadata?.totalTokenCount) {
      totalTokens = chunk.usageMetadata.totalTokenCount;
    }
    if (chunk.text) yield { text: chunk.text };
  }

  yield { totalTokens };
}

// Makes a short sidebar title for a new chat, like ChatGPT does
export async function generateTitle(question) {
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Write a short title (max 6 words) for a chat that starts with the message below. " +
              "Reply with the title only, no quotes or punctuation at the end.\n\n" +
              question.slice(0, 2000),
          },
        ],
      },
    ],
    config: { maxOutputTokens: 30 },
  });

  return (response.text || "")
    .replace(/["*#\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export { GEMINI_MODEL };
