
import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, RefreshCw, Loader2, Send, Copy, ChevronDown } from 'lucide-react';
import { generateAiImage, refinePrompt } from '../services/geminiService';
import ImageCropper from './ImageCropper';

interface AiGeneratedImageProps {
  prompt: string;
  sourceFiles: { name: string; base64: string }[];
  apiKey?: string;
  onImageGenerated?: (base64: string) => void;
}

const AiGeneratedImage: React.FC<AiGeneratedImageProps> = ({ prompt: initialPrompt, sourceFiles, apiKey, onImageGenerated }) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFileSelect, setShowFileSelect] = useState(false);
  const [croppingFile, setCroppingFile] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = async (targetPrompt: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = await generateAiImage(targetPrompt, apiKey);
      setImgUrl(url);
      if (onImageGenerated) onImageGenerated(url);
    } catch (err: any) {
      setError("Không thể tạo ảnh AI.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!feedback.trim()) return;
    setIsRefining(true);
    try {
      const newPrompt = await refinePrompt(prompt, feedback, apiKey);
      setPrompt(newPrompt);
      setFeedback('');
      setShowFeedback(false);
      await generate(newPrompt);
    } catch (err) {
      setError("Không thể vẽ lại hình.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleCropComplete = (croppedBase64: string) => {
    setImgUrl(croppedBase64);
    setCroppingFile(null);
    setShowFileSelect(false);
    if (onImageGenerated) onImageGenerated(croppedBase64);
  };

  useEffect(() => {
    generate(prompt);
  }, [prompt]);

  return (
    <div className="my-6 border rounded-2xl bg-white overflow-hidden shadow-lg border-blue-50">
      {croppingFile && (
        <ImageCropper 
          imageSrc={croppingFile} 
          onCrop={handleCropComplete} 
          onCancel={() => setCroppingFile(null)} 
        />
      )}
      
      <div className="bg-blue-50 px-4 py-2 border-b flex justify-between items-center">
        <span className="text-xs font-bold text-blue-700 flex items-center gap-2 uppercase tracking-widest">
          <ImageIcon className="w-3.5 h-3.5" /> Minh họa 3D / Sáng tạo
        </span>
        <div className="flex gap-2">
          <div className="relative">
            <button 
              onClick={() => setShowFileSelect(!showFileSelect)}
              className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors border border-emerald-100"
            >
              <Copy className="w-3 h-3" /> KHOANH VÙNG GỐC <ChevronDown className="w-2 h-2" />
            </button>
            {showFileSelect && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-xl shadow-xl z-10 w-48 py-2 animate-in fade-in slide-in-from-top-2">
                {sourceFiles.length === 0 ? (
                  <p className="px-3 py-2 text-[10px] text-gray-400 italic">Chưa có file nào</p>
                ) : (
                  sourceFiles.map((f, i) => (
                    <button 
                      key={i} 
                      onClick={() => setCroppingFile(f.base64)}
                      className="w-full text-left px-3 py-2 text-[10px] hover:bg-slate-50 truncate font-medium text-slate-700"
                    >
                      {f.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowFeedback(!showFeedback)}
            className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors border border-blue-100"
          >
            <RefreshCw className={`w-3 h-3 ${isRefining ? 'animate-spin' : ''}`} /> VẼ LẠI
          </button>
        </div>
      </div>

      {showFeedback && (
        <div className="p-4 bg-indigo-50/50 border-b flex gap-2 animate-in slide-in-from-top duration-300">
          <input 
            type="text" 
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Mô tả thay đổi cho hình ảnh 3D..."
            className="flex-1 bg-white border border-indigo-100 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
          />
          <button 
            onClick={handleRefine}
            disabled={isRefining || !feedback.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}

      <div className="p-8 flex flex-col items-center justify-center min-h-[300px] bg-white">
        {isLoading && !imgUrl && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center animate-bounce mb-6 shadow-xl">
               <ImageIcon className="text-blue-500 w-8 h-8" />
            </div>
            <p className="text-sm text-blue-400 font-bold uppercase tracking-widest animate-pulse">AI đang dựng hình ảnh 3D...</p>
          </div>
        )}
        {error && <div className="text-red-500 text-sm font-bold bg-red-50 p-4 rounded-xl">{error}</div>}
        {imgUrl && !isLoading && (
          <img src={imgUrl} alt="AI Illustration" className="max-w-full h-auto rounded-2xl shadow-2xl border-4 border-white" />
        )}
      </div>
    </div>
  );
};

export default AiGeneratedImage;
