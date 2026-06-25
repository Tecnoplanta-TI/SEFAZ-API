const DH_EMI_REGEX = /<dhEmi>([^<]+)<\/dhEmi>/i;
const D_EMI_REGEX = /<dEmi>([^<]+)<\/dEmi>/i;
const ISO_DATE_PREFIX_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;

function formatarDataDdMmAaaa(ano: string, mes: string, dia: string): string {
  return `${dia}/${mes}/${ano}`;
}

function parsearValorData(valor: string): string | undefined {
  const isoMatch = valor.trim().match(ISO_DATE_PREFIX_REGEX);

  if (isoMatch) {
    const [, ano, mes, dia] = isoMatch;
    return formatarDataDdMmAaaa(ano, mes, dia);
  }

  const brMatch = valor.trim().match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);

  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    return formatarDataDdMmAaaa(ano, mes, dia);
  }

  return undefined;
}

export function extrairXmlPostingDate(xml: string): string | undefined {
  const dhEmi = xml.match(DH_EMI_REGEX)?.[1];
  if (dhEmi) {
    return parsearValorData(dhEmi);
  }

  const dEmi = xml.match(D_EMI_REGEX)?.[1];
  if (dEmi) {
    return parsearValorData(dEmi);
  }

  return undefined;
}
