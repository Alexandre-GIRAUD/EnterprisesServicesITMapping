import type { Edge } from '@xyflow/react';
import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import type { AppNode } from '../hooks/useGraphData';
import type { OrientedEdgeType } from '../components/OrientedEdge';

export const MAX_OPEN_SANDBOXES = 4;
export const SANDBOX_SAVED_STORAGE_KEY = 'flowra.sandbox.savedDocuments';
export const SANDBOX_RECENT_ICONS_KEY = 'flowra.sandbox.recentIcons';
export const MAX_RECENT_SANDBOX_ICONS = 5;

export type SandboxDocFilters = {
  applicationIds: string[];
  nodeAttributes: Record<string, string[]>;
  nodeRefs: Record<string, string[]>;
};

export const EMPTY_SANDBOX_FILTERS: SandboxDocFilters = {
  applicationIds: [],
  nodeAttributes: {},
  nodeRefs: {},
};

export function sandboxFiltersActive(filters?: SandboxDocFilters | null): boolean {
  if (!filters) return false;
  return (
    filters.applicationIds.length > 0 ||
    Object.keys(filters.nodeAttributes).length > 0 ||
    Object.keys(filters.nodeRefs).length > 0
  );
}

/** Client-side match for per-sandbox filters (same AND/OR idea as API GraphFilters). */
export function graphNodeMatchesSandboxFilters(
  node: GraphNodeDto,
  filters: SandboxDocFilters
): boolean {
  if (
    filters.applicationIds.length > 0 &&
    node.type === 'Application' &&
    !filters.applicationIds.includes(node.id)
  ) {
    return false;
  }
  for (const [key, values] of Object.entries(filters.nodeAttributes)) {
    if (!values.length) continue;
    const v = node.properties?.[key];
    if (v === undefined || !values.includes(v)) return false;
  }
  for (const [key, values] of Object.entries(filters.nodeRefs)) {
    if (!values.length) continue;
    const v = node.properties?.[key];
    if (v === undefined || !values.includes(v)) return false;
  }
  return true;
}

export function sandboxFilterVisibleIds(doc: {
  graphNodes: GraphNodeDto[];
  filters?: SandboxDocFilters;
}): Set<string> | null {
  const filters = doc.filters ?? EMPTY_SANDBOX_FILTERS;
  if (!sandboxFiltersActive(filters)) return null;
  return new Set(
    doc.graphNodes.filter((n) => graphNodeMatchesSandboxFilters(n, filters)).map((n) => n.id)
  );
}

export function loadRecentSandboxIcons(): string[] {
  try {
    const raw = localStorage.getItem(SANDBOX_RECENT_ICONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === 'string').slice(0, MAX_RECENT_SANDBOX_ICONS);
  } catch {
    return [];
  }
}

export function pushRecentSandboxIcon(iconKey: string): string[] {
  const next = [iconKey, ...loadRecentSandboxIcons().filter((k) => k !== iconKey)].slice(
    0,
    MAX_RECENT_SANDBOX_ICONS
  );
  try {
    localStorage.setItem(SANDBOX_RECENT_ICONS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export type SandboxLayoutMode =
  | 'horizontal'
  | 'vertical'
  | 'square'
  | 'main-side'
  | 'top-row';

/** Layouts allowed for the current open sandbox count. */
export function sandboxLayoutsForCount(count: number): SandboxLayoutMode[] {
  if (count <= 1) return [];
  const modes: SandboxLayoutMode[] = ['horizontal', 'vertical', 'main-side'];
  if (count >= 3) {
    modes.push('square', 'top-row');
  }
  return modes;
}

export function coerceSandboxLayout(mode: SandboxLayoutMode, count: number): SandboxLayoutMode {
  const allowed = sandboxLayoutsForCount(count);
  if (allowed.length === 0) return 'horizontal';
  return allowed.includes(mode) ? mode : 'horizontal';
}

export type SandboxIcon = {
  id: string;
  iconKey: string;
  legendLabel: string;
  x: number;
  y: number;
};

/** Serializable sandbox graph (display-only overrides; never writes Neo4j attrs). */
export type SandboxDocument = {
  id: string;
  name: string;
  dirty: boolean;
  graphNodes: GraphNodeDto[];
  graphEdges: GraphEdgeDto[];
  nodes: AppNode[];
  edges: OrientedEdgeType[];
  icons: SandboxIcon[];
  /** Display-only label overrides (node id → text). */
  nodeLabelOverrides: Record<string, string>;
  /** Display-only label overrides (edge id → text). */
  edgeLabelOverrides: Record<string, string>;
  /** Local-only collapsed apps (same idea as Production hide). */
  hiddenNodeIds: string[];
  /** Per-sandbox Filters menu state (display-only; not Production). */
  filters: SandboxDocFilters;
};

export type SavedSandboxMeta = {
  id: string;
  name: string;
  updatedAt: string;
  document: SandboxDocument;
};

export type SandboxIconDef = {
  key: string;
  label: string;
  keywords?: string;
};

/** Combo keys use `man|dot` (see SandboxIconGlyph). */
export function splitSandboxIconKey(key: string): [string, string] | null {
  const i = key.indexOf('|');
  if (i <= 0 || i === key.length - 1) return null;
  return [key.slice(0, i), key.slice(i + 1)];
}

/** Country flag keys are stored as `flag:FR` (ISO) and rendered as images. */
export function sandboxFlagIso(iconKey: string): string | null {
  if (!iconKey.startsWith('flag:')) return null;
  const iso = iconKey.slice(5).trim().toLowerCase();
  return /^[a-z]{2}$/.test(iso) ? iso : null;
}

export function sandboxFlagImageUrl(iso: string): string {
  return `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
}

/** Currency keys are `currency:EUR` with a display glyph. */
const CURRENCY_GLYPH_BY_KEY = new Map<string, string>();

const CURRENCY_ROWS: Array<[code: string, name: string, glyph: string]> = [
  ['USD', 'US Dollar', '$'], ['EUR', 'Euro', '€'], ['GBP', 'British Pound', '£'], ['JPY', 'Japanese Yen', '¥'],
  ['CNY', 'Chinese Yuan', 'CN¥'], ['CHF', 'Swiss Franc', 'Fr'], ['CAD', 'Canadian Dollar', 'C$'],
  ['AUD', 'Australian Dollar', 'A$'], ['NZD', 'New Zealand Dollar', 'NZ$'], ['HKD', 'Hong Kong Dollar', 'HK$'],
  ['SGD', 'Singapore Dollar', 'S$'], ['INR', 'Indian Rupee', '₹'], ['KRW', 'South Korean Won', '₩'],
  ['TWD', 'New Taiwan Dollar', 'NT$'], ['THB', 'Thai Baht', '฿'], ['IDR', 'Indonesian Rupiah', 'Rp'],
  ['MYR', 'Malaysian Ringgit', 'RM'], ['PHP', 'Philippine Peso', '₱'], ['VND', 'Vietnamese Dong', '₫'],
  ['PKR', 'Pakistani Rupee', '₨'], ['BDT', 'Bangladeshi Taka', '৳'], ['LKR', 'Sri Lankan Rupee', 'Rs'],
  ['NPR', 'Nepalese Rupee', 'रू'], ['MMK', 'Myanmar Kyat', 'Ks'], ['KHR', 'Cambodian Riel', '៛'],
  ['LAK', 'Lao Kip', '₭'], ['MNT', 'Mongolian Tögrög', '₮'], ['RUB', 'Russian Ruble', '₽'],
  ['UAH', 'Ukrainian Hryvnia', '₴'], ['BYN', 'Belarusian Ruble', 'Br'], ['KZT', 'Kazakhstani Tenge', '₸'],
  ['UZS', 'Uzbekistani Som', "so'm"], ['GEL', 'Georgian Lari', '₾'], ['AMD', 'Armenian Dram', '֏'],
  ['AZN', 'Azerbaijani Manat', '₼'], ['TRY', 'Turkish Lira', '₺'], ['ILS', 'Israeli Shekel', '₪'],
  ['SAR', 'Saudi Riyal', '﷼'], ['AED', 'UAE Dirham', 'د.إ'], ['QAR', 'Qatari Riyal', 'ر.ق'],
  ['KWD', 'Kuwaiti Dinar', 'د.ك'], ['BHD', 'Bahraini Dinar', '.د.ب'], ['OMR', 'Omani Rial', 'ر.ع.'],
  ['JOD', 'Jordanian Dinar', 'د.ا'], ['EGP', 'Egyptian Pound', 'E£'], ['MAD', 'Moroccan Dirham', 'د.م.'],
  ['TND', 'Tunisian Dinar', 'د.ت'], ['DZD', 'Algerian Dinar', 'د.ج'], ['NGN', 'Nigerian Naira', '₦'],
  ['GHS', 'Ghanaian Cedi', '₵'], ['KES', 'Kenyan Shilling', 'KSh'], ['ZAR', 'South African Rand', 'R'],
  ['XOF', 'West African CFA', 'CFA'], ['XAF', 'Central African CFA', 'FCFA'],
  ['BRL', 'Brazilian Real', 'R$'], ['MXN', 'Mexican Peso', 'Mex$'], ['ARS', 'Argentine Peso', 'AR$'],
  ['CLP', 'Chilean Peso', 'CLP$'], ['COP', 'Colombian Peso', 'COL$'], ['PEN', 'Peruvian Sol', 'S/'],
  ['UYU', 'Uruguayan Peso', '$U'], ['BOB', 'Bolivian Boliviano', 'Bs'], ['PYG', 'Paraguayan Guaraní', '₲'],
  ['VES', 'Venezuelan Bolívar', 'Bs.S'], ['CRC', 'Costa Rican Colón', '₡'], ['DOP', 'Dominican Peso', 'RD$'],
  ['GTQ', 'Guatemalan Quetzal', 'Q'], ['HNL', 'Honduran Lempira', 'L'], ['NIO', 'Nicaraguan Córdoba', 'C$'],
  ['PAB', 'Panamanian Balboa', 'B/.'], ['JMD', 'Jamaican Dollar', 'J$'], ['TTD', 'Trinidad Dollar', 'TT$'],
  ['BBD', 'Barbadian Dollar', 'Bds$'], ['BSD', 'Bahamian Dollar', 'B$'], ['BMD', 'Bermudian Dollar', 'BD$'],
  ['KYD', 'Cayman Islands Dollar', 'CI$'], ['XCD', 'East Caribbean Dollar', 'EC$'],
  ['SEK', 'Swedish Krona', 'kr'], ['NOK', 'Norwegian Krone', 'kr'], ['DKK', 'Danish Krone', 'kr'],
  ['ISK', 'Icelandic Króna', 'kr'], ['PLN', 'Polish Złoty', 'zł'], ['CZK', 'Czech Koruna', 'Kč'],
  ['HUF', 'Hungarian Forint', 'Ft'], ['RON', 'Romanian Leu', 'lei'], ['BGN', 'Bulgarian Lev', 'лв'],
  ['RSD', 'Serbian Dinar', 'дин'], ['BAM', 'Bosnia Mark', 'KM'], ['MKD', 'Macedonian Denar', 'ден'],
  ['ALL', 'Albanian Lek', 'Lek'], ['HRK', 'Croatian Kuna', 'kn'], ['MDL', 'Moldovan Leu', 'L'],
  ['FJD', 'Fijian Dollar', 'FJ$'], ['PGK', 'Papua New Guinean Kina', 'K'], ['WST', 'Samoan Tala', 'WS$'],
  ['TOP', 'Tongan Paʻanga', 'T$'], ['VUV', 'Vanuatu Vatu', 'VT'], ['SBD', 'Solomon Islands Dollar', 'SI$'],
  ['XPF', 'CFP Franc', '₣'], ['MUR', 'Mauritian Rupee', '₨'], ['SCR', 'Seychellois Rupee', '₨'],
  ['MVR', 'Maldivian Rufiyaa', 'Rf'], ['AFN', 'Afghan Afghani', '؋'], ['IRR', 'Iranian Rial', '﷼'],
  ['IQD', 'Iraqi Dinar', 'ع.د'], ['LBP', 'Lebanese Pound', 'ل.ل'], ['SYP', 'Syrian Pound', '£S'],
  ['YER', 'Yemeni Rial', '﷼'], ['ETB', 'Ethiopian Birr', 'Br'], ['TZS', 'Tanzanian Shilling', 'TSh'],
  ['UGX', 'Ugandan Shilling', 'USh'], ['RWF', 'Rwandan Franc', 'FRw'], ['MGA', 'Malagasy Ariary', 'Ar'],
  ['AOA', 'Angolan Kwanza', 'Kz'], ['ZMW', 'Zambian Kwacha', 'ZK'], ['BWP', 'Botswana Pula', 'P'],
  ['NAD', 'Namibian Dollar', 'N$'], ['MZN', 'Mozambican Metical', 'MT'], ['MWK', 'Malawian Kwacha', 'MK'],
  ['CVE', 'Cape Verdean Escudo', '$'], ['GMD', 'Gambian Dalasi', 'D'], ['GNF', 'Guinean Franc', 'FG'],
  ['LRD', 'Liberian Dollar', 'L$'], ['SLL', 'Sierra Leonean Leone', 'Le'], ['SOS', 'Somali Shilling', 'Sh'],
  ['SDG', 'Sudanese Pound', 'ج.س'], ['SSP', 'South Sudanese Pound', '£'], ['LYD', 'Libyan Dinar', 'ل.د'],
  ['MRU', 'Mauritanian Ouguiya', 'UM'], ['DJF', 'Djiboutian Franc', 'Fdj'], ['KMF', 'Comorian Franc', 'CF'],
  ['STN', 'São Tomé Dobra', 'Db'], ['ERN', 'Eritrean Nakfa', 'Nfk'], ['SZL', 'Swazi Lilangeni', 'E'],
  ['LSL', 'Lesotho Loti', 'L'], ['BIF', 'Burundian Franc', 'FBu'], ['CDF', 'Congolese Franc', 'FC'],
  ['BTC', 'Bitcoin', '₿'], ['ETH', 'Ethereum', 'Ξ'], ['USDT', 'Tether', '₮'], ['USDC', 'USD Coin', '$'],
  ['XAU', 'Gold', 'Au'], ['XAG', 'Silver', 'Ag'],
];

const CURRENCY_DEFS: SandboxIconDef[] = (() => {
  const seen = new Set<string>();
  const out: SandboxIconDef[] = [];
  for (const [code, name, glyph] of CURRENCY_ROWS) {
    const key = `currency:${code.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    CURRENCY_GLYPH_BY_KEY.set(key, glyph);
    out.push({
      key,
      label: `Currency — ${code.toUpperCase()}`,
      keywords: `currency finance money ${code.toLowerCase()} ${name.toLowerCase()}`,
    });
  }
  return out;
})();

export function sandboxCurrencyGlyph(iconKey: string): string | null {
  return CURRENCY_GLYPH_BY_KEY.get(iconKey) ?? null;
}

/** IT acronym keys are `it:API` with a short display glyph. */
const IT_GLYPH_BY_KEY = new Map<string, string>();

const IT_ACRONYM_ROWS: Array<[code: string, name: string, glyph: string]> = [
  ['API', 'API', 'API'], ['SQL', 'SQL', 'SQL'], ['JSON', 'JSON', 'JSON'], ['XML', 'XML', 'XML'],
  ['HTTP', 'HTTP', 'HTTP'], ['HTTPS', 'HTTPS', 'HTTPS'], ['SSH', 'SSH', 'SSH'], ['DNS', 'DNS', 'DNS'],
  ['CDN', 'CDN', 'CDN'], ['CI', 'CI', 'CI'], ['CD', 'CD', 'CD'], ['K8S', 'Kubernetes', 'K8s'],
  ['AWS', 'AWS', 'AWS'], ['GCP', 'GCP', 'GCP'], ['AZURE', 'Azure', 'Az'], ['IAM', 'IAM', 'IAM'],
  ['SSO', 'SSO', 'SSO'], ['VPN', 'VPN', 'VPN'], ['LAN', 'LAN', 'LAN'], ['WAN', 'WAN', 'WAN'],
  ['ETL', 'ETL', 'ETL'], ['ML', 'Machine Learning', 'ML'], ['AI', 'Artificial Intelligence', 'AI'],
  ['UI', 'User Interface', 'UI'], ['UX', 'User Experience', 'UX'], ['SDK', 'SDK', 'SDK'],
  ['CLI', 'CLI', 'CLI'], ['IDE', 'IDE', 'IDE'], ['VM', 'Virtual Machine', 'VM'],
  ['SaaS', 'SaaS', 'SaaS'], ['PaaS', 'PaaS', 'PaaS'], ['IaaS', 'IaaS', 'IaaS'],
  ['CRUD', 'CRUD', 'CRUD'], ['REST', 'REST', 'REST'], ['SOAP', 'SOAP', 'SOAP'],
  ['JWT', 'JWT', 'JWT'], ['OAuth', 'OAuth', 'OAuth'], ['TLS', 'TLS', 'TLS'],
  ['HTML', 'HTML', 'HTML'], ['CSS', 'CSS', 'CSS'], ['JS', 'JavaScript', 'JS'],
  ['TS', 'TypeScript', 'TS'], ['JAVA', 'Java', 'Java'], ['PY', 'Python', 'Py'],
  ['GO', 'Go', 'Go'], ['RUST', 'Rust', 'Rust'], ['DOTNET', '.NET', '.NET'],
  ['NODE', 'Node.js', 'Node'], ['REACT', 'React', 'React'], ['DOCKER', 'Docker', 'Dock'],
  ['GIT', 'Git', 'Git'], ['NPM', 'npm', 'npm'], ['DB', 'Database', 'DB'],
  ['MQ', 'Message Queue', 'MQ'], ['CACHE', 'Cache', 'Cache'], ['LOG', 'Logs', 'Log'],
];

const IT_ACRONYM_DEFS: SandboxIconDef[] = IT_ACRONYM_ROWS.map(([code, name, glyph]) => {
  const key = `it:${code}`;
  IT_GLYPH_BY_KEY.set(key, glyph);
  return {
    key,
    label: `IT — ${name}`,
    keywords: `it tech software engineering ${code.toLowerCase()} ${name.toLowerCase()}`,
  };
});

export function sandboxItGlyph(iconKey: string): string | null {
  return IT_GLYPH_BY_KEY.get(iconKey) ?? null;
}

/** ISO country/territory flags (emoji regional indicators). */
const COUNTRY_FLAG_ROWS: Array<[iso: string, name: string]> = [
  ['AD', 'Andorra'], ['AE', 'United Arab Emirates'], ['AF', 'Afghanistan'], ['AG', 'Antigua and Barbuda'],
  ['AI', 'Anguilla'], ['AL', 'Albania'], ['AM', 'Armenia'], ['AO', 'Angola'], ['AQ', 'Antarctica'],
  ['AR', 'Argentina'], ['AS', 'American Samoa'], ['AT', 'Austria'], ['AU', 'Australia'], ['AW', 'Aruba'],
  ['AX', 'Åland Islands'], ['AZ', 'Azerbaijan'], ['BA', 'Bosnia and Herzegovina'], ['BB', 'Barbados'],
  ['BD', 'Bangladesh'], ['BE', 'Belgium'], ['BF', 'Burkina Faso'], ['BG', 'Bulgaria'], ['BH', 'Bahrain'],
  ['BI', 'Burundi'], ['BJ', 'Benin'], ['BL', 'Saint Barthélemy'], ['BM', 'Bermuda'], ['BN', 'Brunei'],
  ['BO', 'Bolivia'], ['BQ', 'Caribbean Netherlands'], ['BR', 'Brazil'], ['BS', 'Bahamas'], ['BT', 'Bhutan'],
  ['BV', 'Bouvet Island'], ['BW', 'Botswana'], ['BY', 'Belarus'], ['BZ', 'Belize'], ['CA', 'Canada'],
  ['CC', 'Cocos Islands'], ['CD', 'DR Congo'], ['CF', 'Central African Republic'], ['CG', 'Congo'],
  ['CH', 'Switzerland'], ['CI', 'Côte d’Ivoire'], ['CK', 'Cook Islands'], ['CL', 'Chile'], ['CM', 'Cameroon'],
  ['CN', 'China'], ['CO', 'Colombia'], ['CR', 'Costa Rica'], ['CU', 'Cuba'], ['CV', 'Cape Verde'],
  ['CW', 'Curaçao'], ['CX', 'Christmas Island'], ['CY', 'Cyprus'], ['CZ', 'Czechia'], ['DE', 'Germany'],
  ['DJ', 'Djibouti'], ['DK', 'Denmark'], ['DM', 'Dominica'], ['DO', 'Dominican Republic'], ['DZ', 'Algeria'],
  ['EC', 'Ecuador'], ['EE', 'Estonia'], ['EG', 'Egypt'], ['EH', 'Western Sahara'], ['ER', 'Eritrea'],
  ['ES', 'Spain'], ['ET', 'Ethiopia'], ['FI', 'Finland'], ['FJ', 'Fiji'], ['FK', 'Falkland Islands'],
  ['FM', 'Micronesia'], ['FO', 'Faroe Islands'], ['FR', 'France'], ['GA', 'Gabon'], ['GB', 'United Kingdom'],
  ['GD', 'Grenada'], ['GE', 'Georgia'], ['GF', 'French Guiana'], ['GG', 'Guernsey'], ['GH', 'Ghana'],
  ['GI', 'Gibraltar'], ['GL', 'Greenland'], ['GM', 'Gambia'], ['GN', 'Guinea'], ['GP', 'Guadeloupe'],
  ['GQ', 'Equatorial Guinea'], ['GR', 'Greece'], ['GS', 'South Georgia'], ['GT', 'Guatemala'],
  ['GU', 'Guam'], ['GW', 'Guinea-Bissau'], ['GY', 'Guyana'], ['HK', 'Hong Kong'], ['HM', 'Heard Island'],
  ['HN', 'Honduras'], ['HR', 'Croatia'], ['HT', 'Haiti'], ['HU', 'Hungary'], ['ID', 'Indonesia'],
  ['IE', 'Ireland'], ['IL', 'Israel'], ['IM', 'Isle of Man'], ['IN', 'India'], ['IO', 'British Indian Ocean Territory'],
  ['IQ', 'Iraq'], ['IR', 'Iran'], ['IS', 'Iceland'], ['IT', 'Italy'], ['JE', 'Jersey'], ['JM', 'Jamaica'],
  ['JO', 'Jordan'], ['JP', 'Japan'], ['KE', 'Kenya'], ['KG', 'Kyrgyzstan'], ['KH', 'Cambodia'],
  ['KI', 'Kiribati'], ['KM', 'Comoros'], ['KN', 'Saint Kitts and Nevis'], ['KP', 'North Korea'],
  ['KR', 'South Korea'], ['KW', 'Kuwait'], ['KY', 'Cayman Islands'], ['KZ', 'Kazakhstan'], ['LA', 'Laos'],
  ['LB', 'Lebanon'], ['LC', 'Saint Lucia'], ['LI', 'Liechtenstein'], ['LK', 'Sri Lanka'], ['LR', 'Liberia'],
  ['LS', 'Lesotho'], ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['LV', 'Latvia'], ['LY', 'Libya'],
  ['MA', 'Morocco'], ['MC', 'Monaco'], ['MD', 'Moldova'], ['ME', 'Montenegro'], ['MF', 'Saint Martin'],
  ['MG', 'Madagascar'], ['MH', 'Marshall Islands'], ['MK', 'North Macedonia'], ['ML', 'Mali'],
  ['MM', 'Myanmar'], ['MN', 'Mongolia'], ['MO', 'Macao'], ['MP', 'Northern Mariana Islands'],
  ['MQ', 'Martinique'], ['MR', 'Mauritania'], ['MS', 'Montserrat'], ['MT', 'Malta'], ['MU', 'Mauritius'],
  ['MV', 'Maldives'], ['MW', 'Malawi'], ['MX', 'Mexico'], ['MY', 'Malaysia'], ['MZ', 'Mozambique'],
  ['NA', 'Namibia'], ['NC', 'New Caledonia'], ['NE', 'Niger'], ['NF', 'Norfolk Island'], ['NG', 'Nigeria'],
  ['NI', 'Nicaragua'], ['NL', 'Netherlands'], ['NO', 'Norway'], ['NP', 'Nepal'], ['NR', 'Nauru'],
  ['NU', 'Niue'], ['NZ', 'New Zealand'], ['OM', 'Oman'], ['PA', 'Panama'], ['PE', 'Peru'],
  ['PF', 'French Polynesia'], ['PG', 'Papua New Guinea'], ['PH', 'Philippines'], ['PK', 'Pakistan'],
  ['PL', 'Poland'], ['PM', 'Saint Pierre and Miquelon'], ['PN', 'Pitcairn'], ['PR', 'Puerto Rico'],
  ['PS', 'Palestine'], ['PT', 'Portugal'], ['PW', 'Palau'], ['PY', 'Paraguay'], ['QA', 'Qatar'],
  ['RE', 'Réunion'], ['RO', 'Romania'], ['RS', 'Serbia'], ['RU', 'Russia'], ['RW', 'Rwanda'],
  ['SA', 'Saudi Arabia'], ['SB', 'Solomon Islands'], ['SC', 'Seychelles'], ['SD', 'Sudan'],
  ['SE', 'Sweden'], ['SG', 'Singapore'], ['SH', 'Saint Helena'], ['SI', 'Slovenia'], ['SJ', 'Svalbard'],
  ['SK', 'Slovakia'], ['SL', 'Sierra Leone'], ['SM', 'San Marino'], ['SN', 'Senegal'], ['SO', 'Somalia'],
  ['SR', 'Suriname'], ['SS', 'South Sudan'], ['ST', 'São Tomé and Príncipe'], ['SV', 'El Salvador'],
  ['SX', 'Sint Maarten'], ['SY', 'Syria'], ['SZ', 'Eswatini'], ['TC', 'Turks and Caicos'],
  ['TD', 'Chad'], ['TF', 'French Southern Territories'], ['TG', 'Togo'], ['TH', 'Thailand'],
  ['TJ', 'Tajikistan'], ['TK', 'Tokelau'], ['TL', 'Timor-Leste'], ['TM', 'Turkmenistan'], ['TN', 'Tunisia'],
  ['TO', 'Tonga'], ['TR', 'Turkey'], ['TT', 'Trinidad and Tobago'], ['TV', 'Tuvalu'], ['TW', 'Taiwan'],
  ['TZ', 'Tanzania'], ['UA', 'Ukraine'], ['UG', 'Uganda'], ['UM', 'US Outlying Islands'],
  ['US', 'United States'], ['UY', 'Uruguay'], ['UZ', 'Uzbekistan'], ['VA', 'Vatican City'],
  ['VC', 'Saint Vincent and the Grenadines'], ['VE', 'Venezuela'], ['VG', 'British Virgin Islands'],
  ['VI', 'US Virgin Islands'], ['VN', 'Vietnam'], ['VU', 'Vanuatu'], ['WF', 'Wallis and Futuna'],
  ['WS', 'Samoa'], ['XK', 'Kosovo'], ['YE', 'Yemen'], ['YT', 'Mayotte'], ['ZA', 'South Africa'],
  ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'],
];

const COUNTRY_FLAGS: SandboxIconDef[] = COUNTRY_FLAG_ROWS.map(([iso, name]) => ({
  key: `flag:${iso.toUpperCase()}`,
  label: `Country — ${name}`,
  keywords: `flag country ${iso.toLowerCase()} ${name.toLowerCase()}`,
}));

/** Flat business-oriented emoji palette (filterable in Toolkit Icons). */
const SANDBOX_ICON_BASE: SandboxIconDef[] = [
  { key: '🏢', label: 'Building', keywords: 'office company hq' },
  { key: '🏭', label: 'Factory', keywords: 'plant industry manufacturing' },
  { key: '🏪', label: 'Store', keywords: 'shop retail' },
  { key: '🏛️', label: 'Bank', keywords: 'finance institution government' },
  { key: '👥', label: 'Users', keywords: 'people team group' },
  { key: '👤', label: 'User', keywords: 'person employee' },
  // Men / women — ethnicities (skin tones)
  { key: '👨', label: 'Man — Default', keywords: 'man people person ethnicity' },
  { key: '👨🏻', label: 'Man — Light', keywords: 'man people person ethnicity skin' },
  { key: '👨🏼', label: 'Man — Medium-Light', keywords: 'man people person ethnicity skin' },
  { key: '👨🏽', label: 'Man — Medium', keywords: 'man people person ethnicity skin' },
  { key: '👨🏾', label: 'Man — Medium-Dark', keywords: 'man people person ethnicity skin' },
  { key: '👨🏿', label: 'Man — Dark', keywords: 'man people person ethnicity skin' },
  { key: '👩', label: 'Woman — Default', keywords: 'woman people person ethnicity' },
  { key: '👩🏻', label: 'Woman — Light', keywords: 'woman people person ethnicity skin' },
  { key: '👩🏼', label: 'Woman — Medium-Light', keywords: 'woman people person ethnicity skin' },
  { key: '👩🏽', label: 'Woman — Medium', keywords: 'woman people person ethnicity skin' },
  { key: '👩🏾', label: 'Woman — Medium-Dark', keywords: 'woman people person ethnicity skin' },
  { key: '👩🏿', label: 'Woman — Dark', keywords: 'woman people person ethnicity skin' },
  // Hands only
  { key: '✋', label: 'Hand', keywords: 'hand contributor' },
  { key: '🖐️', label: 'Open hand', keywords: 'hand contributor open' },
  { key: '🤚', label: 'Raised hand', keywords: 'hand contributor raised' },
  { key: '👋', label: 'Wave', keywords: 'hand contributor hello' },
  { key: '🤝', label: 'Handshake', keywords: 'deal partner agreement contributor hand' },
  // Color dots only
  { key: '🔴', label: 'Color — Red', keywords: 'color dot team red' },
  { key: '🔵', label: 'Color — Blue', keywords: 'color dot team blue' },
  { key: '🟢', label: 'Color — Green', keywords: 'color dot team green' },
  { key: '🟡', label: 'Color — Yellow', keywords: 'color dot team yellow' },
  { key: '🟠', label: 'Color — Orange', keywords: 'color dot team orange' },
  { key: '🟣', label: 'Color — Purple', keywords: 'color dot team purple' },
  { key: '🟤', label: 'Color — Brown', keywords: 'color dot team brown' },
  { key: '⚫', label: 'Color — Black', keywords: 'color dot team black' },
  { key: '⚪', label: 'Color — White', keywords: 'color dot team white' },
  // Man + color dot (combo key man|dot)
  { key: '👨|🔴', label: 'Team — Red', keywords: 'team man color red' },
  { key: '👨|🔵', label: 'Team — Blue', keywords: 'team man color blue' },
  { key: '👨|🟢', label: 'Team — Green', keywords: 'team man color green' },
  { key: '👨|🟡', label: 'Team — Yellow', keywords: 'team man color yellow' },
  { key: '👨|🟠', label: 'Team — Orange', keywords: 'team man color orange' },
  { key: '👨|🟣', label: 'Team — Purple', keywords: 'team man color purple' },
  { key: '👨|🟤', label: 'Team — Brown', keywords: 'team man color brown' },
  { key: '👨|⚫', label: 'Team — Black', keywords: 'team man color black' },
  { key: '👨|⚪', label: 'Team — White', keywords: 'team man color white' },
  { key: '💼', label: 'Briefcase', keywords: 'work business job' },
  { key: '📊', label: 'Chart', keywords: 'analytics stats report finance' },
  { key: '📈', label: 'Growth', keywords: 'trend up analytics finance' },
  { key: '📉', label: 'Decline', keywords: 'trend down finance' },
  { key: '💰', label: 'Money', keywords: 'cash finance revenue budget' },
  { key: '💳', label: 'Card', keywords: 'payment credit finance' },
  { key: '🧾', label: 'Invoice', keywords: 'receipt bill finance cost' },
  { key: '💱', label: 'Exchange', keywords: 'currency forex finance' },
  { key: '💵', label: 'Banknote — USD', keywords: 'currency finance money usd dollar note' },
  { key: '💶', label: 'Banknote — EUR', keywords: 'currency finance money eur euro note' },
  { key: '💷', label: 'Banknote — GBP', keywords: 'currency finance money gbp pound note' },
  { key: '💴', label: 'Banknote — JPY', keywords: 'currency finance money jpy yen note' },
  { key: '🪙', label: 'Coin', keywords: 'cash finance money budget' },
  { key: '👛', label: 'Wallet', keywords: 'finance money purse budget' },
  { key: '🏦', label: 'ATM bank', keywords: 'finance bank atm money' },
  { key: '🐷', label: 'Piggy bank', keywords: 'finance savings money budget' },
  { key: '💎', label: 'Diamond', keywords: 'finance asset wealth value' },
  { key: '💹', label: 'Market', keywords: 'finance stocks yen chart trading' },
  { key: '💲', label: 'Dollar sign', keywords: 'finance money cost price usd' },
  { key: '💯', label: 'Percent', keywords: 'finance rate percent cost' },
  { key: '🏧', label: 'ATM', keywords: 'finance bank cash money' },
  { key: '🔐', label: 'Safe', keywords: 'finance vault secure money' },
  { key: '📑', label: 'Portfolio', keywords: 'finance documents ledger' },
  { key: '🕯️', label: 'Candles', keywords: 'finance trading chart stocks' },
  { key: '☁️', label: 'Cloud', keywords: 'it saas aws azure cloud' },
  { key: '💻', label: 'Laptop', keywords: 'it computer device laptop' },
  { key: '🖥️', label: 'Desktop', keywords: 'it computer workstation desktop' },
  { key: '📱', label: 'Phone', keywords: 'it mobile device phone' },
  { key: '💾', label: 'Server', keywords: 'it host infrastructure storage server' },
  { key: '🗄️', label: 'Database', keywords: 'it data storage db database' },
  { key: '🔌', label: 'Plugin', keywords: 'it integration connect plugin' },
  { key: '🔗', label: 'Link', keywords: 'it connection url link' },
  { key: '🔒', label: 'Lock', keywords: 'it security private lock' },
  { key: '🔑', label: 'Key', keywords: 'it access credential key' },
  { key: '🛡️', label: 'Shield', keywords: 'it security protect shield' },
  // IT / tech
  { key: '⌨️', label: 'IT — Keyboard', keywords: 'it tech keyboard input' },
  { key: '🖱️', label: 'IT — Mouse', keywords: 'it tech mouse input' },
  { key: '🖨️', label: 'IT — Printer', keywords: 'it tech printer hardware' },
  { key: '🔋', label: 'IT — Battery', keywords: 'it tech battery power' },
  { key: '📶', label: 'IT — Signal', keywords: 'it tech wifi network signal' },
  { key: '🛰️', label: 'IT — Satellite', keywords: 'it tech satellite network' },
  { key: '🐛', label: 'IT — Bug', keywords: 'it tech bug defect issue' },
  { key: '⚡', label: 'IT — Lightning', keywords: 'it tech performance power' },
  { key: '🔥', label: 'IT — Fire', keywords: 'it tech hotfix incident' },
  { key: '🧪', label: 'IT — Test', keywords: 'it tech test qa lab' },
  { key: '🧬', label: 'IT — DNA', keywords: 'it tech data genetics algorithm' },
  { key: '🧑‍💻', label: 'IT — Developer', keywords: 'it tech developer engineer coder' },
  { key: '👨‍💻', label: 'IT — Man Technologist', keywords: 'it tech developer engineer' },
  { key: '👩‍💻', label: 'IT — Woman Technologist', keywords: 'it tech developer engineer' },
  { key: '🕹️', label: 'IT — Joystick', keywords: 'it tech game controller' },
  { key: '🧮', label: 'IT — Abacus', keywords: 'it tech compute calculator' },
  { key: '💿', label: 'IT — Disc', keywords: 'it tech disc cd storage' },
  { key: '📀', label: 'IT — DVD', keywords: 'it tech dvd disc storage' },
  { key: '🔓', label: 'IT — Unlock', keywords: 'it tech security unlock open' },
  { key: '🔏', label: 'IT — Locked Pen', keywords: 'it tech security privacy' },
  { key: '🧲', label: 'IT — Magnet', keywords: 'it tech magnet attract' },
  { key: '🧯', label: 'IT — Extinguisher', keywords: 'it tech incident firefight' },
  { key: '🧱', label: 'IT — Brick', keywords: 'it tech firewall brick wall' },
  { key: '🧰', label: 'IT — Toolbox', keywords: 'it tech tools toolbox' },
  { key: '🪛', label: 'IT — Screwdriver', keywords: 'it tech tools fix' },
  { key: '🪜', label: 'IT — Ladder', keywords: 'it tech ladder stack' },
  { key: '🪞', label: 'IT — Mirror', keywords: 'it tech mirror replica' },
  { key: '👓', label: 'IT — Glasses', keywords: 'it tech review inspect' },
  { key: '🔭', label: 'IT — Telescope', keywords: 'it tech observe monitor' },
  { key: '⏱️', label: 'IT — Stopwatch', keywords: 'it tech latency timer sla' },
  { key: '⚠️', label: 'Warning', keywords: 'alert risk' },
  { key: '✅', label: 'Check', keywords: 'ok done success' },
  { key: '❌', label: 'Cross', keywords: 'error fail stop' },
  { key: '⭐', label: 'Star', keywords: 'favorite important' },
  { key: '📌', label: 'Pin', keywords: 'mark note' },
  { key: '🏷️', label: 'Tag', keywords: 'label category' },
  { key: '💡', label: 'Idea', keywords: 'light innovation' },
  { key: '🎯', label: 'Target', keywords: 'goal kpi' },
  { key: '🚀', label: 'Rocket', keywords: 'launch growth' },
  { key: '📅', label: 'Calendar', keywords: 'date schedule' },
  { key: '⏰', label: 'Clock', keywords: 'time deadline' },
  { key: '📧', label: 'Mail', keywords: 'email message' },
  { key: '📞', label: 'Call', keywords: 'phone contact' },
  { key: '💬', label: 'Chat', keywords: 'message talk' },
  { key: '📄', label: 'Document', keywords: 'file paper' },
  { key: '📁', label: 'Folder', keywords: 'files directory' },
  { key: '📦', label: 'Package', keywords: 'box delivery product' },
  { key: '🚚', label: 'Truck', keywords: 'logistics shipping' },
  { key: '🌍', label: 'Globe', keywords: 'world global international' },
  { key: '🗺️', label: 'Map', keywords: 'location geography' },
  { key: '📍', label: 'Location', keywords: 'pin place' },
  { key: '🛒', label: 'Cart', keywords: 'ecommerce shop' },
  { key: '⚙️', label: 'Settings', keywords: 'gear config' },
  { key: '🔧', label: 'Wrench', keywords: 'tools maintenance' },
  { key: '🛠️', label: 'Tools', keywords: 'build fix' },
  { key: '📡', label: 'IT — Antenna', keywords: 'it tech network signal api antenna' },
  { key: '🧩', label: 'Puzzle', keywords: 'module component' },
  { key: '🔁', label: 'Sync', keywords: 'refresh cycle process' },
  { key: '⏸️', label: 'Pause', keywords: 'hold stop' },
  { key: '▶️', label: 'Play', keywords: 'start run' },
  { key: '🔔', label: 'Bell', keywords: 'notification alert' },
  { key: '📝', label: 'Note', keywords: 'write edit' },
  { key: '📋', label: 'Clipboard', keywords: 'list checklist' },
  { key: '🧠', label: 'Brain', keywords: 'ai ml intelligence' },
  { key: '🤖', label: 'Robot', keywords: 'ai automation bot' },
  { key: '🌐', label: 'Web', keywords: 'internet www' },
  { key: '🪪', label: 'ID', keywords: 'badge identity' },
  { key: '📐', label: 'Ruler', keywords: 'measure design' },
  { key: '🔬', label: 'Science', keywords: 'lab research' },
  { key: '🏥', label: 'Hospital', keywords: 'health medical' },
  { key: '🎓', label: 'Education', keywords: 'school learning' },
  { key: '⚖️', label: 'Legal', keywords: 'law compliance' },
  { key: '📣', label: 'Megaphone', keywords: 'marketing announce' },
];

export const SANDBOX_ICON_PALETTE: SandboxIconDef[] = [
  ...SANDBOX_ICON_BASE,
  ...IT_ACRONYM_DEFS,
  ...CURRENCY_DEFS,
  ...COUNTRY_FLAGS,
];

export function sandboxIconLabel(iconKey: string): string {
  return SANDBOX_ICON_PALETTE.find((i) => i.key === iconKey)?.label ?? 'Icon';
}

export function createSandboxDocumentId(): string {
  return `sandbox-doc-${crypto.randomUUID()}`;
}

export function createSandboxIconId(): string {
  return `sandbox-icon-${crypto.randomUUID()}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Deep-clone current graph into an independent sandbox document. */
export function cloneIntoSandboxDocument(
  name: string,
  graphNodes: GraphNodeDto[],
  graphEdges: GraphEdgeDto[],
  nodes: AppNode[],
  edges: Edge[]
): SandboxDocument {
  return {
    id: createSandboxDocumentId(),
    name,
    dirty: false,
    graphNodes: cloneJson(graphNodes),
    graphEdges: cloneJson(graphEdges),
    nodes: cloneJson(nodes) as AppNode[],
    edges: cloneJson(edges) as OrientedEdgeType[],
    icons: [],
    nodeLabelOverrides: {},
    edgeLabelOverrides: {},
    hiddenNodeIds: [],
    filters: { ...EMPTY_SANDBOX_FILTERS },
  };
}

/** Deep-clone an open sandbox into a new independent document. */
export function cloneSandboxDocument(source: SandboxDocument, name: string): SandboxDocument {
  const copy = cloneJson(source);
  return {
    ...copy,
    id: createSandboxDocumentId(),
    name,
    dirty: true,
    hiddenNodeIds: copy.hiddenNodeIds ?? [],
    filters: copy.filters ?? { ...EMPTY_SANDBOX_FILTERS },
  };
}

/** Normalize older saved docs that may omit newer fields. */
export function normalizeSandboxDocument(doc: SandboxDocument): SandboxDocument {
  return {
    ...doc,
    icons: doc.icons ?? [],
    nodeLabelOverrides: doc.nodeLabelOverrides ?? {},
    edgeLabelOverrides: doc.edgeLabelOverrides ?? {},
    hiddenNodeIds: doc.hiddenNodeIds ?? [],
    filters: doc.filters ?? { ...EMPTY_SANDBOX_FILTERS },
  };
}

export function loadSavedSandboxes(): SavedSandboxMeta[] {
  try {
    const raw = localStorage.getItem(SANDBOX_SAVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSandboxMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function storeSavedSandboxes(items: SavedSandboxMeta[]): void {
  try {
    localStorage.setItem(SANDBOX_SAVED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function sandboxLayoutClass(mode: SandboxLayoutMode, count: number): string {
  if (count <= 1) return 'sandbox-board sandbox-board--single';
  const safe = coerceSandboxLayout(mode, count);
  return `sandbox-board sandbox-board--${safe} sandbox-board--n${Math.min(count, 4)}`;
}
