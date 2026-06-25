import fs from 'node:fs';
import { getEnv } from './env.js';

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

export function loadCertBuffer(): Buffer {
  const env = getEnv();

  if (env.CERT_BASE64) {
    let buffer = decodeBase64(env.CERT_BASE64);

    if (looksLikeNestedBase64(buffer)) {
      buffer = decodeBase64(buffer.toString('utf8'));
    }

    if (!buffer.length) {
      throw new Error('CERT_BASE64 está vazio ou inválido.');
    }

    return buffer;
  }

  if (!env.CERT_PATH) {
    throw new Error('CERT_PATH não definido.');
  }

  if (!fs.existsSync(env.CERT_PATH)) {
    throw new Error(`Certificado não encontrado em: ${env.CERT_PATH}`);
  }

  return fs.readFileSync(env.CERT_PATH);
}
