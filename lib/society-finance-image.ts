export const MAX_EXPENSE_RECEIPT_BYTES = 750_000;
const MAX_PIXELS = 20_000_000;

function validDimensions(width: number, height: number) {
  return width > 0 && height > 0 && width * height <= MAX_PIXELS;
}

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngEnd = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

function looksLikePng(bytes: Buffer) {
  return bytes.length >= 57 && bytes.subarray(0, 8).equals(pngSignature)
    && bytes.readUInt32BE(8) === 13 && bytes.toString("ascii", 12, 16) === "IHDR"
    && validDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20))
    && bytes.subarray(-12).equals(pngEnd);
}

const jpegFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function looksLikeJpeg(bytes: Buffer) {
  const end = bytes.length - 2;
  if (end < 12 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(end) !== 0xffd9) return false;
  let validFrame = false;
  let offset = 2;
  while (offset < end && bytes[offset++] === 0xff) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (offset + 2 > end) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > end) return false;
    if (jpegFrameMarkers.has(marker)) {
      if (length < 8) return false;
      validFrame = validDimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3));
    }
    if (marker === 0xda) return validFrame && offset + length < end;
    offset += length;
  }
  return false;
}

export function receiptImageType(declaredType: string, bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length > MAX_EXPENSE_RECEIPT_BYTES) return null;
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (declaredType === "image/png" && looksLikePng(data)) return declaredType;
  if (declaredType === "image/jpeg" && looksLikeJpeg(data)) return declaredType;
  return null;
}
