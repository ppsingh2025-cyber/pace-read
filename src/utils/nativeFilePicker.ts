/**
 * nativeFilePicker.ts
 *
 * Wraps the native file selection flow for Capacitor builds.
 * On web, this module is never called — the standard <input type="file"> is used.
 *
 * Returns a File object compatible with the existing handleFileSelect pipeline.
 * Supported formats: PDF, EPUB, TXT, MD, DOCX, RTF, SRT, HTML.
 */

/**
 * Opens the native file picker and returns a File object.
 * Returns null if the user cancels.
 *
 * Creates a hidden <input type="file"> and triggers it programmatically.
 * On Android/iOS via Capacitor, this opens the native file manager.
 * The DOM input element is cleaned up in both the change and cancel handlers.
 */
export async function pickNativeFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.epub,.txt,.md,.docx,.rtf,.srt,.html,.htm';
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      document.body.removeChild(input);
      resolve(file);
    });

    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      resolve(null);
    });

    document.body.appendChild(input);
    input.click();
  });
}
