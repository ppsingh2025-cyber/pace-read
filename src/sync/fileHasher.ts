/**
 * fileHasher
 * Web Worker wrapper for non-blocking SHA-256 hashing of the first 1MB of a file.
 */

export async function hashFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/hash.worker.ts', import.meta.url), {
      type: 'module',
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      worker.postMessage({ fileBuffer: buffer }, [buffer]);
    };
    reader.onerror = () => {
      worker.terminate();
      reject(new Error('Failed to read file for hashing'));
    };

    worker.onmessage = (e: MessageEvent<{ hash: string; fileSize: number }>) => {
      worker.terminate();
      // Combine hash with file size for extra uniqueness
      resolve(`${e.data.hash}-${e.data.fileSize}`);
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    reader.readAsArrayBuffer(file);
  });
}
