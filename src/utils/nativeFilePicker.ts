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

    let resolved = false;

    const cleanup = () => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };

    const onChange = () => {
      if (resolved) return;
      resolved = true;
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    };

    const onCancel = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(null);
    };

    // Fallback: resolve null if the window regains focus without a file selection
    // (covers browsers/platforms that don't fire the 'cancel' event)
    const onFocusBack = () => {
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      }, 300);
      window.removeEventListener('focus', onFocusBack);
    };

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onFocusBack);

    document.body.appendChild(input);
    input.click();
  });
}
