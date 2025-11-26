
import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun } from "docx";
import { fetchTikzImage } from "../services/krokiService";

// Helper to get image dimensions to preserve aspect ratio
const getImageDimensions = (blob: Blob): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => {
            resolve({ width: 400, height: 300 }); // Fallback
        }
        img.src = URL.createObjectURL(blob);
    });
};

// Helper to convert base64 string to Blob
const base64ToBlob = async (base64: string): Promise<Blob> => {
    const res = await fetch(base64);
    return await res.blob();
}

export const generateDocx = async (content: string): Promise<Blob> => {
  const children: (Paragraph | ImageRun)[] = [];

  // Advanced Parser: Split by lines but handle code blocks
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimLine = line.trim();

    // Check for Code Block Start
    if (trimLine.startsWith('```')) {
      if (!inCodeBlock) {
        // Start of block
        inCodeBlock = true;
        codeLanguage = trimLine.replace('```', '').trim().toLowerCase();
        codeBlockContent = [];
        continue;
      } else {
        // End of block
        inCodeBlock = false;
        
        // Process the extracted block
        const fullCode = codeBlockContent.join('\n');
        
        if (codeLanguage === 'tikz' || (codeLanguage === 'latex' && fullCode.includes('tikzpicture'))) {
           // It's a TikZ diagram, render it
           children.push(new Paragraph({
               text: "[Đang xử lý hình vẽ TikZ...]",
               alignment: AlignmentType.CENTER,
               spacing: { before: 100, after: 100 },
               italics: true,
               color: "808080"
           })); 

           // Request SVG for high quality output
           const imageBlob = await fetchTikzImage(fullCode, 'svg');
           
           if (imageBlob) {
             const buffer = await imageBlob.arrayBuffer();
             const dimensions = await getImageDimensions(imageBlob);
             
             // Calculate scaled dimensions to fit within Word page (approx 600px width max)
             const MAX_WIDTH = 450;
             let finalWidth = dimensions.width;
             let finalHeight = dimensions.height;

             // Logic to scale down if too big
             if (finalWidth > MAX_WIDTH) {
                 const ratio = MAX_WIDTH / finalWidth;
                 finalWidth = MAX_WIDTH;
                 finalHeight = Math.round(dimensions.height * ratio);
             }

             children.pop(); // Remove placeholder
             children.push(new Paragraph({
                 children: [
                     new ImageRun({
                         data: buffer,
                         transformation: {
                             width: finalWidth,
                             height: finalHeight
                         },
                         type: "svg" // Use SVG for Word
                     })
                 ],
                 alignment: AlignmentType.CENTER,
                 spacing: { after: 200 }
             }));
           } else {
             // Fallback: Print the code if rendering fails
             children.pop();
             children.push(new Paragraph({
                text: "Mã TikZ (Không thể hiển thị hình ảnh - Lỗi chuyển đổi SVG):",
                italics: true,
                color: "FF0000"
             }));
             fullCode.split('\n').forEach(codeLine => {
                 children.push(new Paragraph({
                     children: [new TextRun({ text: codeLine, font: "Courier New", size: 20 })],
                     spacing: { line: 240 }
                 }));
             });
           }
        } else {
            // Normal code block (not tikz)
            fullCode.split('\n').forEach(codeLine => {
                children.push(new Paragraph({
                    children: [new TextRun({ text: codeLine, font: "Courier New", size: 20, color: "555555" })],
                    spacing: { line: 240 }
                }));
            });
        }
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Check for Markdown Image (Base64) - Manual Crop Result
    // Regex to capture: ![alt](data:image/...)
    const imgRegex = /^!\[(.*?)\]\((data:image\/.*?;base64,.*?)\)$/;
    const imgMatch = trimLine.match(imgRegex);

    if (imgMatch) {
        let base64Data = imgMatch[2];
        let isSvg = false;
        
        // Handling SVG Wrapper
        if (base64Data.startsWith('data:image/svg+xml')) {
            isSvg = true;
            // For Docx, we prefer the inner PNG if it's just a wrapper, 
            // BUT if the user wants SVG, we can try to pass the SVG directly.
            // However, the crop tool creates an SVG wrapping a PNG.
            // Docx supports SVG natively now. Let's try passing the SVG blob directly.
        }

        try {
            const blob = await base64ToBlob(base64Data);
            const buffer = await blob.arrayBuffer();
            const dimensions = await getImageDimensions(blob);

            const MAX_WIDTH = 450;
            let finalWidth = dimensions.width;
            let finalHeight = dimensions.height;

            if (finalWidth > MAX_WIDTH) {
                const ratio = MAX_WIDTH / finalWidth;
                finalWidth = MAX_WIDTH;
                finalHeight = Math.round(dimensions.height * ratio);
            }

            children.push(new Paragraph({
                children: [
                    new ImageRun({
                        data: buffer,
                        transformation: {
                            width: finalWidth,
                            height: finalHeight
                        },
                        type: isSvg ? "svg" : "png" 
                    })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 }
            }));
            continue; 
        } catch (e) {
            console.error("Failed to process base64 image in docx", e);
        }
    }

    // Normal Text Processing
    if (trimLine === '') {
      children.push(new Paragraph({ text: "" }));
      continue;
    }

    // Font size 26 = 13pt (standard for VN exams)
    // Font size 28 = 14pt (headers)
    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        children: [
             new TextRun({
                text: line.replace('# ', ''),
                font: "Times New Roman",
                size: 28, // 14pt
                bold: true
             })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120 }
      }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({
        children: [
             new TextRun({
                text: line.replace('## ', ''),
                font: "Times New Roman",
                size: 26, // 13pt
                bold: true
             })
        ],
        spacing: { before: 240, after: 120 }
      }));
    } else {
      children.push(new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Times New Roman",
            size: 26, // 13pt standard
          })
        ],
        spacing: { after: 120 }
      }));
    }
  }

  // Footer
  children.push(
    new Paragraph({
      text: "--- HẾT ---",
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 }
    })
  );
  
  children.push(
    new Paragraph({
        children: [
            new TextRun({
                text: "Biên soạn: Lê Hoà Hiệp (0983.676.470)",
                italics: true,
                size: 22,
                color: "444444",
                font: "Times New Roman"
            })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 200 }
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children as Paragraph[],
      },
    ],
  });

  return await Packer.toBlob(doc);
};
