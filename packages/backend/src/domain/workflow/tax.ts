export interface TaxLine {
  totalPriceCents: number;
  vatRatePercent?: number | null;
}

export interface TaxBand {
  ratePercent: number;
  taxableBaseCents: number;
  vatCents: number;
  totalCents: number;
}

/**
 * Calculates VAT from tax-inclusive line prices, preserving integer cents.
 * Each line is rounded once and then summed to an immutable tax breakdown.
 */
export function calculateTicketTax(lines: TaxLine[], defaultRate: number) {
  const byRate = new Map<number, TaxBand>();
  for (const line of lines) {
    const rate = line.vatRatePercent ?? defaultRate;
    if (!Number.isInteger(rate) || rate < 0 || rate > 100) {
      throw new Error('Invalid item VAT rate');
    }
    if (!Number.isSafeInteger(line.totalPriceCents) || line.totalPriceCents < 0) {
      throw new Error('Invalid ticket line value');
    }
    const base = Math.round(line.totalPriceCents * 100 / (100 + rate));
    const vat = line.totalPriceCents - base;
    const current = byRate.get(rate) ?? { ratePercent: rate, taxableBaseCents: 0, vatCents: 0, totalCents: 0 };
    current.taxableBaseCents += base;
    current.vatCents += vat;
    current.totalCents += line.totalPriceCents;
    byRate.set(rate, current);
  }
  const breakdown = [...byRate.values()].sort((a, b) => a.ratePercent - b.ratePercent);
  return {
    taxableBaseCents: breakdown.reduce((sum, band) => sum + band.taxableBaseCents, 0),
    vatCents: breakdown.reduce((sum, band) => sum + band.vatCents, 0),
    // 0 on mixed-rate tickets; the detailed breakdown is authoritative.
    vatRatePercent: breakdown.length === 1 ? breakdown[0].ratePercent : 0,
    taxBreakdownJson: JSON.stringify(breakdown),
  };
}
