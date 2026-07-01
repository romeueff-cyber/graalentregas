export interface BoletoAddressFields {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  complement: string;
  zipCode: string;
}

export const emptyBoletoAddressFields: BoletoAddressFields = {
  street: '',
  number: '',
  district: '',
  city: '',
  state: '',
  complement: '',
  zipCode: '',
};

export function cleanBoletoZipCode(value?: string | null): string {
  return (value || '').replace(/\D/g, '').substring(0, 8);
}

export function normalizeBoletoAddressFields(input: Partial<{
  street: string | null;
  number: string | null;
  district: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  complement: string | null;
  zipCode: string | null;
  zip_code: string | null;
}>): BoletoAddressFields {
  return {
    street: (input.street || '').trim(),
    number: (input.number || '').trim(),
    district: (input.district || input.neighborhood || '').trim(),
    city: (input.city || '').trim(),
    state: (input.state || '').trim().substring(0, 2).toUpperCase(),
    complement: (input.complement || '').trim(),
    zipCode: cleanBoletoZipCode(input.zipCode || input.zip_code),
  };
}

export function getMissingCoraBoletoAddressFields(address: BoletoAddressFields): string[] {
  const missing: string[] = [];

  if (!address.street) missing.push('rua');
  if (!address.district) missing.push('bairro');
  if (!address.city) missing.push('cidade');
  if (!address.state || address.state.length !== 2) missing.push('UF');
  if (!address.zipCode || address.zipCode.length !== 8 || address.zipCode === '00000000') missing.push('CEP');

  return missing;
}

export function toCoraBoletoAddress(address: BoletoAddressFields) {
  return {
    street: address.street,
    number: address.number || 'S/N',
    district: address.district,
    city: address.city,
    state: address.state,
    complement: address.complement || undefined,
    zipCode: address.zipCode,
  };
}