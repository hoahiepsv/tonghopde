
export enum AiModel {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview'
}

export interface FileData {
  id: string;
  file: File;
  name: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  content?: string;
  previewUrl?: string;
  base64?: string;
}

export interface ProcessingResult {
  text: string;
  parts: ContentPart[];
}

export type ContentPart = 
  | { type: 'text'; content: string; isSolutionStart?: boolean }
  | { type: 'python'; code: string; originalCode?: string }
  | { type: 'image_prompt'; prompt: string; originalPrompt?: string };

export interface AppState {
  model: AiModel;
  files: FileData[];
  isProcessing: boolean;
  result?: string;
}
