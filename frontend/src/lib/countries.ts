export type CountryOption = {
  code: string;
  name: string;
};

const FALLBACK_REGION_CODES = [
  "US",
  "JP",
  "KR",
  "CN",
  "TW",
  "HK",
  "SG",
  "TH",
  "VN",
  "PH",
  "MY",
  "ID",
  "AU",
  "NZ",
  "GB",
  "IE",
  "DE",
  "FR",
  "ES",
  "IT",
  "PT",
  "NL",
  "BE",
  "DK",
  "SE",
  "NO",
  "FI",
  "IS",
  "PL",
  "CZ",
  "SK",
  "HU",
  "RO",
  "BG",
  "GR",
  "CH",
  "AT",
  "CA",
  "MX",
  "BR",
  "AR",
  "CL",
  "PE",
  "CO",
  "VE",
  "UY",
  "PY",
  "BO",
  "ZA",
  "NG",
  "KE",
  "EG",
  "MA",
  "DZ",
  "TN",
  "SA",
  "AE",
  "IN",
  "PK",
  "BD",
  "LK",
  "NP",
  "RU",
];

const FALLBACK_REGION_LABELS: Record<string, string> = {
  US: "United States",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  TW: "Taiwan",
  HK: "Hong Kong",
  SG: "Singapore",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  MY: "Malaysia",
  ID: "Indonesia",
  AU: "Australia",
  NZ: "New Zealand",
  GB: "United Kingdom",
  IE: "Ireland",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  DK: "Denmark",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  IS: "Iceland",
  PL: "Poland",
  CZ: "Czech Republic",
  SK: "Slovakia",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  GR: "Greece",
  CH: "Switzerland",
  AT: "Austria",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  PE: "Peru",
  CO: "Colombia",
  VE: "Venezuela",
  UY: "Uruguay",
  PY: "Paraguay",
  BO: "Bolivia",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  EG: "Egypt",
  MA: "Morocco",
  DZ: "Algeria",
  TN: "Tunisia",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  NP: "Nepal",
  RU: "Russia",
};

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (input: "calendar" | "collation" | "currency" | "numberingSystem" | "timeZone" | "unit" | "region") => string[];
};

function resolveRegionCodes(): string[] {
  const intl = Intl as IntlWithSupportedValues;
  if (typeof intl.supportedValuesOf === "function") {
    try {
      const supported = intl.supportedValuesOf("region");
      if (Array.isArray(supported) && supported.length > 0) {
        return supported.filter((code) => /^[A-Z]{2}$/.test(code));
      }
    } catch {
      // ignore – fallback below
    }
  }
  return [...FALLBACK_REGION_CODES];
}

const regionCodes = Array.from(new Set(resolveRegionCodes()));
const displayNames =
  typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

export const COUNTRY_OPTIONS: CountryOption[] = regionCodes
  .map((code) => {
    const label = displayNames?.of(code);
    return {
      code,
      name: label ?? FALLBACK_REGION_LABELS[code] ?? code,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
