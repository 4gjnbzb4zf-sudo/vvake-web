/**
 * Brand names for tickers shown in My Pulse and Sweat pairing. Names and tickers identify listed
 * companies (factual use, C15); no logo, slogan or claim of affiliation. When a brand signs a
 * partnership that licenses its marks, set `partnerLogo` and the UI shows the official logo + "Partner".
 */
export interface Brand {
  name: string;
  /** Official logo URL, only under a signed partnership. */
  partnerLogo?: string;
}

export const BRANDS: Readonly<Record<string, Brand>> = {
  NKE: { name: "Nike" },
  ONON: { name: "On" },
  DECK: { name: "Deckers (HOKA)" },
  LULU: { name: "lululemon" },
  GRMN: { name: "Garmin" },
  UAA: { name: "Under Armour" },
  AAPL: { name: "Apple" },
  COLM: { name: "Columbia" },
  VFC: { name: "VF Corp (The North Face)" },
  ADDYY: { name: "adidas" },
  SHMDF: { name: "Shimano" },
  BTC: { name: "Bitcoin" },
  ETH: { name: "Ether" },
};

export const brandName = (symbol: string) => BRANDS[symbol]?.name ?? symbol;
