import { afterEach, describe, expect, it, vi } from "vitest";
import { compressProofPhoto } from "./imageCompression.ts";

afterEach(() => vi.unstubAllGlobals());

describe("compressProofPhoto", () => {
  it("limita a maior dimensão a 1280 px, não passa de 300.000 bytes e libera o bitmap", async () => {
    const bitmap = { width: 2400, height: 1600, close: vi.fn() };
    const renderedSizes: Array<[number, number]> = [];
    const qualities: number[] = [];
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" };
    const compressedSizes = [300_001, 300_050, 300_000];
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback, _type?: string, quality?: number) => {
        renderedSizes.push([canvas.width, canvas.height]);
        qualities.push(quality ?? 0);
        const size = compressedSizes[qualities.length - 1] ?? 300_000;
        callback(new Blob([new Uint8Array(size)], { type: "image/jpeg" }));
      }),
    };

    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
    const original = new File(["foto"], "entrega.png", { type: "image/png", lastModified: 123 });

    const compressed = await compressProofPhoto(original);

    expect(Math.max(...renderedSizes[0])).toBe(1280);
    expect(qualities).toEqual([0.84, 0.74, 0.64]);
    expect(compressed.size).toBe(300_000);
    expect(compressed.name).toBe("entrega.jpg");
    expect(compressed.type).toBe("image/jpeg");
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
