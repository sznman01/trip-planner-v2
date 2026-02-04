export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  Japan: 'JPY',
  Switzerland: 'CHF',
  'Hong Kong': 'HKD',
  Taiwan: 'TWD',
  Korea: 'KRW',
  Thailand: 'THB',
  Singapore: 'SGD',
  'United States': 'USD',
  'United Kingdom': 'GBP',
  France: 'EUR',
  Germany: 'EUR',
  Italy: 'EUR',
  Spain: 'EUR',
};

export function getCurrencyCodeFromCountry(country: string) {
  return COUNTRY_TO_CURRENCY[country] ?? 'HKD';
}
