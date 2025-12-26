
import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { FileDown, Copy, Check, Eye } from 'lucide-react';
import PythonPlot from './PythonPlot';
import AiGeneratedImage from './AiGeneratedImage';
import { parseContent } from '../services/geminiService';
import { exportToWord } from '../services/wordExport';
import { COPYRIGHT_TEXT } from '../constants';

interface ExamPreviewProps {
  content: string;
  sourceFiles: { name: string; base64: string }[];
  apiKey?: string;
}

const ExamPreview: React.FC<ExamPreviewProps> = ({ content, sourceFiles, apiKey }) => {
  const [copied, setCopied] = useState(false);
  const parts = parseContent(content);
  const imagesRef = useRef<Map<number, string>>(new Map());

  const handleImageGenerated = (index: number, base64: string) => {
    imagesRef.current.set(index, base64);
  };

  const handleExport = () => {
    exportToWord(parts, imagesRef.current);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-full relative">
      {/* Top-Right Copyright Marker */}
      <div className="absolute top-4 right-4 z-10 hidden lg:block">
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter transform rotate-0">
          {COPYRIGHT_TEXT}
        </p>
      </div>

      <div className="bg-slate-50 border-b px-8 py-5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-blue-600" />
          <h3 className="font-black text-slate-700 uppercase tracking-tighter text-sm">Xem trước Tài liệu</h3>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
            {copied ? 'ĐÃ CHÉP' : 'SAO CHÉP'}
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <FileDown className="w-4 h-4" /> XUẤT WORD
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-12 times-new-roman text-[13pt] leading-relaxed overflow-y-auto bg-white custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {parts.map((part, idx) => {
            if (part.type === 'text') {
              return (
                <div key={idx} className="markdown-content text-black">
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      table: ({node, ...props}) => <div className="overflow-x-auto my-6"><table className="border-collapse border border-slate-300 w-full" {...props} /></div>,
                      th: ({node, ...props}) => <th className="border border-slate-300 px-4 py-2 bg-slate-50 font-bold" {...props} />,
                      td: ({node, ...props}) => <td className="border border-slate-300 px-4 py-2" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-4 mt-6 uppercase border-b pb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-3 mt-5" {...props} />,
                    }}
                  >
                    {part.content}
                  </ReactMarkdown>
                </div>
              );
            } else if (part.type === 'python') {
              return <PythonPlot key={idx} code={part.code} sourceFiles={sourceFiles} apiKey={apiKey} onImageGenerated={(b64) => handleImageGenerated(idx, b64)} />;
            } else if (part.type === 'image_prompt') {
              return <AiGeneratedImage key={idx} prompt={part.prompt} sourceFiles={sourceFiles} apiKey={apiKey} onImageGenerated={(b64) => handleImageGenerated(idx, b64)} />;
            }
            return null;
          })}

          <div className="mt-20 pt-8 border-t border-slate-100 text-center">
            <p className="italic text-slate-400 text-xs font-medium tracking-widest">{COPYRIGHT_TEXT}</p>
          </div>
        </div>
      </div>
      <style>{`
        .markdown-content p { margin-bottom: 0.5rem; }
        .times-new-roman { font-family: 'Times New Roman', serif; color: black; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default ExamPreview;
