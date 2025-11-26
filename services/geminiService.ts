
import { GoogleGenAI } from "@google/genai";
import { GeminiModel } from '../types';
import { fileToBase64 } from '../utils/fileHelpers';

export const analyzeImage = async (apiKey: string, file: File): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToBase64(file);
  
  const prompt = `
  Bạn là một chuyên gia số hoá tài liệu giáo dục và đồ hoạ toán học. 
  Nhiệm vụ: Chuyển đổi hình ảnh/PDF đầu vào thành văn bản Markdown + LaTeX + TikZ với độ chính xác tuyệt đối.

  QUY TẮC BẤT KHẢ XÂM PHẠM:

  1. **VĂN BẢN & CÔNG THỨC (TEXT/MATH):**
     - **CHÉP NGUYÊN VĂN**: Không thêm bớt, không sửa lỗi chính tả của đề gốc.
     - **LATEX**: Chỉ dùng $...$ cho công thức toán (x, y, f(x), \alpha). Không dùng cho văn bản thường.
     - Ví dụ: "Cho tam giác $ABC$" (Đúng), "$Cho$ $tam$ $giác$ $ABC$" (Sai).

  2. **HÌNH VẼ TIKZ (QUAN TRỌNG NHẤT - PHẢI GIỐNG 99.9%):**
     - **Mục tiêu**: Hình vẽ TikZ phải là "bản sao kỹ thuật số" của hình gốc.
     - **Yêu cầu chi tiết**:
       + **HÌNH HỌC PHẲNG**: Bắt buộc dùng \`tkz-euclide\`. 
         * Xác định tọa độ các điểm phải chuẩn tỷ lệ (Ví dụ: M là trung điểm AB thì code phải vẽ đúng trung điểm).
         * Ký hiệu góc vuông, góc bằng nhau, đoạn thẳng bằng nhau: Phải có đầy đủ nếu hình gốc có (dùng \`tkzMarkRightAngle\`, \`tkzMarkAngle\`, \`tkzMarkSegment\`).
         * Nhãn điểm (Label): Vị trí (trên/dưới/trái/phải) phải y hệt hình gốc.
       + **ĐỒ THỊ HÀM SỐ**: Dùng \`pgfplots\` hoặc vẽ thủ công bằng \`plot\`. 
         * Độ cong, chiều biến thiên, giao điểm với trục Ox/Oy, các điểm cực trị phải khớp hoàn toàn với hình ảnh.
       + **HÌNH KHÔNG GIAN**: Dùng nét đứt (dashed) cho đường khuất, nét liền (solid) cho đường thấy. Đây là lỗi hay sai nhất, hãy kiểm tra kỹ.
     - **Output**: Chỉ trả về code trong block \`\`\`tikz ... \`\`\`.

  3. **ĐỊNH DẠNG**:
     - Không nói nhảm, vào thẳng nội dung.
     - Giữ nguyên cấu trúc xuống dòng của đề bài.

  Hãy xử lý hình ảnh đính kèm:
  `;

  try {
    const modelId = GeminiModel.PRO; 
    
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
        thinkingConfig: { thinkingBudget: 4096 } // Max budget for precision
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const refineTikzCode = async (apiKey: string, file: File, currentCode: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToBase64(file);

  const prompt = `
  Nhiệm vụ: SỬA MÃ TIKZ ĐỂ GIỐNG HỆT HÌNH ẢNH GỐC.
  
  Mã hiện tại đang có sai sót so với hình ảnh đính kèm. Bạn hãy đóng vai một "máy photocopy chạy bằng code":
  
  Mã hiện tại:
  \`\`\`latex
  ${currentCode}
  \`\`\`

  YÊU CẦU CHỈNH SỬA CHI TIẾT:
  1. **Nét vẽ**: Kiểm tra từng đường thẳng. Đường nào trong ảnh là Nét Đứt (dashed) mà code đang vẽ Nét Liền? Sửa ngay lập tức.
  2. **Tọa độ & Tỷ lệ**: Hình vẽ có bị méo không? Các điểm có đúng vị trí tương đối không? (VD: Đường cao có thực sự vuông góc không?)
  3. **Ký hiệu**: Hình gốc có ký hiệu góc vuông, gạch chéo đoạn thẳng bằng nhau không? Thêm vào ngay (dùng tkz-euclide).
  4. **Font chữ & Nhãn**: Các điểm A, B, C, ... có nằm đúng phía như trong ảnh không?
  
  Hãy trả về toàn bộ mã TikZ đã sửa (bao gồm cả môi trường tikzpicture) trong block \`\`\`tikz ... \`\`\`.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GeminiModel.PRO,
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
        thinkingConfig: { thinkingBudget: 4096 } // High budget for detailed visual analysis
      }
    });
    
    // Extract code block
    const text = response.text || "";
    const match = text.match(/```(?:tikz|latex)?([\s\S]*?)```/);
    return match ? match[1].trim() : text.trim();
  } catch (error) {
    console.error("Refine TikZ Error:", error);
    throw error;
  }
};
