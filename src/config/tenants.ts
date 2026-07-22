import { optionalEnv, requireEnvValue } from './env.js';

export type SefazTenant = {
  cnpj: string;
  passphrase: string;
  cUFAutor: string;
  certBase64?: string;
  certPath?: string;
};

type TenantInput = {
  passphrase?: string;
  cUFAutor?: string;
  certBase64?: string;
  certPath?: string;
};

const CNPJ_REGEX = /^\d{14}$/;

let cachedTenants: Map<string, SefazTenant> | undefined;
let cachedDefaultCnpj: string | undefined;

export function normalizarCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

export function validarCnpj(cnpj: string): boolean {
  return CNPJ_REGEX.test(normalizarCnpj(cnpj));
}

function parseTenantInput(
  cnpj: string,
  input: TenantInput,
): SefazTenant {
  const cnpjNormalizado = normalizarCnpj(cnpj);

  if (!validarCnpj(cnpjNormalizado)) {
    throw new Error(`CNPJ inválido na configuração de tenants: ${cnpj}`);
  }

  const passphrase = input.passphrase?.trim();
  const cUFAutor = input.cUFAutor?.trim();
  const certBase64 = input.certBase64?.trim() || undefined;
  const certPath = input.certPath?.trim() || undefined;

  if (!passphrase) {
    throw new Error(`Tenant ${cnpjNormalizado}: passphrase é obrigatória.`);
  }

  if (!cUFAutor) {
    throw new Error(`Tenant ${cnpjNormalizado}: cUFAutor é obrigatório.`);
  }

  if (!certBase64 && !certPath) {
    throw new Error(
      `Tenant ${cnpjNormalizado}: defina certBase64 ou certPath.`,
    );
  }

  return {
    cnpj: cnpjNormalizado,
    passphrase,
    cUFAutor,
    certBase64,
    certPath,
  };
}

function loadLegacyTenant(): Map<string, SefazTenant> {
  const cnpj = requireEnvValue('CNPJ');
  const passphrase = requireEnvValue('CERT_PASSPHRASE');
  const cUFAutor = requireEnvValue('CUF_AUTOR');
  const certBase64 = optionalEnv('CERT_BASE64');
  const certPath = optionalEnv('CERT_PATH');

  const tenant = parseTenantInput(cnpj, {
    passphrase,
    cUFAutor,
    certBase64,
    certPath,
  });

  return new Map([[tenant.cnpj, tenant]]);
}

function loadTenantsFromJson(raw: string): Map<string, SefazTenant> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SEFAZ_TENANTS deve ser um JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'SEFAZ_TENANTS deve ser um objeto { "CNPJ": { certBase64, passphrase, cUFAutor } }.',
    );
  }

  const tenants = new Map<string, SefazTenant>();

  for (const [cnpj, input] of Object.entries(
    parsed as Record<string, TenantInput>,
  )) {
    if (!input || typeof input !== 'object') {
      throw new Error(`Tenant ${cnpj}: configuração inválida.`);
    }

    const tenant = parseTenantInput(cnpj, input);
    tenants.set(tenant.cnpj, tenant);
  }

  if (tenants.size === 0) {
    throw new Error('SEFAZ_TENANTS não contém nenhum CNPJ configurado.');
  }

  return tenants;
}

function ensureTenantsLoaded(): void {
  if (cachedTenants) {
    return;
  }

  const tenantsJson = optionalEnv('SEFAZ_TENANTS');
  cachedTenants = tenantsJson
    ? loadTenantsFromJson(tenantsJson)
    : loadLegacyTenant();

  const defaultFromEnv = optionalEnv('DEFAULT_CNPJ');
  if (defaultFromEnv) {
    const normalized = normalizarCnpj(defaultFromEnv);
    if (!cachedTenants.has(normalized)) {
      throw new Error(
        `DEFAULT_CNPJ (${normalized}) não existe em SEFAZ_TENANTS.`,
      );
    }
    cachedDefaultCnpj = normalized;
  } else {
    cachedDefaultCnpj = cachedTenants.keys().next().value;
  }
}

export function listTenants(): SefazTenant[] {
  ensureTenantsLoaded();
  return [...cachedTenants!.values()];
}

export function getDefaultCnpj(): string {
  ensureTenantsLoaded();
  return cachedDefaultCnpj!;
}

export function getTenant(cnpj?: string): SefazTenant {
  ensureTenantsLoaded();

  const cnpjNormalizado = cnpj
    ? normalizarCnpj(cnpj)
    : cachedDefaultCnpj!;

  const tenant = cachedTenants!.get(cnpjNormalizado);

  if (!tenant) {
    throw new Error(
      `CNPJ ${cnpjNormalizado} não configurado. CNPJs disponíveis: ${[
        ...cachedTenants!.keys(),
      ].join(', ')}.`,
    );
  }

  return tenant;
}

/** Usado nos testes para limpar cache entre cenários. */
export function resetTenantsCache(): void {
  cachedTenants = undefined;
  cachedDefaultCnpj = undefined;
}
