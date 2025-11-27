
declare global {
  interface Window {
    loadPyodide: any;
  }
}

let pyodideInstance: any = null;
let pyodideLoadPromise: Promise<any> | null = null;

export const initPyodide = async () => {
  if (pyodideInstance) return pyodideInstance;
  
  if (!pyodideLoadPromise) {
    pyodideLoadPromise = (async () => {
      console.log("Loading Pyodide...");
      try {
          // Explicitly set indexURL to match the script tag version to prevent version mismatch errors
          const pyodide = await window.loadPyodide({
              indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
          });
          
          // Retry logic for loading packages (fixes "Failed to fetch" on flaky networks)
          const packages = ["numpy", "matplotlib"];
          let attempts = 0;
          const maxAttempts = 3;
          
          while (attempts < maxAttempts) {
              try {
                  await pyodide.loadPackage(packages);
                  // Verify installation by trying to import
                  pyodide.runPython("import matplotlib");
                  break; // Success
              } catch (err) {
                  attempts++;
                  console.warn(`Pyodide package load failed (attempt ${attempts}/${maxAttempts}):`, err);
                  if (attempts >= maxAttempts) {
                      throw new Error("Không thể tải thư viện vẽ hình (matplotlib). Vui lòng kiểm tra kết nối mạng và thử lại.");
                  }
                  // Wait 1.5s before retrying
                  await new Promise(r => setTimeout(r, 1500));
              }
          }

          pyodideInstance = pyodide;
          console.log("Pyodide loaded successfully");
          return pyodide;
      } catch (e) {
          console.error("Failed to load Pyodide", e);
          pyodideLoadPromise = null; // Reset on failure so we can try again
          throw e;
      }
    })();
  }
  
  return pyodideLoadPromise;
};

export const runPythonPlot = async (code: string): Promise<string> => {
  const pyodide = await initPyodide();

  // Create a clean script that saves the plot to a base64 buffer instead of showing it
  // Added safety logic: Resize figure if it's too big (prevent MemoryError in WASM)
  const wrappedCode = `
import matplotlib.pyplot as plt
import io
import base64
import numpy as np

# Clear previous plots
plt.clf()
plt.close('all')

# User code execution
try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"Error executing user code: {e}")
    raise e

# Safety check for figure size to prevent MemoryError (RendererAgg: Out of memory)
try:
    fig = plt.gcf()
    width, height = fig.get_size_inches()
    max_size = 12 # Limit max dimension to 12 inches
    if width > max_size or height > max_size:
        scale = max_size / max(width, height)
        fig.set_size_inches(width * scale, height * scale)
except Exception:
    pass

# Save to buffer
buf = io.BytesIO()
# Reduce DPI slightly to 120 to be safe on WASM memory (150+ can cause crashes on complex plots)
plt.savefig(buf, format='png', bbox_inches='tight', dpi=120)
buf.seek(0)
img_str = base64.b64encode(buf.read()).decode('utf-8')
img_str
`;

  try {
    const result = await pyodide.runPythonAsync(wrappedCode);
    return `data:image/png;base64,${result}`;
  } catch (error) {
    console.error("Python execution error:", error);
    throw error;
  }
};

export const generatePythonPlotBlob = async (code: string, format: 'png' | 'svg' | 'pdf'): Promise<Blob> => {
    const pyodide = await initPyodide();

    const wrappedCode = `
import matplotlib.pyplot as plt
import io
import base64
import numpy as np

# Clear previous plots
plt.clf()
plt.close('all')

# User code execution
try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"Error executing user code: {e}")
    raise e

# Resize logic
try:
    fig = plt.gcf()
    width, height = fig.get_size_inches()
    max_size = 12
    if width > max_size or height > max_size:
        scale = max_size / max(width, height)
        fig.set_size_inches(width * scale, height * scale)
except Exception:
    pass

buf = io.BytesIO()
fmt = '${format}'
# PDF/SVG don't need bbox_inches='tight' usually, but safe to keep for consistency
plt.savefig(buf, format=fmt, bbox_inches='tight')
buf.seek(0)
# Return bytes directly
buf.read()
`;

    try {
        // runPythonAsync returns a PyProxy for bytes, we need to convert it to JS TypedArray
        const result = await pyodide.runPythonAsync(wrappedCode);
        const buffer = result.toJs();
        // Clean up proxy
        result.destroy();
        
        let mimeType = 'image/png';
        if (format === 'svg') mimeType = 'image/svg+xml';
        if (format === 'pdf') mimeType = 'application/pdf';
        
        return new Blob([buffer], { type: mimeType });
    } catch (error) {
        console.error(`Error generating ${format}:`, error);
        throw error;
    }
};
