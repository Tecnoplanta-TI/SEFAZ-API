import 'dotenv/config';

export type AppEnv = {
  PORT: number;
  TP_AMB: '1' | '2';
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const tpAmb = requireEnv('TP_AMB');
  if (tpAmb !== '1' && tpAmb !== '2') {
    throw new Error('TP_AMB deve ser "1" (produção) ou "2" (homologação).');
  }

  cachedEnv = {
    PORT: Number(process.env.PORT ?? 3000),
    TP_AMB: tpAmb,
  };

  return cachedEnv;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function requireEnvValue(name: string): string {
  return requireEnv(name);
}
