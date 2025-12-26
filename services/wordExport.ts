
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, Footer, PageBreak } from 'docx';
import saveAs from 'file-saver';
import { COPYRIGHT_TEXT } from '../constants';

export const exportToWord = async (contentParts: any[], imagesMap: Map<number, string>) => {
  const children: any[] = [];

  contentParts.forEach((part, index) => {
    if (part.isSolutionStart) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "ĐÁP ÁN & LỜI GIẢI CHI TIẾT",
              font: "Times New Roman",
              size: 32, // 16pt
              bold: true,
            }),
          ],
          spacing: { before: 240, after: 240 },
        })
      );
      return;
    }

    if (part.type === 'text' && part.content) {
      // Clean up math markers for word export if needed, 
      // but docx doesn't support latex, so we keep text clean.
      const lines = part.content.split('\n');
      lines.forEach((line: string) => {
        const isHeader = line.startsWith('#');
        const cleanLine = line.replace(/^#+\s*/, '').trim();
        if (!cleanLine) return;
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanLine,
                font: "Times New Roman",
                size: isHeader ? 28 : 26, // 14pt or 13pt (size is half-points)
                bold: isHeader,
                color: "000000",
              }),
            ],
            spacing: { before: 120, after: 120 },
            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
          })
        );
      });
    } else if (part.type === 'python' || part.type === 'image_prompt') {
      const imgData = imagesMap.get(index);
      if (imgData) {
        try {
          const base64Data = imgData.split(',')[1];
          const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: buffer,
                  transformation: {
                    width: 450,
                    height: 300,
                  },
                }),
              ],
              spacing: { before: 240, after: 240 },
            })
          );
        } catch (e) {
          console.error("Error embedding image:", e);
        }
      }
    }
  });

  const doc = new Document({
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: COPYRIGHT_TEXT,
                    font: "Times New Roman",
                    size: 20, // 10pt
                    italics: true,
                    color: "808080", // Gray
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Tai_Lieu_Tong_Hop_HiepAI.docx");
};
