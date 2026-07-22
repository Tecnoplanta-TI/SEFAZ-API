import fs from 'node:fs';
import type { SefazTenant } from './tenants.js';

function decodeBase64(input: string): Buffer {
  return Buffer.from(input.replace(/\s+/g, ''), 'base64');
}

function looksLikeNestedBase64(buffer: Buffer): boolean {
  if (!buffer.length) {
    return false;
  }

  const asText = buffer.toString('utf8');

  return (
    asText.startsWith('MII') &&
    /^[A-Za-z0-9+/=\r\n]+$/.test(asText) &&
    asText.length > 100
  );
}

export function loadCertBuffer(tenant: SefazTenant): Buffer {
  if (tenant.certBase64) {
    let buffer = decodeBase64(tenant.certBase64);

    if (looksLikeNestedBase64(buffer)) {
      buffer = decodeBase64(buffer.toString('utf8'));
    }

    if (!buffer.length) {
      throw new Error(
        `Certificado base64 do CNPJ ${tenant.cnpj} está vazio ou inválido.`,
      );
    }

    return buffer;
  }

  if (!tenant.certPath) {
    throw new Error(`CERT_PATH não definido para o CNPJ ${tenant.cnpj}.`);
  }

  if (!fs.existsSync(tenant.certPath)) {
    throw new Error(
      `Certificado não encontrado em: ${tenant.certPath} (CNPJ ${tenant.cnpj}).`,
    );
  }

  return fs.readFileSync(tenant.certPath);
}
