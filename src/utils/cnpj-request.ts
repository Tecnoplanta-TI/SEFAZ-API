import {
  getDefaultCnpj,
  getTenant,
  normalizarCnpj,
  validarCnpj,
} from '../config/tenants.js';

export function resolverCnpjRequest(
  cnpj: unknown,
): string | { error: string } {
  if (cnpj === undefined || cnpj === null || cnpj === '') {
    return getDefaultCnpj();
  }

  if (typeof cnpj !== 'string') {
    return { error: 'Campo "cnpj" deve ser uma string.' };
  }

  const cnpjNormalizado = normalizarCnpj(cnpj);

  if (!validarCnpj(cnpjNormalizado)) {
    return {
      error: 'CNPJ inválido. Informe 14 dígitos numéricos.',
    };
  }

  try {
    getTenant(cnpjNormalizado);
    return cnpjNormalizado;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : `CNPJ ${cnpjNormalizado} não configurado.`,
    };
  }
}
