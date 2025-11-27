
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessedFile, GeminiModel } from './types';
import { analyzeImage, refineCode } from './services/geminiService';
import { downloadFile } from './utils/fileHelpers';
import { generateDocx } from './utils/docxExport';
import { fetchTikzImage } from './services/krokiService';
import { runPythonPlot, generatePythonPlotBlob } from './services/pythonService';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Settings, 
  CheckCircle, 
  Loader2, 
  Download, 
  AlertCircle,
  Image as ImageIcon,
  Key,
  RefreshCw,
  Scissors,
  X,
  Check,
  Plus,
  RotateCcw,
  Zap,
  BrainCircuit
} from 'lucide-react';

/* --- CUSTOM CROPPER COMPONENT USING CROPPER.JS --- */
interface CropModalProps {
    file: File | null;
    onClose: () => void;
    onConfirm: (base64Svg: string) => void;
}

const CropModal: React.FC<CropModalProps> = ({ file, onClose, onConfirm }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const cropperRef = useRef<Cropper | null>(null);

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setImgSrc(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    useEffect(() => {
        if (imgRef.current && imgSrc) {
            cropperRef.current = new Cropper(imgRef.current, {
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.5,
                responsive: true,
                background: false,
            });
        }
        return () => {
            if (cropperRef.current) {
                cropperRef.current.destroy();
                cropperRef.current = null;
            }
        };
    }, [imgSrc]);

    const handleConfirm = () => {
        if (cropperRef.current) {
            const canvas = cropperRef.current.getCroppedCanvas();
            if (canvas) {
                const pngBase64 = canvas.toDataURL('image/png');
                const width = canvas.width;
                const height = canvas.height;
                const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                    <image href="${pngBase64}" width="${width}" height="${height}" />
                </svg>`;
                const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
                onConfirm(svgBase64);
            }
        }
    };

    if (!file || !imgSrc) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Scissors className="w-5 h-5" />
                        Chụp lại hình gốc (Thay thế hình vẽ AI)
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full">
                        <X className="w-6 h-6 text-slate-500" />
                    </button>
                </div>
                <div className="flex-grow overflow-hidden bg-slate-800 flex items-center justify-center relative p-4">
                     <div className="max-w-full max-h-[60vh]">
                         <img ref={imgRef} src={imgSrc} alt="Source" style={{ maxWidth: '100%' }} />
                     </div>
                </div>
                <div className="p-4 border-t bg-white flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">Hủy</button>
                    <button onClick={handleConfirm} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center gap-2"><Check className="w-4 h-4" /> Xác nhận & Chèn</button>
                </div>
            </div>
        </div>
    );
};

/* --- PYTHON PLOT VIEW COMPONENT --- */
interface PythonViewProps {
    code: string;
    apiKey?: string;
    modelId: string;
    originalFile?: File;
    onCodeUpdate?: (newCode: string) => void;
    onManualCropRequest?: () => void;
}

const PythonView: React.FC<PythonViewProps> = ({ code, apiKey, modelId, originalFile, onCodeUpdate, onManualCropRequest }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        let active = true;
        const run = async () => {
            setLoading(true);
            setError(false);
            try {
                const dataUrl = await runPythonPlot(code);
                if (active) setImageUrl(dataUrl);
            } catch (e) {
                if (active) setError(true);
            } finally {
                if (active) setLoading(false);
            }
        };
        run();
        return () => { active = false; };
    }, [code]);

    const handleRegenerate = async () => {
        if (!apiKey || !originalFile || !onCodeUpdate) return;
        setRegenerating(true);
        try {
            const newCode = await refineCode(apiKey, originalFile, code, modelId);
            if (newCode && newCode !== code) onCodeUpdate(newCode);
            else alert("AI nhận thấy hình vẽ đã khá chính xác.");
        } catch (e) {
            alert("Lỗi khi vẽ lại hình.");
        } finally {
            setRegenerating(false);
        }
    };

    const handleDownload = async (format: 'png' | 'svg' | 'pdf') => {
        setDownloading(true);
        try {
            const blob = await generatePythonPlotBlob(code, format);
            downloadFile(blob, `hinh_ve_python_${Date.now()}.${format}`);
        } catch (e) {
            console.error(e);
            alert(`Lỗi tải file ${format.toUpperCase()}`);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="flex flex-col items-center my-6 bg-white rounded-lg border border-slate-200 shadow-sm break-inside-avoid overflow-hidden">
            <div className="p-6 w-full flex justify-center bg-white min-h-[150px]">
                {loading ? (
                    <div className="text-slate-500 text-sm flex items-center"><Loader2 className="animate-spin w-4 h-4 mr-2" /> Đang chạy Python (Matplotlib)...</div>
                ) : error || !imageUrl ? (
                    <div className="w-full text-center text-red-500 text-sm">
                        Lỗi chạy code Python. <br/>
                        <div className="text-left bg-slate-50 p-2 mt-2 text-xs font-mono overflow-auto max-h-32 text-slate-700">{code}</div>
                    </div>
                ) : (
                    <img src={imageUrl} alt="Python Plot" className="max-w-full h-auto" />
                )}
            </div>
            <div className="w-full bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap justify-between items-center gap-3">
                 <div className="flex items-center gap-2">
                     {!loading && !error && (
                         <>
                            <button onClick={() => handleDownload('png')} disabled={downloading} className="px-2 py-1 text-xs border bg-white rounded hover:bg-slate-100 flex items-center text-slate-600">PNG</button>
                            <button onClick={() => handleDownload('svg')} disabled={downloading} className="px-2 py-1 text-xs border bg-white rounded hover:bg-slate-100 flex items-center text-slate-600">SVG</button>
                            <button onClick={() => handleDownload('pdf')} disabled={downloading} className="px-2 py-1 text-xs border bg-white rounded hover:bg-slate-100 flex items-center text-slate-600">PDF</button>
                         </>
                     )}
                 </div>
                 <div className="flex gap-2">
                    {onCodeUpdate && (
                         <button onClick={handleRegenerate} disabled={regenerating} className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition">
                             {regenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>} Vẽ lại
                         </button>
                    )}
                    {onManualCropRequest && (
                         <button onClick={onManualCropRequest} className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded transition">
                             <Scissors className="w-3 h-3"/> Cắt ảnh gốc
                         </button>
                    )}
                 </div>
            </div>
        </div>
    );
};

/* --- TIKZ VIEW COMPONENT --- */
interface TikzViewProps {
    code: string;
    apiKey?: string;
    modelId: string;
    originalFile?: File;
    onCodeUpdate?: (newCode: string) => void;
    onManualCropRequest?: () => void;
}

const TikzView: React.FC<TikzViewProps> = ({ code, apiKey, modelId, originalFile, onCodeUpdate, onManualCropRequest }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let active = true;
        let objectUrl: string | null = null;
        const load = async () => {
            setLoading(true); setError(false);
            try {
                const blob = await fetchTikzImage(code, 'svg');
                if (active) {
                    if (blob) { objectUrl = URL.createObjectURL(blob); setImageUrl(objectUrl); } 
                    else setError(true);
                }
            } catch (e) { if (active) setError(true); } 
            finally { if (active) setLoading(false); }
        };
        load();
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [code, retryCount]);

    const handleDownloadSvg = async () => {
        setDownloading(true);
        try {
            const blob = await fetchTikzImage(code, 'svg');
            if (blob) downloadFile(blob, `hinh_ve_tikz_${Date.now()}.svg`);
        } catch(e) { alert("Lỗi tải ảnh"); }
        finally { setDownloading(false); }
    };

    const handleRegenerate = async () => {
        if (!apiKey || !originalFile || !onCodeUpdate) return;
        setRegenerating(true);
        try {
            const newCode = await refineCode(apiKey, originalFile, code, modelId);
            if (newCode && newCode !== code) onCodeUpdate(newCode);
            else alert("AI không thay đổi hình.");
        } catch(e) { alert("Lỗi khi vẽ lại."); } 
        finally { setRegenerating(false); }
    };

    return (
        <div className="flex flex-col items-center my-6 bg-white rounded-lg border border-slate-200 shadow-sm break-inside-avoid overflow-hidden">
            <div className="p-6 w-full flex justify-center bg-white min-h-[150px]">
                {(error || !imageUrl) ? (
                    <div className="w-full text-center">
                        <div className="text-red-500 text-sm mb-3 font-medium">Lỗi hiển thị hình TikZ.</div>
                        <div className="bg-slate-50 p-3 rounded border text-xs text-left font-mono overflow-auto max-h-[150px] text-slate-600 w-full">{code}</div>
                    </div>
                ) : (
                    <img src={imageUrl} alt="TikZ Diagram" className="max-w-full h-auto" />
                )}
            </div>
            <div className="w-full bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                    {error ? (
                        <button onClick={() => setRetryCount(c => c + 1)} className="flex items-center text-blue-600 hover:underline"><RotateCcw className="w-3 h-3 mr-1" /> Thử lại</button>
                    ) : <span className="text-slate-500 font-medium px-2 py-1 bg-white border rounded">TikZ (SVG)</span>}
                </div>
                <div className="flex items-center gap-2">
                    {!error && imageUrl && (
                        <button onClick={handleDownloadSvg} disabled={downloading} className="px-3 py-1.5 text-xs border rounded hover:bg-slate-50 flex items-center"><Download className="w-3 h-3 mr-1"/> Tải SVG</button>
                    )}
                    {onCodeUpdate && (
                        <button onClick={handleRegenerate} disabled={regenerating} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1">{regenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>} Vẽ lại</button>
                    )}
                    {onManualCropRequest && (
                        <button onClick={onManualCropRequest} className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1"><Scissors className="w-3 h-3"/> Cắt ảnh gốc</button>
                    )}
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(true);
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(GeminiModel.FLASH);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<{fileId: string, originalFile: File, codeToReplace: string} | null>(null);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) { setApiKey(storedKey); setShowKeyInput(false); }
  }, []);

  const saveApiKey = () => {
    if (apiKey.trim()) { localStorage.setItem('gemini_api_key', apiKey); setShowKeyInput(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: ProcessedFile[] = Array.from(e.target.files).map((file: File) => ({
        id: Math.random().toString(36).substring(7),
        originalFile: file,
        status: 'idle'
      }));
      setFiles(prev => [...prev, ...newFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => { setFiles(prev => prev.filter(f => f.id !== id)); };

  const processFiles = async () => {
    if (!apiKey) { alert("Vui lòng nhập API Key."); setShowKeyInput(true); return; }
    setIsProcessing(true);
    const updatedFiles = [...files];
    for (let i = 0; i < updatedFiles.length; i++) {
        if (updatedFiles[i].status === 'success') continue;
        updatedFiles[i].status = 'processing';
        setFiles([...updatedFiles]);
        try {
            const content = await analyzeImage(apiKey, updatedFiles[i].originalFile, selectedModel);
            updatedFiles[i].status = 'success';
            updatedFiles[i].extractedContent = content;
        } catch (error: any) {
            updatedFiles[i].status = 'error';
            updatedFiles[i].errorMsg = error.message || "Lỗi xử lý";
        }
        setFiles([...updatedFiles]);
    }
    setIsProcessing(false);
  };

  const updateFileContent = (fileId: string, oldCode: string, newCode: string) => {
    setFiles(prev => prev.map(f => {
        if (f.id === fileId && f.extractedContent) {
            return { ...f, extractedContent: f.extractedContent.replace(oldCode, newCode) };
        }
        return f;
    }));
  };

  const openCropModal = (fileId: string, file: File, code: string) => {
      setCropTarget({ fileId, originalFile: file, codeToReplace: code });
      setCropModalOpen(true);
  };

  const handleCropConfirm = (base64Svg: string) => {
      if (cropTarget) {
          const newContent = `\n![Hình cắt thủ công](${base64Svg})\n`;
          updateFileContent(cropTarget.fileId, cropTarget.codeToReplace, newContent);
          setCropModalOpen(false);
          setCropTarget(null);
      }
  };

  const exportToWord = async () => {
    const successfulFiles = files.filter(f => f.status === 'success' && f.extractedContent);
    if (successfulFiles.length === 0) { alert("Chưa có nội dung."); return; }
    let combinedContent = "";
    successfulFiles.forEach((f, i) => {
      combinedContent += f.extractedContent + "\n\n";
      if (i < successfulFiles.length - 1) combinedContent += "\n\n"; 
    });
    try {
        const blob = await generateDocx(combinedContent);
        downloadFile(blob, "Tong_Hop_De.docx");
    } catch (e) { console.error(e); alert("Lỗi xuất file Word."); }
  };

  const markdownComponents = (file?: ProcessedFile) => ({
      code({node, inline, className, children, ...props}: any) {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match ? match[1] : '';
          const codeString = String(children).replace(/\n$/, '');

          const isTikz = lang === 'tikz' || (lang === 'latex' && codeString.includes('tikzpicture'));
          const isPython = lang === 'python';

          if (!inline && isTikz) {
              return <TikzView 
                  code={codeString} apiKey={apiKey} modelId={selectedModel} originalFile={file?.originalFile}
                  onCodeUpdate={file ? (newCode) => updateFileContent(file.id, codeString, newCode) : undefined}
                  onManualCropRequest={file ? () => openCropModal(file.id, file.originalFile, codeString) : undefined}
              />;
          }

          if (!inline && isPython) {
               return <PythonView 
                  code={codeString} apiKey={apiKey} modelId={selectedModel} originalFile={file?.originalFile}
                  onCodeUpdate={file ? (newCode) => updateFileContent(file.id, codeString, newCode) : undefined}
                  onManualCropRequest={file ? () => openCropModal(file.id, file.originalFile, codeString) : undefined}
               />
          }

          return <div className="my-4 p-3 bg-gray-800 text-gray-100 rounded text-xs font-mono overflow-auto">{children}</div>
      },
      img: ({node, ...props}: any) => (
          <div className="flex justify-center my-4">
              <img {...props} className="max-h-[400px] object-contain border rounded shadow-sm" alt="Illustration"/>
          </div>
      )
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <header className="bg-blue-700 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FileText className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">TỔNG HỢP ĐỀ TỪ HÌNH ẢNH</h1>
              <p className="text-xs text-blue-200 font-medium">Bản quyền: Lê Hoà Hiệp (0983.676.470)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-blue-800/50 rounded-lg p-1 flex items-center border border-blue-600">
                 <div className="flex items-center px-2 text-xs text-blue-200 gap-1"><BrainCircuit className="w-3 h-3"/>Model:</div>
                 <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-white focus:outline-none p-1 cursor-pointer"
                 >
                     <option value={GeminiModel.FLASH} className="text-slate-800">Flash (Nhanh/Tiết kiệm)</option>
                     <option value={GeminiModel.PRO} className="text-slate-800">Pro (Thông minh hơn)</option>
                 </select>
             </div>
             <button onClick={() => setShowKeyInput(!showKeyInput)} className="p-2 hover:bg-blue-600 rounded-full"><Settings className="w-6 h-6" /></button>
          </div>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8">
        {showKeyInput && (
          <div className="mb-8 bg-white p-6 rounded-xl shadow-md border border-blue-100">
            <div className="flex items-center space-x-2 mb-4 text-blue-700"><Key className="w-5 h-5" /><h2 className="font-semibold text-lg">Cấu hình API Key</h2></div>
            <div className="flex gap-4">
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Nhập API Key..." className="flex-grow p-3 border rounded focus:ring-2 focus:ring-blue-500 outline-none" />
              <button onClick={saveApiKey} className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 flex items-center gap-2"><Check className="w-4 h-4" /> Lưu Key</button>
            </div>
          </div>
        )}

        <div className="mb-8">
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 transition group">
            <div className="bg-blue-100 rounded-full p-4 mb-4 group-hover:bg-blue-200"><Upload className="w-8 h-8 text-blue-600" /></div>
            <p className="text-lg font-medium text-blue-800">{files.length === 0 ? "Chọn hình ảnh/PDF" : "Thêm file khác"}</p>
            <input type="file" multiple accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          </div>
        </div>

        {files.length > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow sticky top-20 z-40">
            <div className="flex items-center gap-3"><h2 className="font-bold">Danh sách ({files.length})</h2><button onClick={() => fileInputRef.current?.click()} className="text-sm bg-slate-100 px-3 py-1 rounded-full"><Plus className="w-4 h-4 mr-1 inline"/>Thêm</button></div>
            <div className="flex gap-3">
                <button onClick={processFiles} disabled={isProcessing} className={`flex items-center px-6 py-2 rounded text-white ${isProcessing ? 'bg-slate-400' : 'bg-green-600 hover:bg-green-700'}`}>{isProcessing ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}Chuyển đổi</button>
                <button onClick={exportToWord} className="flex items-center px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700"><Download className="w-5 h-5 mr-2" />Xuất Word</button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {files.map((file) => (
            <div key={file.id} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-4 flex justify-between items-center border-b">
                <div className="flex items-center space-x-3">
                  {file.originalFile.type.includes('pdf') ? <FileText className="text-red-500 w-5 h-5"/> : <ImageIcon className="text-blue-500 w-5 h-5"/>}
                  <span className="font-medium truncate max-w-md">{file.originalFile.name}</span>
                  {file.status === 'processing' && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Đang xử lý</span>}
                  {file.status === 'success' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Hoàn thành</span>}
                  {file.status === 'error' && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Lỗi</span>}
                </div>
                <button onClick={() => removeFile(file.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-100 rounded flex items-center justify-center min-h-[200px] max-h-[400px] overflow-hidden relative">
                    {file.originalFile.type.startsWith('image/') ? <img src={URL.createObjectURL(file.originalFile)} className="max-w-full max-h-full object-contain" alt="Original"/> : <FileText className="w-12 h-12 text-slate-400"/>}
                </div>
                <div className="bg-white border rounded p-4 min-h-[200px] max-h-[400px] overflow-y-auto prose prose-blue prose-sm max-w-none">
                    {file.status === 'processing' && <div className="flex flex-col items-center justify-center h-full text-blue-500"><Loader2 className="animate-spin w-8 h-8 mb-2"/><p>Đang phân tích...</p></div>}
                    {file.status === 'success' && file.extractedContent && <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents(file)}>{file.extractedContent}</ReactMarkdown>}
                    {file.status === 'error' && <div className="text-red-500 text-center">{file.errorMsg}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <footer className="bg-slate-900 text-slate-300 py-6 mt-auto text-center">
          <p className="font-bold text-white">TỔNG HỢP ĐỀ TỪ HÌNH ẢNH</p>
          <p className="text-sm">Bản quyền: <span className="text-blue-400">Lê Hoà Hiệp (0983.676.470)</span></p>
      </footer>
      {cropModalOpen && cropTarget && <CropModal file={cropTarget.originalFile} onClose={() => setCropModalOpen(false)} onConfirm={handleCropConfirm} />}
    </div>
  );
};

export default App;
