
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Loader2, Send, Copy, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { refinePlotCode } from '../services/geminiService';
import ImageCropper from './ImageCropper';

interface PythonPlotProps {
  code: string;
  sourceFiles: { name: string; base64: string }[];
  apiKey?: string;
  onImageGenerated?: (base64: string) => void;
}

const PythonPlot: React.FC<PythonPlotProps> = ({ code: initialCode, sourceFiles, apiKey, onImageGenerated }) => {
  const [code, setCode] = useState(initialCode);
  const [imgData, setImgData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFileSelect, setShowFileSelect] = useState(false);
  const [croppingFile, setCroppingFile] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pyodideRef = useRef<any>(null);

  const cleanCode = (rawCode: string) => {
    // Remove markdown code fences if present
    return rawCode.replace(/```python/g, '').replace(/```/g, '').trim();
  };

  const runPython = async (targetCode: string) => {
    setIsLoading(true);
    setError(null);
    const cleaned = cleanCode(targetCode);
    
    try {
      if (!pyodideRef.current) {
        // @ts-ignore
        pyodideRef.current = await window.loadPyodide();
        await pyodideRef.current.loadPackage(['matplotlib', 'numpy']);
      }

      const wrapperCode = `
import matplotlib.pyplot as plt
import numpy as np
import io
import base64

plt.clf()
plt.close('all')
fig = plt.figure(figsize=(8, 6))

# Execute AI code
try:
    ${cleaned.split('\n').map(line => '    ' + line).join('\n').trimStart()}
except Exception as e:
    print(f"Python Error: {e}")
    raise e

# Intelligent post-processing
# Check if content is statistical or geometry
code_content = """${cleaned}"""
is_3d = 'projection=\\'3d\\'' in code_content
is_statistical = any(k in code_content for k in ['bar(', 'pie(', 'axhline', 'hist('])

if is_3d:
    # Standard 3D view if not specified
    if 'view_init' not in code_content:
        for ax in fig.get_axes():
            if hasattr(ax, 'view_init'):
                ax.view_init(elev=20, azim=45)
else:
    if not is_statistical:
        plt.axis('equal')
        plt.axis('off')
        plt.grid(False)
    else:
        plt.tight_layout()

buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', dpi=200, facecolor='white')
buf.seek(0)
img_str = base64.b64encode(buf.read()).decode('utf-8')
"data:image/png;base64," + img_str
      `;

      const result = await pyodideRef.current.runPythonAsync(wrapperCode);
      setImgData(result);
      if (onImageGenerated) onImageGenerated(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!feedback.trim()) return;
    setIsRefining(true);
    try {
      const newCode = await refinePlotCode(code, feedback, apiKey);
      setCode(newCode);
      setFeedback('');
      setShowFeedback(false);
      await runPython(newCode);
    } catch (err) {
      setError("Không thể vẽ lại hình.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleCropComplete = (croppedBase64: string) => {
    setImgData(croppedBase64);
    setCroppingFile(null);
    setShowFileSelect(false);
    if (onImageGenerated) onImageGenerated(croppedBase64);
  };

  useEffect(() => {
    runPython(code);
  }, [code]);

  return (
    <div className="my-6 border rounded-2xl bg-white overflow-hidden shadow-lg border-blue-50">
      {croppingFile && (
        <ImageCropper 
          imageSrc={croppingFile} 
          onCrop={handleCropComplete} 
          onCancel={() => setCroppingFile(null)} 
        />
      )}
      
      <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <ImageIcon className="w-3 h-3" /> Vẽ Hình Học & Đồ Thị (Python)
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
            <RefreshCw className={`w-3 h-3 ${isRefining ? 'animate-spin' : ''}`} /> VẼ LẠI / CHỈNH SỬA
          </button>
        </div>
      </div>

      {showFeedback && (
        <div className="p-4 bg-blue-50/50 border-b flex gap-2 animate-in slide-in-from-top duration-300">
          <input 
            type="text" 
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Ví dụ: 'Thêm góc vuông tại A', 'Xoay camera 3D'..."
            className="flex-1 bg-white border border-blue-100 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
          />
          <button 
            onClick={handleRefine}
            disabled={isRefining || !feedback.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}

      <div className="p-8 flex flex-col items-center justify-center min-h-[250px] bg-white">
        {isLoading && !imgData && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-sm text-slate-400 font-bold tracking-widest uppercase">Đang thực thi mã Python...</p>
          </div>
        )}
        {error && (
           <div className="w-full">
             <p className="text-red-500 text-xs font-bold mb-2">Lỗi Syntax/Runtime Python:</p>
             <div className="text-red-500 text-[10px] font-mono p-4 bg-red-50 rounded-xl w-full overflow-auto max-h-[150px]">{error}</div>
             <button onClick={() => runPython(code)} className="mt-4 text-[10px] font-bold text-blue-600 underline">Thử chạy lại</button>
           </div>
        )}
        {imgData && !isLoading && (
          <div className="relative group">
            <img src={imgData} alt="Python Generated Plot" className="max-w-full h-auto rounded-xl shadow-inner border border-slate-50" />
          </div>
        )}
      </div>
    </div>
  );
};

export default PythonPlot;
