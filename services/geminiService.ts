
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Role } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

export interface GenerationOptions {
  useSearch: boolean;
  useDeepThinking: boolean;
}

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found in environment.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async sendMessage(messages: Message[], options: GenerationOptions) {
    try {
      const contents = messages.map(msg => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const tools: any[] = [];
      if (options.useSearch) {
        tools.push({ googleSearch: {} });
      }

      const config: any = {
        systemInstruction: "Το όνομά σου είναι Bill. Είσαι ένας ευγενικός, έξυπνος και φιλικός AI βοηθός. Απαντάς πάντα στα Ελληνικά εκτός αν σου ζητηθεί κάτι άλλο. Χρησιμοποιείς Markdown για τη μορφοποίηση.",
        temperature: options.useDeepThinking ? 1.0 : 0.7,
        tools: tools.length > 0 ? tools : undefined,
      };

      if (options.useDeepThinking) {
        // Higher thinking budget for complex tasks in Gemini 3
        config.thinkingConfig = { thinkingBudget: 4000 };
      }

      // We'll use generateContent for full results including grounding metadata
      const response = await this.ai.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
        config: config
      });

      const text = response.text || "";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title,
          uri: chunk.web.uri
        })) || [];

      return { text, sources };
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
