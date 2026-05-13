import { GoogleGenAI } from "@google/genai";

// Standard Google AI Studio Gemini API Key provided by user
const API_KEY = "AIzaSyB8A103MGGGdMRsxgr6ECB4uIndSHeewssAIzaSyB8A103MGGGdMRsxgr6ECB4uIndSHeewss";

export const ai = new GoogleGenAI({ apiKey: API_KEY });
