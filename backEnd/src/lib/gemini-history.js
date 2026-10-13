// Gemini requires history to start with a "user" turn and to alternate roles.
// We drop any leading model turns and merge consecutive turns from the same role
// (which can happen if an earlier answer failed after the question was saved).
export function toGeminiHistory(messages) {
  const contents = [];

  for (const message of messages) {
    const role = message.role === "assistant" ? "model" : "user";
    if (!contents.length && role === "model") continue;

    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${message.content}`;
    } else {
      contents.push({ role, parts: [{ text: message.content }] });
    }
  }

  return contents;
}
