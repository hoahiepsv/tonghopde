
import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun } from "docx";
import { fetchTikzImage } from "../services/krokiService";
import { runPythonPlot } from "../services/pythonService";

const getImageDimensions = (blob: Blob): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth || 300;
            const h = img.naturalHeight || 300;
            resolve({ width: w, height: h });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve({ width: 300, height: 200 });
        img.src = URL.createObjectURL(blob);
    });
};

const base64ToBlob = async (base64: string): Promise<Blob> => {
    const res = await fetch(base64);
    if (!res.ok) throw new Error("Failed to decode base64");
    return await res.blob();
}

export const generateDocx = async (content: string): Promise<Blob> => {
  const children: Paragraph[] = [];
  // Trim content to remove leading/trailing whitespace/newlines from AI response
  const lines = content.trim().split('\n');
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimLine = line.trim();

    if (trimLine.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = trimLine.replace('```', '').trim().toLowerCase();
        codeBlockContent = [];
        continue;
      } else {
        inCodeBlock = false;
        const fullCode = codeBlockContent.join('\n');
        
        // --- HANDLE TIKZ (Legacy Support) ---
        if (codeLanguage === 'tikz' || (codeLanguage === 'latex' && fullCode.includes('tikzpicture'))) {
           const placeholder = new Paragraph({ text: "" });
           children.push(placeholder); 
           try {
               const imageBlob = await fetchTikzImage(fullCode, 'svg');
               if (imageBlob) {
                 const buffer = await imageBlob.arrayBuffer();
                 const dimensions = await getImageDimensions(imageBlob);
                 const MAX_WIDTH = 450;
                 let finalWidth = dimensions.width > 0 ? dimensions.width : 300;
                 let finalHeight = dimensions.height > 0 ? dimensions.height : 300;
                 if (finalWidth > MAX_WIDTH) {
                     const ratio = MAX_WIDTH / finalWidth;
                     finalWidth = MAX_WIDTH;
                     finalHeight = Math.round(finalHeight * ratio);
                 }
                 children.pop(); 
                 children.push(new Paragraph({
                     children: [ new ImageRun({ data: buffer, transformation: { width: finalWidth, height: finalHeight }, type: "svg" }) ],
                     alignment: AlignmentType.CENTER, spacing: { after: 200 }
                 }));
               } else { throw new Error("Blob is null"); }
           } catch (err) {
             // Fallback: Just print code if render fails, no error label
             children.pop();
             fullCode.split('\n').forEach(l => children.push(new Paragraph({ children: [new TextRun({ text: l, font: "Courier New", size: 20 })] })));
           }
        } 
        // --- HANDLE PYTHON ---
        else if (codeLanguage === 'python') {
            const placeholder = new Paragraph({ text: "" });
            children.push(placeholder);
            try {
                // Execute Python code to get image
                const base64Img = await runPythonPlot(fullCode);
                const blob = await base64ToBlob(base64Img);
                const buffer = await blob.arrayBuffer();
                const dimensions = await getImageDimensions(blob);
                const MAX_WIDTH = 450;
                let finalWidth = dimensions.width || 400;
                let finalHeight = dimensions.height || 300;
                
                if (finalWidth > MAX_WIDTH) {
                    const ratio = MAX_WIDTH / finalWidth;
                    finalWidth = MAX_WIDTH;
                    finalHeight = Math.round(finalHeight * ratio);
                }

                children.pop();
                children.push(new Paragraph({
                    children: [ new ImageRun({ data: buffer, transformation: { width: finalWidth, height: finalHeight }, type: "png" }) ],
                    alignment: AlignmentType.CENTER, spacing: { after: 200 }
                }));
            } catch (err) {
                console.error("Error running python in export", err);
                // Fallback: Just print code if render fails
                children.pop();
                fullCode.split('\n').forEach(l => children.push(new Paragraph({ children: [new TextRun({ text: l, font: "Courier New", size: 20 })] })));
            }
        }
        else {
            fullCode.split('\n').forEach(l => children.push(new Paragraph({ children: [new TextRun({ text: l, font: "Courier New", size: 20, color: "555555" })] })));
        }
        continue;
      }
    }

    if (inCodeBlock) { codeBlockContent.push(line); continue; }

    // Check for Markdown Image (Base64) - Manual Crop
    const imgRegex = /^!\[(.*?)\]\((data:image\/.*?;base64,.*?)\)$/;
    const imgMatch = trimLine.match(imgRegex);

    if (imgMatch) {
        try {
            const blob = await base64ToBlob(imgMatch[2]);
            const buffer = await blob.arrayBuffer();
            const dimensions = await getImageDimensions(blob);
            const isSvg = imgMatch[2].startsWith('data:image/svg+xml');
            
            const MAX_WIDTH = 450;
            let finalWidth = dimensions.width || 300;
            let finalHeight = dimensions.height || 200;
            if (finalWidth > MAX_WIDTH) {
                const ratio = MAX_WIDTH / finalWidth;
                finalWidth = MAX_WIDTH;
                finalHeight = Math.round(finalHeight * ratio);
            }

            children.push(new Paragraph({
                children: [ new ImageRun({ data: buffer, transformation: { width: finalWidth, height: finalHeight }, type: isSvg ? "svg" : "png" }) ],
                alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }
            }));
            continue; 
        } catch (e) { continue; }
    }

    if (trimLine === '') { children.push(new Paragraph({ text: "" })); continue; }

    // Formatting rules - keep clean
    if (line.startsWith('# ')) {
      children.push(new Paragraph({ children: [ new TextRun({ text: line.replace('# ', ''), font: "Times New Roman", size: 26, bold: true }) ], alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 } }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ children: [ new TextRun({ text: line.replace('## ', ''), font: "Times New Roman", size: 26, bold: true }) ], spacing: { before: 240, after: 120 } }));
    } else {
      children.push(new Paragraph({ children: [ new TextRun({ text: line, font: "Times New Roman", size: 26 }) ], spacing: { after: 120 } }));
    }
  }

  // Footer: Copyright
  children.push(new Paragraph({ children: [ new TextRun({ text: "Biên soạn: Lê Hoà Hiệp (0983.676.470)", italics: true, size: 26, color: "444444", font: "Times New Roman" }) ], alignment: AlignmentType.RIGHT, spacing: { before: 400 } }));

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 }, size: { width: 11906, height: 16838 } } },
        children: children,
      },
    ],
  });

  return await Packer.toBlob(doc);
};
