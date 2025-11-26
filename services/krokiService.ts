
export const fetchTikzImage = async (tikzCode: string, format: 'png' | 'svg' = 'svg'): Promise<Blob | null> => {
    try {
        let cleanCode = tikzCode.trim();
        
        // Remove markdown code blocks if present
        cleanCode = cleanCode
            .replace(/```latex/gi, '')
            .replace(/```tikz/gi, '')
            .replace(/```/g, '')
            .trim();

        // Check for existing document structure
        const hasDocumentClass = cleanCode.includes('\\documentclass');
        
        // Detect usage to optimize package loading (Reduces compile time and timeouts)
        const needs3d = cleanCode.includes('3d') || cleanCode.includes('perspective') || cleanCode.includes('tdplot');
        const needsEuclide = cleanCode.includes('tkz-euclide') || cleanCode.includes('tkzDefPoint');
        const needsTab = cleanCode.includes('tkz-tab');

        let payload = cleanCode;

        // If no document class, wrap it in standalone with dynamic packages
        if (!hasDocumentClass) {
            
            // Clean up: If code contains \usepackage but no documentclass, strip them 
            cleanCode = cleanCode.replace(/\\usepackage\{.*?\}/g, '');

            // Base libs
            const libs = [
                'shapes', 'arrows', 'calc', 'positioning', 'patterns', 
                'intersections', 'quotes', 'decorations.markings', 
                'backgrounds', 'fit', 'through', 'math'
            ];
            
            if (needs3d) libs.push('3d', 'perspective');

            let header = `\\documentclass[border=10pt]{standalone}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{xcolor}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\pgfplotsset{compat=newest}
`;

            if (needsEuclide) header += `\\usepackage{tkz-euclide}\n`;
            if (needsTab) header += `\\usepackage{tkz-tab}\n`;
            if (needs3d) header += `\\usepackage{tikz-3dplot}\n`;

            header += `\\usetikzlibrary{${libs.join(',')}}
\\tikzset{every picture/.style={line width=0.8pt}}
\\tikzset{>=stealth}
\\begin{document}
`;
            
            if (!cleanCode.includes('\\begin{tikzpicture}')) {
                payload = `${header}
\\begin{tikzpicture}
${cleanCode}
\\end{tikzpicture}
\\end{document}`;
            } else {
                payload = `${header}
${cleanCode}
\\end{document}`;
            }
        } else {
             // Ensure standalone is used for correct cropping
             if (payload.includes('\\documentclass{article}')) {
                 payload = payload.replace('\\documentclass{article}', '\\documentclass[border=10pt]{standalone}');
            }
        }

        // Call Kroki API
        const response = await fetch(`https://kroki.io/tikz/${format}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: payload,
            credentials: 'omit', // Helper for CORS in some environments
        });

        if (!response.ok) {
            // Log warning but don't crash
            console.warn(`Kroki rendering failed (${format}): ${response.status}`);
            return null;
        }
        return await response.blob();
    } catch (e) {
        console.warn("Network error fetching TikZ image (likely CORS or Timeout):", e);
        return null;
    }
};
