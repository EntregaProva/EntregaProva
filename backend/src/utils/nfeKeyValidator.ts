export function validateNFeKey(key: string): { isValid: boolean; reason?: string } {
  // BVA: Tamanho estrito de 44 dígitos numéricos
  if (!/^\d{44}$/.test(key)) {
    return { isValid: false, reason: "A chave deve possuir exatamente 44 dígitos numéricos" };
  }

  const baseDigits = key.substring(0, 43);
  const providedDV = parseInt(key.charAt(43), 10);

  // Cálculo Módulo 11 padrão SEFAZ (pesos de 2 a 9 da direita para a esquerda)
  let sum = 0;
  let weight = 2;

  for (let i = baseDigits.length - 1; i >= 0; i--) {
    sum += parseInt(baseDigits.charAt(i), 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const calculatedDV = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;

  if (calculatedDV !== providedDV) {
    return { isValid: false, reason: "Dígito verificador inválido" };
  }

  return { isValid: true };
}