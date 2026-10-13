// Predictable stand-in for src/lib/gemini.js.
// Special words in the question trigger edge cases:
//   FAIL429 -> rate-limit error, EMPTY -> no text, SLOW -> slow stream (for "Stop").
import { toGeminiHistory } from "../../src/lib/gemini-history.js";

/** Every request sent to the fake model, in Gemini's format. */
export const geminiCalls = [];

export async function* streamAnswer({ history, question, signal }) {
  geminiCalls.push(toGeminiHistory([...history, { role: "user", content: question }]));

  if (question.includes("FAIL429")) {
    const error = new Error("Quota exceeded");
    error.status = 429;
    throw error;
  }
  if (question.includes("EMPTY")) {
    yield { totalTokens: 1 };
    return;
  }

  const delay = question.includes("SLOW") ? 200 : 2;
  const words = `Echo: ${question}`.split(/(?<= )/);
  for (const word of words) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (signal?.aborted) {
      const error = new Error("Aborted");
      error.name = "AbortError";
      throw error;
    }
    yield { text: word };
  }
  yield { totalTokens: 42 };
}

export async function generateTitle(question) {
  return `Title: ${question.slice(0, 20)}`;
}
