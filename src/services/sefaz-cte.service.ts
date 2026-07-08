import { DistribuicaoCTe } from '@vexta-systems/node-mde';
import { getDistribuicaoConfig } from '../config/sefaz-client.js';
import { mapSefazResult, SefazApiError } from '../errors/sefaz-errors.js';
import { extrairChaveCteDoXml } from '../utils/xml-cte.js';

type DocZip = {
  xml?: string;
  schema?: string;
  nsu?: string;
};

type DistribuicaoResultado = Awaited<
  ReturnType<DistribuicaoCTe['consultaUltNSU']>
>;

const NSU_INICIAL = '000000000000000';
const MAX_ITERACOES_DISTRIBUICAO_CTE = 100;

let distribuicaoCte: DistribuicaoCTe | undefined;

function getDistribuicaoCte(): DistribuicaoCTe {
  if (!distribuicaoCte) {
    distribuicaoCte = new DistribuicaoCTe(getDistribuicaoConfig());
  }

  return distribuicaoCte;
}

function formatSefazError(error: unknown, status = 502): string {
  if (typeof error === 'string') {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'xml' in error &&
    String(error.xml).includes('403')
  ) {
    return 'SEFAZ retornou 403 Forbidden. Verifique se TP_AMB corresponde ao certificado (1=produção, 2=homologação) e se o certificado está válido.';
  }

  return JSON.stringify(error);
}

function isResumoCte(schema?: string): boolean {
  return !!schema?.startsWith('resCTe');
}

function isProcCte(schema?: string): boolean {
  return !!schema?.startsWith('procCTe');
}

function extrairXmlProcCte(
  cStat: string | undefined,
  xMotivo: string | undefined,
  doc?: DocZip,
): string {
  return mapSefazResult({
    cStat,
    xMotivo,
    schema: doc?.schema,
    xml: doc?.xml,
    tipoDocumento: 'cte',
  }).xml;
}

function nsuParaBigInt(nsu: string): bigint {
  return BigInt(nsu.replace(/\D/g, '') || '0');
}

async function consultarDistribuicaoCte(
  consulta: () => Promise<DistribuicaoResultado>,
): Promise<DistribuicaoResultado> {
  try {
    const resultado = await consulta();

    if (resultado.error) {
      throw new SefazApiError(
        formatSefazError(resultado.error, resultado.status),
        resultado.status || 502,
        'SEFAZ_LIBRARY_ERROR',
      );
    }

    const { cStat, xMotivo } = resultado.data ?? {};

    if (cStat && cStat !== '138') {
      mapSefazResult({ cStat, xMotivo, tipoDocumento: 'cte' });
    }

    return resultado;
  } catch (error) {
    if (error instanceof SefazApiError) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Falha de comunicação com a SEFAZ.';

    throw new SefazApiError(message, 502, 'SEFAZ_COMMUNICATION_ERROR');
  }
}

function buscarXmlCteNosDocumentos(
  chave: string,
  docs: DocZip[],
  cStat: string | undefined,
  xMotivo: string | undefined,
): string | undefined {
  for (const doc of docs) {
    if (!doc.xml) {
      continue;
    }

    const chaveXml = extrairChaveCteDoXml(doc.xml);

    if (chaveXml !== chave) {
      continue;
    }

    if (isResumoCte(doc.schema)) {
      throw new SefazApiError(
        'A SEFAZ retornou apenas o resumo do CT-e.',
        422,
        'RESUMO_CTE',
        { schema: doc.schema },
      );
    }

    if (isProcCte(doc.schema)) {
      return extrairXmlProcCte(cStat, xMotivo, doc);
    }
  }

  return undefined;
}

export async function consultarCtePorChave(chave: string): Promise<string> {
  let ultNSU = NSU_INICIAL;

  for (let iteracao = 0; iteracao < MAX_ITERACOES_DISTRIBUICAO_CTE; iteracao += 1) {
    const resultado = await consultarDistribuicaoCte(() =>
      getDistribuicaoCte().consultaUltNSU(ultNSU),
    );

    const { cStat, xMotivo } = resultado.data ?? {};
    const docs = resultado.data?.docZip ?? [];
    const xmlEncontrado = buscarXmlCteNosDocumentos(
      chave,
      docs,
      cStat,
      xMotivo,
    );

    if (xmlEncontrado) {
      return xmlEncontrado;
    }

    const ultNSURetorno = resultado.data?.ultNSU;
    const maxNSU = resultado.data?.maxNSU;

    if (!ultNSURetorno || !maxNSU) {
      break;
    }

    if (nsuParaBigInt(ultNSURetorno) >= nsuParaBigInt(maxNSU)) {
      break;
    }

    if (ultNSURetorno === ultNSU && docs.length < 1) {
      break;
    }

    ultNSU = ultNSURetorno;
  }

  throw new SefazApiError(
    'CT-e não localizado na distribuição DF-e para este CNPJ. A SEFAZ não permite consulta de CT-e diretamente pela chave; o documento precisa estar disponível na fila de distribuição do certificado.',
    404,
    'CTE_NAO_LOCALIZADO',
  );
}
