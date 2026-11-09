const MAX_EDGE = 1280;
const MAX_BYTES = 300 * 1024;

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível preparar a foto."));
    }, "image/jpeg", quality);
  });
}

/** Redimensiona no navegador e produz JPEG com até 300 KB. */
export async function compressProofPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    while (true) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Seu navegador não conseguiu preparar a foto.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.84, 0.74, 0.64, 0.54, 0.44, 0.36]) {
        const blob = await canvasBlob(canvas, quality);
        if (blob.size <= MAX_BYTES) {
          const name = file.name.replace(/\.[^.]+$/, "") || "comprovante";
          return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
        }
      }
      if (Math.max(canvas.width, canvas.height) < 320) break;
      scale *= 0.88;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("Não foi possível reduzir a foto para até 300 KB. Tire uma nova foto com menos detalhes.");
}
