
export interface ProcessedFile {
  id: string;
  originalFile: File;
  status: 'idle' | 'processing' | 'success' | 'error';
  extractedContent?: string; // Markdown/LaTeX content
  errorMsg?: string;
}

export interface AppConfig {
  apiKey: string;
}

export enum GeminiModel {
  PRO = 'gemini-3-pro-preview',
  FLASH = 'gemini-2.5-flash',
}

// Global definition for Cropper.js loaded via CDN
declare global {
  class Cropper {
    constructor(element: HTMLImageElement, options?: any);
    getCroppedCanvas(options?: any): HTMLCanvasElement;
    destroy(): void;
  }
}