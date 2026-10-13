import { GoogleGenAI } from "@google/genai";
import config from "../config/env.js";
import { toGeminiHistory } from "./gemini-history.js";

const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });

const SYSTEM_PROMPT = [
  "You are a helpful, knowledgeable assistant.",
  "Answer clearly and directly. Use Markdown for structure when it helps:",
  "headings, lists, tables, and fenced code blocks with a language tag.",
].join(" ");

// Streams the answer. Yields { text } chunks, then a final { totalTokens }.
export async function* streamAnswer({ history, question, signal }) {
  const contents = toGeminiHistory([...history, { role: "user", content: question }]);

  const stream = await client.models.generateContentStream({
    model: config.gemini.model,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: config.gemini.maxOutputTokens,
      abortSignal: signal,
    },
  });

  let totalTokens = 0;
  for await (const chunk of stream) {
    if (chunk.usageMetadata?.totalTokenCount) {
      totalTokens = chunk.usageMetadata.totalTokenCount;
    }
    const text = chunk.text;
    if (text) yield { text };
  }

  yield { totalTokens };
}

// Creates a short sidebar title for a new chat, like ChatGPT does.
export async function generateTitle(question) {
  const response = await client.models.generateContent({
    model: config.gemini.model,
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
