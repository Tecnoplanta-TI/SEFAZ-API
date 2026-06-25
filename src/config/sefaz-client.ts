import { loadCertBuffer } from './cert.js';
import { getEnv } from './env.js';

export type UfCode =
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '21'
  | '22'
  | '23'
  | '24'
  | '25'
  | '26'
  | '27'
  | '28'
  | '29'
  | '31'
  | '32'
  | '33'
  | '35'
  | '41'
  | '42'
  | '43'
  | '50'
  | '51'
  | '52'
  | '53';

export type TipoEventoManifestacao = 210200 | 210210 | 210220 | 210240;

export function getDistribuicaoConfig() {
  const env = getEnv();

  return {
    pfx: loadCertBuffer(),
    passphrase: env.CERT_PASSPHRASE,
    cnpj: env.CNPJ,
    cUFAutor: env.CUF_AUTOR as UfCode,
    tpAmb: env.TP_AMB,
  };
}

export function getRecepcaoConfig() {
  const env = getEnv();

  return {
    pfx: loadCertBuffer(),
    passphrase: env.CERT_PASSPHRASE,
    cnpj: env.CNPJ,
    tpAmb: env.TP_AMB,
    timezone: 'America/Sao_Paulo' as const,
  };
}
