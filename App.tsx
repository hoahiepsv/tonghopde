
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessedFile } from './types';
import { analyzeImage, refineTikzCode } from './services/geminiService';
import { downloadFile } from './utils/fileHelpers';
import { generateDocx } from './utils/docxExport';
import { fetchTikzImage } from './services/krokiService';
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
  Printer,
  RefreshCw,
  Scissors,
  X,
  Check,
  Edit3,
  Plus,
  RotateCcw
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
                // 1. Get PNG Base64
                const pngBase64 = canvas.toDataURL('image/png');
                
                // 2. Wrap PNG in SVG to satisfy requirement "convert to SVG"
                const width = canvas.width;
                const height = canvas.height;
                const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                    <image href="${pngBase64}" width="${width}" height="${height}" />
                </svg>`;
                
                // 3. Encode SVG to Base64
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
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Xác nhận & Chèn
                    </button>
                </div>
            </div>
        </div>
    );
};


// Component to render TikZ code as an Image
interface TikzViewProps {
    code: string;
    apiKey?: string;
    originalFile?: File;
    onCodeUpdate?: (newCode: string) => void;
    onManualCropRequest?: () => void;
}

const TikzView: React.FC<TikzViewProps> = ({ code, apiKey, originalFile, onCodeUpdate, onManualCropRequest }) => {
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
            setLoading(true);
            setError(false);
            try {
                // Fetch SVG for clear display
                const blob = await fetchTikzImage(code, 'svg');
                if (active) {
                    if (blob) {
                        objectUrl = URL.createObjectURL(blob);
                        setImageUrl(objectUrl);
                    } else {
                        setError(true);
                    }
                }
            } catch (e) {
                if (active) setError(true);
            } finally {
                if (active) setLoading(false);
            }
        };

        load();

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [code, retryCount]);

    const handleDownloadSvg = async () => {
        setDownloading(true);
        try {
            const blob = await fetchTikzImage(code, 'svg');
            if (blob) {
                downloadFile(blob, `hinh_ve_tikz_${Date.now()}.svg`);
            } else {
                alert("Không thể tạo file ảnh SVG. Vui lòng thử lại.");
            }
        } catch (e) {
            alert("Lỗi khi tải ảnh.");
        } finally {
            setDownloading(false);
        }
    };

    const handleRegenerate = async () => {
        if (!apiKey || !originalFile || !onCodeUpdate) return;
        
        setRegenerating(true);
        try {
            const newCode = await refineTikzCode(apiKey, originalFile, code);
            if (newCode && newCode !== code) {
                onCodeUpdate(newCode);
            } else {
                alert("AI nhận thấy hình vẽ đã khá chính xác và không thay đổi gì.");
            }
        } catch (e) {
            console.error(e);
            alert("Lỗi khi vẽ lại hình. Vui lòng kiểm tra API Key.");
        } finally {
            setRegenerating(false);
        }
    };

    // Toolbar displayed below the image
    const renderControls = () => (
        <div className="w-full bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
            
            {/* Left side: Status */}
             <div className="flex items-center gap-2 text-xs">
                {error ? (
                    <div className="flex items-center gap-2">
                         <span className="text-red-600 font-semibold flex items-center bg-red-50 px-2 py-1 rounded border border-red-100">
                            <AlertCircle className="w-3 h-3 mr-1" /> Lỗi render
                        </span>
                        <button 
                            onClick={() => setRetryCount(c => c + 1)}
                            className="flex items-center text-blue-600 hover:underline cursor-pointer"
                        >
                            <RotateCcw className="w-3 h-3 mr-1" /> Thử lại
                        </button>
                    </div>
                ) : (
                    <span className="text-slate-500 font-medium bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                        Hình vẽ TikZ Preview (SVG)
                    </span>
                )}
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2">
                 {!error && imageUrl && (
                    <button 
                        onClick={handleDownloadSvg}
                        disabled={downloading}
                        className="flex items-center justify-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 rounded-md transition shadow-sm"
                        title="Tải ảnh SVG về máy"
                    >
                        {downloading ? <Loader2 className="animate-spin w-3 h-3 mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                        Tải SVG
                    </button>
                )}
                
                {apiKey && originalFile && onCodeUpdate && (
                    <button 
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition"
                        title="Yêu cầu AI vẽ lại hình dựa trên ảnh gốc"
                    >
                        {regenerating ? <Loader2 className="animate-spin w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                        Vẽ lại
                    </button>
                )}

                {originalFile && onManualCropRequest && (
                    <button 
                        onClick={onManualCropRequest}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-sm transition"
                        title="Tự cắt hình từ ảnh gốc để thay thế"
                    >
                        <Scissors className="w-3 h-3" />
                        Cắt ảnh gốc
                    </button>
                )}
            </div>
        </div>
    );

    if (loading) return (
        <div className="flex items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm my-4">
            <Loader2 className="animate-spin w-5 h-5 mr-2" />
            Đang tạo hình mô phỏng từ mã TikZ...
        </div>
    );

    return (
        <div className="flex flex-col items-center my-6 bg-white rounded-lg border border-slate-200 shadow-sm print:border-0 print:shadow-none break-inside-avoid overflow-hidden">
            <div className="p-6 w-full flex justify-center bg-white min-h-[150px]">
                {(error || !imageUrl) ? (
                    <div className="w-full text-center">
                        <div className="text-red-500 text-sm mb-3 font-medium">
                            Không thể hiển thị hình vẽ. Có thể do lỗi mạng hoặc mã TikZ quá phức tạp.
                        </div>
                        <div className="bg-slate-50 p-3 rounded border text-xs text-left font-mono overflow-auto max-h-[150px] text-slate-600 w-full">
                           {code}
                        </div>
                    </div>
                ) : (
                    <img src={imageUrl} alt="TikZ Diagram SVG" className="max-w-full h-auto" />
                )}
            </div>
            {renderControls()}
        </div>
    );
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(true);
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Crop State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<{fileId: string, originalFile: File, codeToReplace: string} | null>(null);

  // Load API Key from localStorage
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setShowKeyInput(false);
    }
  }, []);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey);
      setShowKeyInput(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: ProcessedFile[] = Array.from(e.target.files).map((file: File) => ({
        id: Math.random().toString(36).substring(7),
        originalFile: file,
        status: 'idle'
      }));
      setFiles(prev => [...prev, ...newFiles]);
      
      // Reset input value to allow selecting the same file again immediately
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const processFiles = async () => {
    if (!apiKey) {
      alert("Vui lòng nhập API Key để ứng dụng có thể hoạt động.");
      setShowKeyInput(true);
      return;
    }

    setIsProcessing(true);

    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
        if (updatedFiles[i].status === 'success') continue;

        updatedFiles[i].status = 'processing';
        setFiles([...updatedFiles]);

        try {
            const content = await analyzeImage(apiKey, updatedFiles[i].originalFile);
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
            const updatedContent = f.extractedContent.replace(oldCode, newCode);
            return { ...f, extractedContent: updatedContent };
        }
        return f;
    }));
  };

  // Trigger manual crop modal
  const openCropModal = (fileId: string, file: File, code: string) => {
      setCropTarget({ fileId, originalFile: file, codeToReplace: code });
      setCropModalOpen(true);
  };

  const handleCropConfirm = (base64Svg: string) => {
      if (cropTarget) {
          // Replace the TikZ code block with Markdown Image syntax
          const newContent = `\n![Hình cắt thủ công](${base64Svg})\n`;
          updateFileContent(cropTarget.fileId, cropTarget.codeToReplace, newContent);
          setCropModalOpen(false);
          setCropTarget(null);
      }
  };

  const exportToWord = async () => {
    const successfulFiles = files.filter(f => f.status === 'success' && f.extractedContent);
    if (successfulFiles.length === 0) {
      alert("Chưa có nội dung nào được xử lý thành công.");
      return;
    }

    let combinedContent = "";
    successfulFiles.forEach((f, index) => {
      combinedContent += f.extractedContent + "\n\n";
      if (index < successfulFiles.length - 1) {
          combinedContent += "\n\n"; 
      }
    });

    try {
        const blob = await generateDocx(combinedContent);
        downloadFile(blob, "Tong_Hop_De.docx");
    } catch (e) {
        console.error("Export error", e);
        alert("Có lỗi khi xuất file Word.");
    }
  };

  const exportToPdf = () => {
    const successfulFiles = files.filter(f => f.status === 'success' && f.extractedContent);
    if (successfulFiles.length === 0) {
      alert("Chưa có nội dung nào được xử lý thành công.");
      return;
    }
    window.print();
  };

  const getCombinedContent = () => {
    return files
      .filter(f => f.status === 'success' && f.extractedContent)
      .map(f => f.extractedContent)
      .join('\n\n');
  };

  // Define components for ReactMarkdown
  const markdownComponents = (file?: ProcessedFile) => ({
      code({node, inline, className, children, ...props}: any) {
          const match = /language-(\w+)/.exec(className || '');
          const isTikz = match && (match[1] === 'tikz' || match[1] === 'latex');
          const codeString = String(children).replace(/\n$/, '');

          if (!inline && (isTikz || codeString.includes('\\begin{tikzpicture}'))) {
              return <TikzView 
                  code={codeString} 
                  apiKey={apiKey}
                  originalFile={file?.originalFile}
                  onCodeUpdate={file ? (newCode) => updateFileContent(file.id, codeString, newCode) : undefined}
                  onManualCropRequest={file ? () => openCropModal(file.id, file.originalFile, codeString) : undefined}
              />;
          }

          return (
              <div className="my-4 p-3 bg-gray-800 text-gray-100 rounded-md text-xs font-mono overflow-x-auto">
                  {children}
              </div>
          )
      },
      // Custom renderer for images
      img: ({node, ...props}: any) => (
          <div className="flex justify-center my-4">
              <img 
                  {...props} 
                  className="max-h-[400px] object-contain border border-slate-200 rounded-lg shadow-sm print:shadow-none print:border-0"
                  alt={props.alt || "Hình minh hoạ"}
              />
          </div>
      )
  });

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        
        {/* Header */}
        <header className="bg-blue-700 text-white shadow-lg sticky top-0 z-50 print:hidden">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <FileText className="w-8 h-8" />
              <h1 className="text-xl font-bold tracking-tight">TỔNG HỢP ĐỀ TỪ HÌNH ẢNH</h1>
            </div>
            <button 
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="p-2 hover:bg-blue-600 rounded-full transition-colors flex items-center gap-2"
              title="Cài đặt API Key"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow container mx-auto px-4 py-8 print:hidden">
          
          {/* API Key Section */}
          {showKeyInput && (
            <div className="mb-8 bg-white p-6 rounded-xl shadow-md border border-blue-100 animate-fade-in-down">
              <div className="flex items-center space-x-2 mb-4 text-blue-700">
                <Key className="w-5 h-5" />
                <h2 className="font-semibold text-lg">Cấu hình API Key (Lưu trên máy)</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Để sử dụng ứng dụng khi triển khai trên Vercel/Web, bạn cần nhập Google Gemini API Key của mình. 
                Key sẽ được lưu vào trình duyệt của bạn (Local Storage).
              </p>
              <div className="flex gap-4">
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Nhập API Key (AIzaSy...)"
                  className="flex-grow p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
                <button 
                  onClick={saveApiKey}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium transition shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Lưu Key
                </button>
              </div>
            </div>
          )}

          {/* Upload Section - Modified for sequential adding */}
          <div className="mb-8">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 transition duration-300 group"
            >
              <div className="flex items-center justify-center bg-blue-100 rounded-full p-4 mb-4 group-hover:bg-blue-200 transition">
                 <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-lg font-medium text-blue-800">
                {files.length === 0 ? "Chọn hình ảnh hoặc PDF để bắt đầu" : "Thêm file khác (Chọn liên tiếp)"}
              </p>
              <p className="text-sm text-blue-600 mt-2">Hỗ trợ .png, .jpg, .jpeg, .pdf</p>
              <input 
                type="file" 
                multiple 
                accept="image/*,application/pdf"
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Controls */}
          {files.length > 0 && (
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-20 z-40">
              <div className="flex items-center gap-3">
                 <h2 className="text-xl font-bold text-slate-700">Danh sách file ({files.length})</h2>
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-full transition"
                 >
                    <Plus className="w-4 h-4 mr-1" /> Thêm
                 </button>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                  <button 
                    onClick={processFiles}
                    disabled={isProcessing}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-semibold text-white shadow-md transition ${
                      isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    <span>{isProcessing ? 'Đang xử lý...' : 'Bắt đầu chuyển đổi'}</span>
                  </button>
                  
                  <button 
                    onClick={exportToWord}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition"
                  >
                    <Download className="w-5 h-5" />
                    <span>Xuất Word</span>
                  </button>

                  <button 
                    onClick={exportToPdf}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 shadow-md transition"
                  >
                    <Printer className="w-5 h-5" />
                    <span>In PDF</span>
                  </button>
              </div>
            </div>
          )}

          {/* File List & Results */}
          <div className="space-y-6">
            {files.map((file) => (
              <div key={file.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* File Header */}
                <div className="bg-slate-50 p-4 flex justify-between items-center border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    {file.originalFile.type.includes('pdf') ? (
                      <FileText className="text-red-500 w-5 h-5" />
                    ) : (
                      <ImageIcon className="text-blue-500 w-5 h-5" />
                    )}
                    <span className="font-medium truncate max-w-md">{file.originalFile.name}</span>
                    {file.status === 'processing' && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Đang xử lý</span>}
                    {file.status === 'success' && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Hoàn thành</span>}
                    {file.status === 'error' && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Lỗi</span>}
                  </div>
                  <button onClick={() => removeFile(file.id)} className="text-slate-400 hover:text-red-500 transition">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Content Preview */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Original Preview (Image only) */}
                  <div className="bg-slate-100 rounded-lg p-2 flex items-center justify-center min-h-[200px] max-h-[400px] overflow-hidden relative">
                      {file.originalFile.type.startsWith('image/') ? (
                          <img 
                              src={URL.createObjectURL(file.originalFile)} 
                              alt="Preview" 
                              className="max-w-full max-h-full object-contain"
                          />
                      ) : (
                          <div className="text-center text-slate-500">
                              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p>Xem trước PDF không khả dụng</p>
                          </div>
                      )}
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          Bản gốc
                      </div>
                  </div>

                  {/* Extracted Result */}
                  <div className="bg-white border rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto prose prose-blue prose-sm max-w-none relative">
                      {file.status === 'idle' && (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400">
                              <p>Chờ xử lý...</p>
                          </div>
                      )}
                      {file.status === 'processing' && (
                          <div className="flex flex-col items-center justify-center h-full text-blue-500">
                              <Loader2 className="animate-spin w-8 h-8 mb-2" />
                              <p>Đang đọc hình ảnh & Vẽ lại hình...</p>
                          </div>
                      )}
                      {file.status === 'error' && (
                          <div className="flex flex-col items-center justify-center h-full text-red-500">
                              <AlertCircle className="w-8 h-8 mb-2" />
                              <p>{file.errorMsg}</p>
                          </div>
                      )}
                      {file.status === 'success' && file.extractedContent && (
                          <>
                            <ReactMarkdown 
                                remarkPlugins={[remarkMath]} 
                                rehypePlugins={[rehypeKatex]}
                                components={markdownComponents(file)}
                            >
                                {file.extractedContent}
                            </ReactMarkdown>
                          </>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Helper for Math */}
          {files.length > 0 && (
              <div className="mt-8 text-center text-sm text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p>
                      <strong>Lưu ý:</strong> Công thức toán học hiển thị bằng LaTeX. 
                      Hình vẽ được AI tạo lại bằng TikZ và tự động chuyển sang SVG.
                  </p>
              </div>
          )}

        </main>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-300 py-6 mt-auto print:hidden">
          <div className="container mx-auto px-4 text-center">
            <p className="font-semibold text-white mb-2 uppercase tracking-wide">ỨNG DỤNG TỔNG HỢP ĐỀ TỪ HÌNH ẢNH</p>
            <p className="text-sm mb-1">Bản quyền thuộc về: <span className="text-blue-400 font-bold">Lê Hoà Hiệp</span></p>
            <p className="text-sm">Điện thoại / Zalo: <span className="text-blue-400 font-bold">0983.676.470</span></p>
          </div>
        </footer>

        {/* CROP MODAL */}
        {cropModalOpen && cropTarget && (
            <CropModal 
                file={cropTarget.originalFile} 
                onClose={() => setCropModalOpen(false)}
                onConfirm={handleCropConfirm}
            />
        )}

        {/* --- HIDDEN PRINT AREA (FOR PDF EXPORT) --- */}
        <div id="print-area" className="hidden">
           {files.filter(f => f.status === 'success' && f.extractedContent).length > 0 && (
              <div className="prose max-w-none">
                 <ReactMarkdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents()}
                  >
                      {getCombinedContent()}
                  </ReactMarkdown>
                  
                  <div className="mt-12 text-right border-t pt-4">
                      <p className="italic text-sm text-gray-500">
                          Biên soạn: Lê Hoà Hiệp (0983.676.470)
                      </p>
                  </div>
              </div>
           )}
        </div>
      </div>
    </>
  );
};

export default App;
