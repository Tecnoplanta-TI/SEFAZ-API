const CHAVE_REGEX = /^\d{44}$/;

export function normalizarChaveNfe(chave: string): string {
  return chave.replace(/\D/g, '');
}

export function obterModeloChave(chave: string): string {
  return normalizarChaveNfe(chave).slice(20, 22);
}

export function validarChaveNfe(chave: string): boolean {
  const chaveNormalizada = normalizarChaveNfe(chave);

  if (!CHAVE_REGEX.test(chaveNormalizada)) {
    return false;
  }

  const base = chaveNormalizada.slice(0, 43);
  const dvInformado = Number(chaveNormalizada[43]);
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];

  let soma = 0;
  let pesoIndex = 0;

  for (let i = base.length - 1; i >= 0; i -= 1) {
    soma += Number(base[i]) * pesos[pesoIndex];
    pesoIndex = (pesoIndex + 1) % pesos.length;
  }

  const resto = soma % 11;
  const dvCalculado = resto < 2 ? 0 : 11 - resto;

  return dvCalculado === dvInformado;
}

export function validarChaveDocumento(
  chave: string,
  modelo: '55' | '57',
): boolean {
  if (!validarChaveNfe(chave)) {
    return false;
  }

  return obterModeloChave(chave) === modelo;
}
