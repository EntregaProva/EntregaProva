export function hasValidProofSignature(mime: string, bytes: Buffer): boolean {
  switch (mime) {
    case "image/jpeg": return bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    case "image/png": return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/webp": return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case "application/pdf": return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    default: return false;
  }
}
