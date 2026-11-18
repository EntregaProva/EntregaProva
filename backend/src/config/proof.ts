// Decimal KB: same limit at the API boundary and in the contract.
export const MAX_PROOF_BYTES = 300_000;
// PDF retained for compatibility with the existing API; WebP is additive.
export const PROOF_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
