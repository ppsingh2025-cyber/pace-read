self.onmessage = async (e: MessageEvent) => {
  const { fileBuffer } = e.data as { fileBuffer: ArrayBuffer };

  // Hash first 1MB only for performance
  const firstMB = fileBuffer.slice(0, 1024 * 1024);
  const hashBuffer = await crypto.subtle.digest('SHA-256', firstMB);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  self.postMessage({ hash: hashHex, fileSize: fileBuffer.byteLength });
};
