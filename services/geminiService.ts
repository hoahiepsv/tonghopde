
import { GoogleGenAI } from "@google/genai";
import { AiModel, ContentPart } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

// Helper để lấy API Key ưu tiên từ tham số truyền vào, sau đó là env
const getAI = (apiKey?: string) => {
  const finalKey = apiKey || process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey: finalKey });
};

export const callGemini = async (
  modelName: AiModel,
  files: { data: string; mimeType: string }[],
  shouldSolve: boolean,
  apiKey?: string
): Promise<string> => {
  const ai = getAI(apiKey);
  
  const fileParts = files.map(f => ({
    inlineData: {
      data: f.data.split(',')[1],
      mimeType: f.mimeType
    }
  }));

  const solvePrompt = shouldSolve 
    ? "\n\nYÊU CẦU: Sau khi trích xuất xong, hãy giải chi tiết toàn bộ các bài tập trên và đặt sau thẻ [[SOLUTION_START]]."
    : "\n\nYÊU CẦU: Chỉ trích xuất nội dung nguyên bản, tuyệt đối không giải hay thêm bớt từ ngữ.";

  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        ...fileParts,
        { text: "Hãy thực hiện trích xuất nội dung từ tài liệu này theo đúng định dạng yêu cầu." + solvePrompt }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1,
    }
  });

  return response.text || "";
};

export const refinePlotCode = async (currentCode: string, feedback: string, apiKey?: string): Promise<string> => {
  const ai = getAI(apiKey);
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Mã Python hiện tại: \n${currentCode}\n\nYêu cầu chỉnh sửa: ${feedback}\n\nHãy trả về mã Python mới trong block [[GEOMETRY_CODE]].`,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });
  const match = response.text?.match(/\[\[GEOMETRY_CODE\]\]([\s\S]*?)\[\[\/GEOMETRY_CODE\]\]/);
  return match ? match[1].trim() : currentCode;
};

export const refinePrompt = async (currentPrompt: string, feedback: string, apiKey?: string): Promise<string> => {
  const ai = getAI(apiKey);
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Prompt hiện tại: \n${currentPrompt}\n\nYêu cầu chỉnh sửa: ${feedback}\n\nHãy trả về prompt tiếng Anh mới trong block [[AI_IMAGE_PROMPT]].`,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });
  const match = response.text?.match(/\[\[AI_IMAGE_PROMPT\]\]([\s\S]*?)\[\[\/AI_IMAGE_PROMPT\]\]/);
  return match ? match[1].trim() : currentPrompt;
};

export const generateAiImage = async (prompt: string, apiKey?: string): Promise<string> => {
  const ai = getAI(apiKey);
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Create a professional educational illustration: ${prompt}` }]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return "";
};

export const parseContent = (text: string): ContentPart[] => {
  const parts: ContentPart[] = [];
  const mainSplit = text.split('[[SOLUTION_START]]');
  const mainContent = mainSplit[0];
  const solutionContent = mainSplit[1] ? `\n\n# ĐÁP ÁN & LỜI GIẢI CHI TIẾT\n\n${mainSplit[1]}` : "";
  const fullProcessedText = mainContent + (solutionContent ? `[[IS_SOLUTION]]${solutionContent}` : "");

  const regex = /\[\[(GEOMETRY_CODE|AI_IMAGE_PROMPT)\]\]([\s\S]*?)\[\[\/\1\]\]|\[\[IS_SOLUTION\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(fullProcessedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: fullProcessedText.substring(lastIndex, match.index) });
    }
    
    if (match[0] === '[[IS_SOLUTION]]') {
        parts.push({ type: 'text', content: "", isSolutionStart: true } as any);
    } else {
        const type = match[1];
        const content = match[2].trim();
        if (type === 'GEOMETRY_CODE') {
          parts.push({ type: 'python', code: content });
        } else {
          parts.push({ type: 'image_prompt', prompt: content });
        }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < fullProcessedText.length) {
    parts.push({ type: 'text', content: fullProcessedText.substring(lastIndex) });
  }

  return parts;
};
