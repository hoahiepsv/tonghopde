import { GoogleGenAI } from "@google/genai";
import { GeminiModel } from '../types';
import { fileToBase64 } from '../utils/fileHelpers';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const makeApiCallWithRetry = async (apiCall: () => Promise<any>, retries = 2) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            console.error(`API attempt ${i + 1} failed:`, error);
            
            // Check for Quota Exceeded (429) - Do not retry immediately, just throw specific error
            if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
                 throw new Error("Lỗi Quota: API Key đã hết hạn ngạch sử dụng. Vui lòng đợi hoặc đổi Key khác.");
            }

            if (i === retries - 1) throw error;
            // Exponential backoff
            await delay(2000 * (i + 1));
        }
    }
};

/**
 * Robustly fixes common Python syntax errors using a character-based state machine.
 * Specifically handles:
 * 1. Newlines inside single/double quoted strings (SyntaxError: unterminated string literal).
 * 2. Stray markdown backticks.
 */
const fixPythonCode = (code: string): string => {
    // 1. Basic cleanup of wrapper markdown
    let clean = code.replace(/```python/g, '').replace(/```/g, '').trim();
    
    // 2. State machine to fix newlines inside single-line strings (' or ")
    let result = '';
    let quoteChar: string | null = null; // Values: ' or " or ''' or """
    let i = 0;
    
    while (i < clean.length) {
        const char = clean[i];
        
        // Handle Escaped Characters (always skip next char check)
        if (char === '\\' && i + 1 < clean.length) {
            result += char + clean[i+1];
            i += 2;
            continue;
        }
        
        // Check for Triple Quotes (Start)
        const isTripleSingle = clean.startsWith("'''", i);
        const isTripleDouble = clean.startsWith('"""', i);
        
        if (quoteChar === null) {
            // Entering a string
            if (isTripleDouble) { quoteChar = '"""'; result += '"""'; i += 3; continue; }
            if (isTripleSingle) { quoteChar = "'''"; result += "'''"; i += 3; continue; }
            if (char === '"') { quoteChar = '"'; result += '"'; i++; continue; }
            if (char === "'") { quoteChar = "'"; result += "'"; i++; continue; }
        } else {
            // Already inside a string - check for closing
            if (quoteChar === '"""' && isTripleDouble) { quoteChar = null; result += '"""'; i += 3; continue; }
            if (quoteChar === "'''" && isTripleSingle) { quoteChar = null; result += "'''"; i += 3; continue; }
            if (quoteChar === '"' && char === '"') { quoteChar = null; result += '"'; i++; continue; }
            if (quoteChar === "'" && char === "'") { quoteChar = null; result += "'"; i++; continue; }
            
            // CRITICAL FIX: If inside a single-line string (' or ") and we hit a newline, replace it with space
            if ((quoteChar === '"' || quoteChar === "'") && char === '\n') {
                result += ' '; // Replace illegal newline with space
                i++;
                continue;
            }
        }
        
        // Regular character
        result += char;
        i++;
    }
    
    return result;
};

export const analyzeImage = async (apiKey: string, file: File, modelId: string = GeminiModel.FLASH): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToBase64(file);
  
  const prompt = `
  Bạn là một chuyên gia số hoá tài liệu giáo dục.
  Nhiệm vụ: Chuyển đổi hình ảnh đầu vào thành văn bản Markdown + LaTeX + Code Python minh hoạ.

  QUY TẮC BẤT KHẢ XÂM PHẠM:

  1. **VĂN BẢN & CÔNG THỨC (TEXT/MATH):**
     - **CHÉP NGUYÊN VĂN**: Chỉ xuất nội dung có trong ảnh. TUYỆT ĐỐI KHÔNG thêm lời dẫn meta (VD: "Đây là nội dung...", "Kết quả:", "Lời giải:", "--- Hết ---").
     - **LATEX**: Dùng $...$ cho toán học.
     - **MŨI TÊN**: Thay \`\\Longrightarrow\` thành \`\\Rightarrow\`, \`\\Longleftarrow\` thành \`\\Leftarrow\`.

  2. **VẼ HÌNH (QUAN TRỌNG - CHỈ DÙNG PYTHON MATPLOTLIB):**
     - **MỤC TIÊU**: Tái tạo hình ảnh với **GÓC NHÌN (PERSPECTIVE)** giống hệt ảnh gốc.
     - **Output**: \`\`\`python ... \`\`\`. Tách từng hình thành block code riêng.
     - **SYNTAX (RẤT QUAN TRỌNG)**:
       - **CẤM XUỐNG DÒNG TRONG CHUỖI**: \`ax.text(x, y, r'$Label$')\` phải viết trên **MỘT DÒNG**.
       - Nếu label dài, hãy viết liền trong chuỗi \`r'...\'\`. KHÔNG ĐƯỢC enter xuống dòng ở giữa hai dấu nháy đơn.
       - ❌ SAI: 
         \`ax.text(x, y, r'$A\`
         \`$')\`
       - ✅ ĐÚNG: \`ax.text(x, y, r'$A$')\`
     
     **Kỹ thuật Matplotlib:**
     - \`fig = plt.figure(figsize=(5, 5))\`.
     - **3D**: \`ax = fig.add_subplot(111, projection='3d')\`. Dùng \`ax.view_init(elev=..., azim=...)\` để xoay camera khớp ảnh.
     - **2D**: \`ax = fig.add_subplot(111)\`. \`plt.axis('equal')\`. Sao chép tọa độ tương đối từ ảnh (đừng vẽ hình đều nếu ảnh gốc bị dẹt/nghiêng).

  3. **ĐỊNH DẠNG**:
     - Chỉ trả về Markdown.
     - Không viết thêm bất kỳ dòng chữ nào ngoài nội dung.

  Hãy xử lý hình ảnh đính kèm:
  `;

  // Reduce thinking budget for Flash to avoid Quota issues
  const isFlash = modelId.includes('flash');
  const budget = isFlash ? 1024 : 4096;

  return await makeApiCallWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
              { text: prompt },
              {
                  inlineData: {
                      mimeType: file.type,
                      data: base64Data
                  }
              }
          ]
        },
        config: {
          thinkingConfig: { thinkingBudget: budget } 
        }
      });

      let text = response.text || "";
      
      const parts = text.split(/(```[\s\S]*?```)/g);
      text = parts.map(part => {
          if (part.startsWith('```')) {
              // Extract the code content inside the backticks
              const match = part.match(/```(?:python)?([\s\S]*?)```/);
              if (match) {
                  const rawCode = match[1];
                  const cleanCode = fixPythonCode(rawCode);
                  return `\`\`\`python\n${cleanCode}\n\`\`\``;
              }
              return part;
          }
          
          // Text processing
          let p = part;
          p = p.replace(/\\Longrightarrow/g, '\\Rightarrow');
          p = p.replace(/\\Longleftarrow/g, '\\Leftarrow');
          p = p.replace(/\{aligned\}/g, '{align}');
          p = p.replace(/Figure/g, 'Hình');
          p = p.replace(/--- HẾT ---/gi, '');
          return p;
      }).join('');

      return text.trim();
  });
};

export const refineCode = async (apiKey: string, file: File, currentCode: string, modelId: string = GeminiModel.FLASH): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToBase64(file);

  const prompt = `
  Nhiệm vụ: TINH CHỈNH CODE PYTHON.
  1. **GÓC NHÌN**: Chỉnh \`ax.view_init\` (3D) hoặc toạ độ (2D) để khớp ảnh gốc.
  2. **SỬA LỖI CÚ PHÁP**: Đảm bảo \`ax.text(..., r'String')\` nằm trên 1 dòng duy nhất. Không xuống dòng trong chuỗi.

  Mã hiện tại:
  \`\`\`python
  ${currentCode}
  \`\`\`
  
  Trả về mã Python đã sửa.
  `;

  return await makeApiCallWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [ { text: prompt }, { inlineData: { mimeType: file.type, data: base64Data } } ]
      },
      config: { thinkingConfig: { thinkingBudget: modelId.includes('flash') ? 1024 : 4096 } }
    });
    
    const text = response.text || "";
    const match = text.match(/```(?:python)?([\s\S]*?)```/);
    let code = match ? match[1].trim() : text.trim();
    
    code = fixPythonCode(code);

    return code;
  });
};