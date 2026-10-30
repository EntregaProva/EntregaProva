export type ResultadoChave = { valida: true } | { valida: false; motivo: string };

export function validarChaveNfe(chave: string): ResultadoChave {
  const temSoDigitos = /^\d+$/.test(chave);

  if (!temSoDigitos) return { valida: false, motivo: "NAO_NUMERICA" };
  if (chave.length !== 44) return { valida: false, motivo: "TAMANHO_INVALIDO" };

  let soma = 0;
  for (let i = 42, peso = 2; i >= 0; i--, peso = peso === 9 ? 2 : peso + 1) {
    soma += Number(chave[i]) * peso;
  }

  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;

  return Number(chave[43]) === dv
    ? { valida: true }
    : { valida: false, motivo: "DV_INVALIDO" };
}