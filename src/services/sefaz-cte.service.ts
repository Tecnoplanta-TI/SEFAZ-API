import { DistribuicaoCTe } from '@vexta-systems/node-mde';
import { getDistribuicaoConfig } from '../config/sefaz-client.js';
import { mapSefazResult, SefazApiError } from '../errors/sefaz-errors.js';

type DocZip = {
  xml?: string;
  schema?: string;
  nsu?: string;
};

type DistribuicaoResultado = Awaited<
  ReturnType<DistribuicaoCTe['consultaChCTe']>
>;

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

function extrairDocumento(resultado: DistribuicaoResultado): DocZip | undefined {
  return resultado.data?.docZip?.[0];
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

async function obterXmlDistribuicaoCte(chave: string, nsu?: string): Promise<string> {
  const porChave = await consultarDistribuicaoCte(() =>
    getDistribuicaoCte().consultaChCTe(chave),
  );

  const { cStat, xMotivo } = porChave.data ?? {};
  const docChave = extrairDocumento(porChave);

  if (isProcCte(docChave?.schema)) {
    return extrairXmlProcCte(cStat, xMotivo, docChave);
  }

  if (nsu) {
    const porNsu = await consultarDistribuicaoCte(() =>
      getDistribuicaoCte().consultaNSU(nsu),
    );
    const { cStat: cStatNsu, xMotivo: xMotivoNsu } = porNsu.data ?? {};
    const docNsu = extrairDocumento(porNsu);

    if (isProcCte(docNsu?.schema)) {
      return extrairXmlProcCte(cStatNsu, xMotivoNsu, docNsu);
    }
  }

  if (isResumoCte(docChave?.schema)) {
    throw new SefazApiError(
      'A SEFAZ retornou apenas o resumo do CT-e.',
      422,
      'RESUMO_CTE',
      { schema: docChave?.schema },
    );
  }

  return extrairXmlProcCte(cStat, xMotivo, docChave);
}

export async function consultarCtePorChave(chave: string): Promise<string> {
  const primeiraConsulta = await consultarDistribuicaoCte(() =>
    getDistribuicaoCte().consultaChCTe(chave),
  );

  const { cStat, xMotivo } = primeiraConsulta.data ?? {};
  const primeiroDoc = extrairDocumento(primeiraConsulta);

  if (isProcCte(primeiroDoc?.schema)) {
    return extrairXmlProcCte(cStat, xMotivo, primeiroDoc);
  }

  if (!isResumoCte(primeiroDoc?.schema)) {
    return extrairXmlProcCte(cStat, xMotivo, primeiroDoc);
  }

  return obterXmlDistribuicaoCte(chave, primeiroDoc?.nsu);
}
