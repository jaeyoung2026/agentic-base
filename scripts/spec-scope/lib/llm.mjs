/**
 * LLM client — supports Gemini.
 */
export async function callLLM(prompt, content, { model = "gemini-3-flash-preview" } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set. Add to .env.local");

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: {
      maxOutputTokens: 32000,
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const result = await m.generateContent(`${prompt}\n\n---\n\n${content}`);
  const text = result.response.text();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]);
    throw new Error("Failed to parse LLM JSON response");
  }
}
