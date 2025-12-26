
import React, { useState, useRef, useEffect } from 'react';
import { Scissors, X, Check, MousePointer2 } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedBase64: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCrop, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImgObj(img);
      const canvas = canvasRef.current;
      if (canvas) {
        // Tỉ lệ hiển thị tối đa 80% màn hình
        const maxWidth = window.innerWidth * 0.8;
        const maxHeight = window.innerHeight * 0.7;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (maxHeight / height) * width;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        draw(img, canvas);
      }
    };
  }, [imageSrc]);

  const draw = (img: HTMLImageElement, canvas: HTMLCanvasElement, rect?: { x: number, y: number, w: number, h: number }) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (rect) {
      // Làm mờ vùng không chọn
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
      ctx.drawImage(img, 
        (rect.x / canvas.width) * img.width, 
        (rect.y / canvas.height) * img.height, 
        (rect.w / canvas.width) * img.width, 
        (rect.h / canvas.height) * img.height,
        rect.x, rect.y, rect.w, rect.h
      );
      
      // Vẽ viền vùng chọn
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.setLineDash([]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !imgObj || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPos({ x, y });

    draw(imgObj, canvas, {
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      w: Math.abs(x - startPos.x),
      h: Math.abs(y - startPos.y)
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const executeCrop = () => {
    if (!imgObj || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      w: Math.abs(currentPos.x - startPos.x),
      h: Math.abs(currentPos.y - startPos.y)
    };

    if (rect.w < 5 || rect.h < 5) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rect.w * 2; // Nhân đôi để giữ độ nét
    tempCanvas.height = rect.h * 2;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.drawImage(imgObj, 
      (rect.x / canvas.width) * imgObj.width, 
      (rect.y / canvas.height) * imgObj.height, 
      (rect.w / canvas.width) * imgObj.width, 
      (rect.h / canvas.height) * imgObj.height,
      0, 0, tempCanvas.width, tempCanvas.height
    );

    onCrop(tempCanvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-full flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2 text-blue-600">
            <Scissors className="w-5 h-5" />
            <h3 className="font-black uppercase tracking-tighter text-sm">Khoanh vùng ảnh tài liệu</h3>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 bg-slate-800 flex items-center justify-center overflow-auto max-h-[70vh]">
          <canvas 
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="cursor-crosshair shadow-2xl border-2 border-white/10"
          />
        </div>

        <div className="px-6 py-4 border-t flex justify-between items-center bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
            <MousePointer2 className="w-3 h-3" /> Dùng chuột quét vùng cần lấy
          </p>
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="px-4 py-2 text-xs font-black text-slate-500 hover:text-slate-800"
            >
              HỦY BỎ
            </button>
            <button 
              onClick={executeCrop}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 shadow-lg shadow-blue-100"
            >
              <Check className="w-4 h-4" /> XÁC NHẬN CẮT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
