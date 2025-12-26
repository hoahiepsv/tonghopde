
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Cpu, 
  Zap, 
  FileText, 
  Image as ImageIcon, 
  Send, 
  Loader2, 
  AlertCircle,
  FileSearch,
  CheckCircle2,
  BrainCircuit,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Key,
  Save,
  Edit3
} from 'lucide-react';
import { AiModel, FileData } from './types';
import { callGemini } from './services/geminiService';
import ExamPreview from './components/ExamPreview';
import { APP_NAME, COPYRIGHT_TEXT, LOGO_SVG } from './constants';

const App: React.FC = () => {
  const [model, setModel] = useState<AiModel>(AiModel.FLASH);
  const [shouldSolve, setShouldSolve] = useState(false);
  const [files, setFiles] = useState<FileData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // API Key state
  const [apiKey, setApiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) {
      setApiKey(savedKey);
      setIsKeySaved(true);
    }
  }, []);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', apiKey.trim());
      setIsKeySaved(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []) as File[];
    const newFilesPromises = uploadedFiles.map(async (file: File) => {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        type: file.type,
        status: 'pending' as const,
        previewUrl: file.type.startsWith('image/') ? base64 : undefined,
        base64
      };
    });

    const newFiles = await Promise.all(newFilesPromises);
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const processFiles = async () => {
    if (files.length === 0) {
      setError("Hãy tải lên ít nhất một tập tin.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const fileData = files.map(f => ({ 
        data: f.base64 as string, 
        mimeType: f.file.type || 'application/pdf'
      }));

      const activeKey = apiKey || process.env.API_KEY || '';
      const response = await callGemini(model, fileData, shouldSolve, activeKey);
      setResult(response);
    } catch (err: any) {
      setError("Lỗi xử lý AI: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-2xl">
            {LOGO_SVG}
          </div>
          <div>
            <h1 className="text-xl font-black text-blue-900 tracking-tighter">
              {APP_NAME}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hoà Hiệp AI v3.2</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:block text-right">
            <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest">
              {COPYRIGHT_TEXT}
            </p>
          </div>
          <div className="h-10 w-[1px] bg-slate-100 hidden md:block"></div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setModel(AiModel.FLASH)}
               className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex flex-col items-center leading-none gap-1 ${model === AiModel.FLASH ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               <Zap className="w-3 h-3" /> 
               <span>FLASH</span>
               <span className="text-[8px] opacity-60">NHANH</span>
             </button>
             <button 
               onClick={() => setModel(AiModel.PRO)}
               className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex flex-col items-center leading-none gap-1 ${model === AiModel.PRO ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
               <Cpu className="w-3 h-3" /> 
               <span>PRO</span>
               <span className="text-[8px] opacity-60">THÔNG MINH</span>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
        {/* Settings & Upload */}
        <div className="lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* API Key Section */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-blue-50 animate-in fade-in slide-in-from-left duration-500">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-blue-500" />
              <h2 className="font-black uppercase tracking-tighter text-slate-700">Cấu hình API Key</h2>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="password"
                  value={apiKey}
                  disabled={isKeySaved}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Nhập Gemini API Key..."
                  className={`w-full px-4 py-3 rounded-2xl text-sm border transition-all outline-none ${isKeySaved ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-blue-100 focus:ring-2 focus:ring-blue-500'}`}
                />
                {isKeySaved && <div className="absolute right-4 top-1/2 -translate-y-1/2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>}
              </div>
              <button 
                onClick={() => isKeySaved ? setIsKeySaved(false) : saveApiKey()}
                className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${isKeySaved ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-none' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'}`}
              >
                {isKeySaved ? <><Edit3 className="w-4 h-4" /> CHỈNH SỬA</> : <><Save className="w-4 h-4" /> LƯU</>}
              </button>
            </div>
            {!isKeySaved && <p className="mt-2 text-[10px] text-slate-400 italic">API Key được lưu an toàn trong trình duyệt.</p>}
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-blue-50">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                <h2 className="font-black uppercase tracking-tighter text-slate-700">Tùy chỉnh AI</h2>
              </div>
              <Sparkles className="w-4 h-4 text-blue-200" />
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl transition-all ${shouldSolve ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-400 border border-slate-100'}`}>
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-black text-sm text-slate-700 tracking-tight">Giải chi tiết đề bài</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tạo trang đáp án riêng</p>
                </div>
              </div>
              <button 
                onClick={() => setShouldSolve(!shouldSolve)}
                className="transition-transform active:scale-90"
              >
                {shouldSolve ? (
                  <ToggleRight className="w-12 h-12 text-blue-600" />
                ) : (
                  <ToggleLeft className="w-12 h-12 text-slate-200" />
                )}
              </button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-blue-50">
            <div className="flex items-center gap-2 mb-6">
              <FileSearch className="w-5 h-5 text-blue-500" />
              <h2 className="font-black uppercase tracking-tighter text-slate-700">Tài liệu đầu vào</h2>
            </div>

            <div 
              className="border-4 border-dashed border-blue-50 rounded-3xl p-10 text-center hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer group mb-6"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input id="file-upload" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleFileUpload} />
              <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-100 group-hover:scale-110 transition-transform">
                <Plus className="text-blue-600 w-8 h-8" />
              </div>
              <p className="font-black text-slate-700 text-sm tracking-tight uppercase">Thêm tài liệu mới</p>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Hỗ trợ PDF, Image, Word</p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map(file => (
                <div key={file.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-blue-100 hover:bg-white transition-all shadow-sm">
                  <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-700 truncate tracking-tight">{file.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Sẵn sàng</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                    className="p-2 bg-white text-slate-300 hover:text-red-500 rounded-xl transition-all shadow-sm opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button 
              disabled={isProcessing || files.length === 0}
              onClick={processFiles}
              className={`w-full mt-8 py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-sm tracking-widest shadow-xl transition-all transform active:scale-95 ${
                isProcessing || files.length === 0
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  ĐANG PHÂN TÍCH...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  BẮT ĐẦU XỬ LÝ
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 text-[11px] font-black rounded-2xl flex items-center gap-3 animate-in fade-in">
                <AlertCircle className="shrink-0 w-4 h-4" />
                <span className="uppercase tracking-tight">{error}</span>
              </div>
            )}
          </section>
        </div>

        {/* Preview Content */}
        <div className="lg:col-span-8 overflow-hidden h-full flex flex-col">
          {!result && !isProcessing && (
            <div className="bg-white h-full rounded-[40px] shadow-sm border border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-32 h-32 bg-blue-50 rounded-[40px] flex items-center justify-center mb-8 rotate-3 shadow-inner">
                <FileSearch className="w-16 h-16 text-blue-200" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tighter">Khu vực Xem trước</h2>
              <p className="text-slate-400 text-sm max-w-xs font-bold leading-relaxed">Vui lòng tải lên tài liệu để bắt đầu quy trình chuyển đổi.</p>
            </div>
          )}

          {isProcessing && (
            <div className="bg-white h-full rounded-[40px] shadow-sm border border-blue-50 flex flex-col items-center justify-center p-12 text-center animate-in fade-in">
              <div className="relative mb-12 scale-125">
                <div className="w-24 h-24 border-[6px] border-slate-50 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <BrainCircuit className="text-blue-600 w-10 h-10 animate-pulse" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-6 uppercase tracking-tighter">AI đang suy nghĩ</h2>
              <div className="space-y-6 max-w-sm w-full">
                <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden shadow-inner">
                   <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 animate-[loading_2s_infinite]"></div>
                </div>
                <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest animate-pulse">
                  {model === AiModel.PRO ? 'Đang phân tích dữ liệu chuyên sâu...' : 'Đang xử lý nhanh tài liệu...'}
                </p>
              </div>
            </div>
          )}

          {result && !isProcessing && (
            <div className="h-full animate-in fade-in zoom-in duration-500">
              <ExamPreview 
                content={result} 
                sourceFiles={files.map(f => ({ name: f.name, base64: f.base64 || '' }))} 
                apiKey={apiKey}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t px-8 py-4 flex justify-between items-center shrink-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{COPYRIGHT_TEXT}</p>
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Hoà Hiệp AI &copy; 2025</p>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-1.5 rounded-full">{COPYRIGHT_TEXT}</p>
        </div>
      </footer>

      <style>{`
        @keyframes loading {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
