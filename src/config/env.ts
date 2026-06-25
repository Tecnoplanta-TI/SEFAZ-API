import 'dotenv/config';

export type AppEnv = {
  PORT: number;
  TP_AMB: '1' | '2';
  CNPJ: string;
  CUF_AUTOR: string;
  CERT_PASSPHRASE: string;
  CERT_BASE64?: string;
  CERT_PATH?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const certBase64 = optionalEnv('CERT_BASE64');
  const certPath = optionalEnv('CERT_PATH');

  if (!certBase64 && !certPath) {
    throw new Error(
      'Defina CERT_BASE64 ou CERT_PATH para carregar o certificado A1.',
    );
  }

  const tpAmb = requireEnv('TP_AMB');
  if (tpAmb !== '1' && tpAmb !== '2') {
    throw new Error('TP_AMB deve ser "1" (produção) ou "2" (homologação).');
  }

  cachedEnv = {
    PORT: Number(process.env.PORT ?? 3000),
    TP_AMB: tpAmb,
    CNPJ: requireEnv('CNPJ'),
    CUF_AUTOR: requireEnv('CUF_AUTOR'),
    CERT_PASSPHRASE: requireEnv('CERT_PASSPHRASE'),
    CERT_BASE64: certBase64,
    CERT_PATH: certPath,
  };

  return cachedEnv;
}
