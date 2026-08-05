import type { HalabRemittanceFields, Transaction } from '../types';

export const HALAB_REMITTANCE_LABELS: { key: keyof HalabRemittanceFields; label: string }[] = [
  { key: 'transferDate', label: 'تاريخ الحوالة' },
  { key: 'companyName', label: 'اسم الشركة' },
  { key: 'publicNumber', label: 'الرقم العام' },
  { key: 'sender', label: 'المرسل' },
  { key: 'beneficiary', label: 'المستفيد' },
  { key: 'beneficiaryPhone', label: 'هاتف المستفيد' },
  { key: 'deliveryAmount', label: 'مبلغ التسليم' },
  { key: 'destination', label: 'الوجهة' },
];

interface HalabRemittanceMeta {
  td?: string;
  cn?: string;
  pn?: string;
  sn?: string;
  bf?: string;
  bp?: string;
  da?: string;
  ds?: string;
}

export function defaultHalabRemittanceFields(): HalabRemittanceFields {
  return {
    transferDate: '',
    companyName: '',
    publicNumber: '',
    sender: '',
    beneficiary: '',
    beneficiaryPhone: '',
    deliveryAmount: '',
    destination: '',
  };
}

export function halabRemittanceFromTransaction(tx: Transaction | undefined): HalabRemittanceFields {
  if (!tx?.halabRemittance) return defaultHalabRemittanceFields();
  return { ...defaultHalabRemittanceFields(), ...tx.halabRemittance };
}

export function encodeHalabRemittanceMeta(fields: HalabRemittanceFields | undefined): HalabRemittanceMeta | undefined {
  if (!fields || !hasHalabRemittanceContent(fields)) return undefined;
  const meta: HalabRemittanceMeta = {};
  if (fields.transferDate?.trim()) meta.td = fields.transferDate.trim();
  if (fields.companyName?.trim()) meta.cn = fields.companyName.trim();
  if (fields.publicNumber?.trim()) meta.pn = fields.publicNumber.trim();
  if (fields.sender?.trim()) meta.sn = fields.sender.trim();
  if (fields.beneficiary?.trim()) meta.bf = fields.beneficiary.trim();
  if (fields.beneficiaryPhone?.trim()) meta.bp = fields.beneficiaryPhone.trim();
  if (fields.deliveryAmount?.trim()) meta.da = fields.deliveryAmount.trim();
  if (fields.destination?.trim()) meta.ds = fields.destination.trim();
  return Object.keys(meta).length ? meta : undefined;
}

export function decodeHalabRemittanceMeta(meta?: HalabRemittanceMeta): HalabRemittanceFields | undefined {
  if (!meta) return undefined;
  const fields: HalabRemittanceFields = {
    transferDate: meta.td ?? '',
    companyName: meta.cn ?? '',
    publicNumber: meta.pn ?? '',
    sender: meta.sn ?? '',
    beneficiary: meta.bf ?? '',
    beneficiaryPhone: meta.bp ?? '',
    deliveryAmount: meta.da ?? '',
    destination: meta.ds ?? '',
  };
  return hasHalabRemittanceContent(fields) ? fields : undefined;
}

export function hasHalabRemittanceContent(fields: HalabRemittanceFields): boolean {
  return HALAB_REMITTANCE_LABELS.some(({ key }) => fields[key]?.trim());
}

export function stampHalabRemittance<T extends Transaction | Transaction[]>(
  payload: T,
  fields: HalabRemittanceFields | undefined,
): T {
  const apply = (tx: Transaction) => {
    if (tx.fundId !== 'halabFleilat') return tx;
    if (!fields || !hasHalabRemittanceContent(fields)) {
      const { halabRemittance: _, ...rest } = tx;
      return rest as Transaction;
    }
    const compact = HALAB_REMITTANCE_LABELS.reduce<HalabRemittanceFields>((acc, { key }) => {
      const v = fields[key]?.trim();
      if (v) acc[key] = v;
      return acc;
    }, {});
    return { ...tx, halabRemittance: compact };
  };
  if (Array.isArray(payload)) return payload.map(apply) as T;
  return apply(payload) as T;
}

export function halabRemittanceSummaryLines(fields: HalabRemittanceFields | undefined): string[] {
  if (!fields) return [];
  return HALAB_REMITTANCE_LABELS
    .map(({ key, label }) => {
      const value = fields[key]?.trim();
      return value ? `${label}: ${value}` : null;
    })
    .filter((line): line is string => !!line);
}

export type { HalabRemittanceMeta };
