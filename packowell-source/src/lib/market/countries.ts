/**
 * Country registry.
 *
 * One row per destination the site can be pointed at from the selector. The
 * local currency is the *country's* currency, whether or not the business can
 * quote in it — `resolveCurrency` decides what is actually shown, and the
 * fallback is configurable rather than assumed.
 *
 * Nothing here is a commercial promise: `status` lives in the database
 * (Destination), not in this file.
 */

import { CURRENCIES, type CurrencyCode } from './currencies'

export type Region =
  | 'South Asia'
  | 'Southeast Asia'
  | 'East Asia'
  | 'Middle East'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Africa'
  | 'Oceania'

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string
  name: string
  region: Region
  /** The country's own currency. Not necessarily one the business can quote in. */
  currency: string
}

type Row = [code: string, name: string, region: Region, currency: string]

const ROWS: Row[] = [
  // South Asia
  ['IN', 'India', 'South Asia', 'INR'],
  ['PK', 'Pakistan', 'South Asia', 'PKR'],
  ['BD', 'Bangladesh', 'South Asia', 'BDT'],
  ['LK', 'Sri Lanka', 'South Asia', 'LKR'],
  ['NP', 'Nepal', 'South Asia', 'NPR'],
  ['BT', 'Bhutan', 'South Asia', 'BTN'],
  ['MV', 'Maldives', 'South Asia', 'MVR'],
  ['AF', 'Afghanistan', 'South Asia', 'AFN'],

  // Southeast Asia
  ['SG', 'Singapore', 'Southeast Asia', 'SGD'],
  ['MY', 'Malaysia', 'Southeast Asia', 'MYR'],
  ['TH', 'Thailand', 'Southeast Asia', 'THB'],
  ['ID', 'Indonesia', 'Southeast Asia', 'IDR'],
  ['VN', 'Vietnam', 'Southeast Asia', 'VND'],
  ['PH', 'Philippines', 'Southeast Asia', 'PHP'],
  ['BN', 'Brunei', 'Southeast Asia', 'BND'],
  ['KH', 'Cambodia', 'Southeast Asia', 'KHR'],
  ['LA', 'Laos', 'Southeast Asia', 'LAK'],
  ['MM', 'Myanmar', 'Southeast Asia', 'MMK'],

  // East Asia
  ['CN', 'China', 'East Asia', 'CNY'],
  ['JP', 'Japan', 'East Asia', 'JPY'],
  ['KR', 'South Korea', 'East Asia', 'KRW'],
  ['HK', 'Hong Kong SAR', 'East Asia', 'HKD'],
  ['TW', 'Taiwan', 'East Asia', 'TWD'],
  ['MO', 'Macao SAR', 'East Asia', 'MOP'],
  ['MN', 'Mongolia', 'East Asia', 'MNT'],

  // Middle East
  ['AE', 'United Arab Emirates', 'Middle East', 'AED'],
  ['SA', 'Saudi Arabia', 'Middle East', 'SAR'],
  ['QA', 'Qatar', 'Middle East', 'QAR'],
  ['KW', 'Kuwait', 'Middle East', 'KWD'],
  ['BH', 'Bahrain', 'Middle East', 'BHD'],
  ['OM', 'Oman', 'Middle East', 'OMR'],
  ['JO', 'Jordan', 'Middle East', 'JOD'],
  ['LB', 'Lebanon', 'Middle East', 'LBP'],
  ['IL', 'Israel', 'Middle East', 'ILS'],
  ['TR', 'Türkiye', 'Middle East', 'TRY'],
  ['EG', 'Egypt', 'Middle East', 'EGP'],
  ['IQ', 'Iraq', 'Middle East', 'IQD'],
  ['IR', 'Iran', 'Middle East', 'IRR'],
  ['YE', 'Yemen', 'Middle East', 'YER'],
  ['SY', 'Syria', 'Middle East', 'SYP'],

  // Europe
  ['GB', 'United Kingdom', 'Europe', 'GBP'],
  ['IE', 'Ireland', 'Europe', 'EUR'],
  ['FR', 'France', 'Europe', 'EUR'],
  ['DE', 'Germany', 'Europe', 'EUR'],
  ['IT', 'Italy', 'Europe', 'EUR'],
  ['ES', 'Spain', 'Europe', 'EUR'],
  ['PT', 'Portugal', 'Europe', 'EUR'],
  ['NL', 'Netherlands', 'Europe', 'EUR'],
  ['BE', 'Belgium', 'Europe', 'EUR'],
  ['LU', 'Luxembourg', 'Europe', 'EUR'],
  ['AT', 'Austria', 'Europe', 'EUR'],
  ['CH', 'Switzerland', 'Europe', 'CHF'],
  ['SE', 'Sweden', 'Europe', 'SEK'],
  ['NO', 'Norway', 'Europe', 'NOK'],
  ['DK', 'Denmark', 'Europe', 'DKK'],
  ['FI', 'Finland', 'Europe', 'EUR'],
  ['PL', 'Poland', 'Europe', 'PLN'],
  ['CZ', 'Czechia', 'Europe', 'CZK'],
  ['SK', 'Slovakia', 'Europe', 'EUR'],
  ['HU', 'Hungary', 'Europe', 'HUF'],
  ['RO', 'Romania', 'Europe', 'RON'],
  ['BG', 'Bulgaria', 'Europe', 'BGN'],
  ['GR', 'Greece', 'Europe', 'EUR'],
  ['HR', 'Croatia', 'Europe', 'EUR'],
  ['SI', 'Slovenia', 'Europe', 'EUR'],
  ['EE', 'Estonia', 'Europe', 'EUR'],
  ['LV', 'Latvia', 'Europe', 'EUR'],
  ['LT', 'Lithuania', 'Europe', 'EUR'],
  ['MT', 'Malta', 'Europe', 'EUR'],
  ['CY', 'Cyprus', 'Europe', 'EUR'],
  ['IS', 'Iceland', 'Europe', 'ISK'],
  ['RS', 'Serbia', 'Europe', 'RSD'],
  ['UA', 'Ukraine', 'Europe', 'UAH'],

  // North America & Caribbean
  ['US', 'United States', 'North America', 'USD'],
  ['CA', 'Canada', 'North America', 'CAD'],
  ['MX', 'Mexico', 'North America', 'MXN'],
  ['GT', 'Guatemala', 'North America', 'GTQ'],
  ['CR', 'Costa Rica', 'North America', 'CRC'],
  ['PA', 'Panama', 'North America', 'PAB'],
  ['DO', 'Dominican Republic', 'North America', 'DOP'],
  ['JM', 'Jamaica', 'North America', 'JMD'],
  ['TT', 'Trinidad and Tobago', 'North America', 'TTD'],

  // South America
  ['BR', 'Brazil', 'South America', 'BRL'],
  ['AR', 'Argentina', 'South America', 'ARS'],
  ['CL', 'Chile', 'South America', 'CLP'],
  ['CO', 'Colombia', 'South America', 'COP'],
  ['PE', 'Peru', 'South America', 'PEN'],
  ['EC', 'Ecuador', 'South America', 'USD'],
  ['UY', 'Uruguay', 'South America', 'UYU'],
  ['PY', 'Paraguay', 'South America', 'PYG'],
  ['BO', 'Bolivia', 'South America', 'BOB'],

  // Africa
  ['ZA', 'South Africa', 'Africa', 'ZAR'],
  ['NG', 'Nigeria', 'Africa', 'NGN'],
  ['KE', 'Kenya', 'Africa', 'KES'],
  ['GH', 'Ghana', 'Africa', 'GHS'],
  ['TZ', 'Tanzania', 'Africa', 'TZS'],
  ['UG', 'Uganda', 'Africa', 'UGX'],
  ['ET', 'Ethiopia', 'Africa', 'ETB'],
  ['MA', 'Morocco', 'Africa', 'MAD'],
  ['DZ', 'Algeria', 'Africa', 'DZD'],
  ['TN', 'Tunisia', 'Africa', 'TND'],
  ['SN', 'Senegal', 'Africa', 'XOF'],
  ['CI', "Côte d'Ivoire", 'Africa', 'XOF'],
  ['CM', 'Cameroon', 'Africa', 'XAF'],
  ['ZW', 'Zimbabwe', 'Africa', 'ZWL'],
  ['ZM', 'Zambia', 'Africa', 'ZMW'],
  ['BW', 'Botswana', 'Africa', 'BWP'],
  ['MU', 'Mauritius', 'Africa', 'MUR'],
  ['MZ', 'Mozambique', 'Africa', 'MZN'],
  ['RW', 'Rwanda', 'Africa', 'RWF'],
  ['NA', 'Namibia', 'Africa', 'NAD'],

  // Oceania
  ['AU', 'Australia', 'Oceania', 'AUD'],
  ['NZ', 'New Zealand', 'Oceania', 'NZD'],
  ['FJ', 'Fiji', 'Oceania', 'FJD'],
  ['PG', 'Papua New Guinea', 'Oceania', 'PGK'],
]

export const COUNTRIES: Country[] = ROWS.map(([code, name, region, currency]) => ({
  code,
  name,
  region,
  currency,
}))

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
)

export const REGION_ORDER: Region[] = [
  'South Asia',
  'Southeast Asia',
  'East Asia',
  'Middle East',
  'Europe',
  'North America',
  'South America',
  'Africa',
  'Oceania',
]

export function countryName(code: string): string {
  return COUNTRY_BY_CODE[code?.toUpperCase()]?.name ?? code ?? 'Unknown'
}

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && Boolean(COUNTRY_BY_CODE[value.toUpperCase()])
}

/** Countries grouped for a <select>/optgroup list. */
export function countriesByRegion(): { region: Region; countries: Country[] }[] {
  return REGION_ORDER.map((region) => ({
    region,
    countries: COUNTRIES.filter((c) => c.region === region),
  })).filter((g) => g.countries.length > 0)
}

/** Case-insensitive match on name or ISO code — used by the selector search. */
export function searchCountries(term: string): Country[] {
  const q = term.trim().toLowerCase()
  if (!q) return COUNTRIES
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.code.toLowerCase().startsWith(q),
  )
}

/**
 * What currency a visitor in `code` should see.
 *
 * In order: the country's own supported currency → the configured fallback.
 * Never invents a currency for a country, and never converts silently.
 */
export function resolveCurrency(
  code: string,
  fallback: CurrencyCode,
  override?: CurrencyCode | null,
): { currency: CurrencyCode; localSupported: boolean; localCurrency: string } {
  if (override) {
    return { currency: override, localSupported: true, localCurrency: override }
  }
  const local = COUNTRY_BY_CODE[code?.toUpperCase()]?.currency ?? fallback
  const supported = Object.prototype.hasOwnProperty.call(CURRENCIES, local)
  return {
    currency: supported ? (local as CurrencyCode) : fallback,
    localSupported: supported,
    localCurrency: local,
  }
}
