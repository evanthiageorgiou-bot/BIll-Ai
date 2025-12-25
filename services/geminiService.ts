
import { GoogleGenAI, GenerateContentResponse, Modality, LiveServerMessage } from "@google/genai";
import { Message, Role } from "../types";

const TEXT_MODEL = 'gemini-3-flash-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const VIDEO_MODEL = 'veo-3.1-fast-generate-preview';

export interface GenerationOptions {
  useSearch: boolean;
  useDeepThinking: boolean;
  useImageGen: boolean;
  useVideoGen: boolean;
  attachment?: string; // base64 data
}

export interface LiveCallbacks {
  onAudioData: (base64: string) => void;
  onInterrupted: () => void;
  onClose: () => void;
  onTranscription?: (text: string, isUser: boolean) => void;
  onTurnComplete?: () => void;
}

export class GeminiService {
  private get ai() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY_MISSING");
    }
    return new GoogleGenAI({ apiKey });
  }

  async sendMessage(messages: Message[], options: GenerationOptions) {
    try {
      if (options.useVideoGen) {
        return this.generateVideo(messages[messages.length - 1].content);
      }

      if (options.useImageGen && !options.attachment) {
        return this.generateImage(messages[messages.length - 1].content);
      }

      const contents: any[] = messages.map(msg => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      if (options.attachment) {
        const visionPart = {
          inlineData: {
            mimeType: 'image/jpeg',
            data: options.attachment.split(',')[1] || options.attachment
          }
        };
        const lastContent = contents[contents.length - 1];
        lastContent.parts.unshift(visionPart);
      }

      const tools: any[] = [];
      if (options.useSearch) {
        tools.push({ googleSearch: {} });
      }

      const config: any = {
        systemInstruction: "Το όνομά σου είναι Bill. Είσαι ένας ευγενικός, έξυπνος και φιλικός AI βοηθός. Απαντάς πάντα στα Ελληνικά εκτός αν σου ζητηθεί κάτι άλλο. Χρησιμοποιείς Markdown για τη μορφοποίηση. Αν σου στείλουν εικόνα, την αναλύεις με λεπτομέρεια.",
        temperature: options.useDeepThinking ? 1.0 : 0.7,
        tools: tools.length > 0 ? tools : undefined,
      };

      if (options.useDeepThinking) {
        config.thinkingConfig = { thinkingBudget: 4000 };
      }

      const response = await this.ai.models.generateContent({
        model: TEXT_MODEL,
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

      return { text, sources, imageUrl: undefined, videoUrl: undefined };
    } catch (error: any) {
      this.handleApiError(error);
      throw error;
    }
  }

  private handleApiError(error: any) {
    const message = error.message || "";
    if (message.includes("Permission denied") || message.includes("Requested entity was not found")) {
      console.warn("API Permission error detected. User may need to select a paid project key.");
    }
    console.error("Gemini Service Error:", error);
  }

  private async generateImage(prompt: string) {
    const response = await this.ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [{ text: `Generate a beautiful image based on this description: ${prompt}` }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    let imageUrl: string | undefined;
    let text = "Ορίστε η εικόνα που σχεδίασα για εσένα:";

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      } else if (part.text) {
        text = part.text;
      }
    }

    return { text, sources: [], imageUrl, videoUrl: undefined };
  }

  private async generateVideo(prompt: string) {
    let operation = await this.ai.models.generateVideos({
      model: VIDEO_MODEL,
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await this.ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    const videoUrl = URL.createObjectURL(blob);

    return { 
      text: "Το κινηματογραφικό βίντεο είναι έτοιμο!", 
      sources: [], 
      imageUrl: undefined, 
      videoUrl 
    };
  }

  async textToSpeech(text: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: `Say clearly in Greek: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");
    return base64Audio;
  }

  async connectLive(callbacks: LiveCallbacks) {
    return this.ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
        systemInstruction: "Το όνομά σου είναι Bill. Είσαι σε ζωντανή φωνητική συνομιλία. Να είσαι σύντομος και φιλικός. Μίλα πάντα Ελληνικά.",
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => console.log("Live connection opened"),
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            callbacks.onAudioData(message.serverContent.modelTurn.parts[0].inlineData.data);
          }
          if (message.serverContent?.interrupted) {
            callbacks.onInterrupted();
          }
          if (message.serverContent?.outputTranscription) {
            callbacks.onTranscription?.(message.serverContent.outputTranscription.text, false);
          }
          if (message.serverContent?.inputTranscription) {
            callbacks.onTranscription?.(message.serverContent.inputTranscription.text, true);
          }
          if (message.serverContent?.turnComplete) {
            callbacks.onTurnComplete?.();
          }
        },
        onerror: (e) => console.error("Live error", e),
        onclose: () => callbacks.onClose(),
      }
    });
  }
}

export const geminiService = new GeminiService();
