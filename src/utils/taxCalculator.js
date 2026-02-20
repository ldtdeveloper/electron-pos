/**
 * Tax calculation based on customer, item, address, and price list.
 *
 * Tax order (output tax from duties_and_taxes):
 * 1. Customer tax category: out state → IGST; in state → CGST+SGST.
 * 2. Else item tax category: out state → IGST; in state → CGST+SGST.
 * 3. Else item tax template (GST 12%, 28%, 5%, 18%) → apply that rate as IGST.
 * 4. Else compare customer address (state) vs company address (state):
 *    - Customer has no address → CGST+SGST.
 *    - Company has no address → IGST.
 *    - Same state → CGST+SGST; different state → IGST.
 *
 * Price list for POS: use customer default_price_list when set; else POS profile price list (handled in posStore + api).
 */

const OUT_STATE_KEYWORDS = ['out of state', 'outstate', 'out state', 'inter state', 'interstate', 'overseas'];
const IN_STATE_KEYWORDS = ['in state', 'instate', 'intra state', 'intrastate', 'within state'];

const GST_TEMPLATE_RATES = {
  28: 28,
  12: 12,
  5: 5,
  18: 18,
};

function isOutState(taxCategory) {
  if (!taxCategory || typeof taxCategory !== 'string') return false;
  const lower = taxCategory.toLowerCase().trim();
  return OUT_STATE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isInState(taxCategory) {
  if (!taxCategory || typeof taxCategory !== 'string') return false;
  const lower = taxCategory.toLowerCase().trim();
  return IN_STATE_KEYWORDS.some((kw) => lower.includes(kw));
}

function getGstRateFromTemplate(templateName) {
  if (!templateName || typeof templateName !== 'string') return null;
  const match = templateName.match(/GST\s*(\d+)%/i);
  if (!match) return null;
  const rate = parseInt(match[1], 10);
  return GST_TEMPLATE_RATES.hasOwnProperty(rate) ? rate : rate;
}

function normalizeState(state) {
  if (!state || typeof state !== 'string') return '';
  return state.trim().toLowerCase();
}

function statesAreSame(customerState, companyState) {
  const c = normalizeState(customerState);
  const co = normalizeState(companyState);
  if (!c || !co) return false;
  return c === co;
}

function getTaxByAccountPattern(taxes, pattern) {
  if (!Array.isArray(taxes)) return null;
  const lower = (pattern || '').toLowerCase();
  return taxes.find((t) => {
    if (t.is_group === 1) return false;
    const name = (t.name || '').toLowerCase();
    const account = (t.account_name || '').toLowerCase();
    return name.includes(lower) || account.includes(lower);
  });
}

/**
 * Determine tax for a single cart item based on the 4-tier check.
 * Returns { rate, type: 'igst'|'cgst_sgst'|'template', taxRate, cgstRate, sgstRate }
 */
function getItemTaxInfo(item, customer, taxes, companyState) {
  const igstTax = getTaxByAccountPattern(taxes, 'output tax igst');
  const cgstTax = getTaxByAccountPattern(taxes, 'output tax cgst');
  const sgstTax = getTaxByAccountPattern(taxes, 'output tax sgst');

  const customerTaxCat = customer?.tax_category || customer?.gst_category || '';
  const itemTaxCat = item?.tax_category || '';
  const itemTemplate = item?.item_tax_template || '';
  const customerState = customer?.state || customer?.gst_state || customer?.address_state || '';
  const compState = companyState || '';

  // Check 1: Customer tax category — if present, use only this; do not check item or address
  if (customerTaxCat) {
    if (isInState(customerTaxCat)) {
      const cRate = cgstTax?.tax_rate ?? 0;
      const sRate = sgstTax?.tax_rate ?? 0;
      return { type: 'cgst_sgst', rate: cRate + sRate, cgstRate: cRate, sgstRate: sRate, taxRate: cRate + sRate };
    }
    // Out state or any other category → IGST
    const rate = igstTax?.tax_rate ?? 0;
    return { type: 'igst', rate, igstRate: rate, taxRate: rate };
  }

  // Check 2: Item tax category (only when customer has no tax category)
  if (itemTaxCat) {
    if (isOutState(itemTaxCat)) {
      const rate = igstTax?.tax_rate ?? 0;
      return { type: 'igst', rate, igstRate: rate, taxRate: rate };
    }
    if (isInState(itemTaxCat)) {
      const cRate = cgstTax?.tax_rate ?? 0;
      const sRate = sgstTax?.tax_rate ?? 0;
      return { type: 'cgst_sgst', rate: cRate + sRate, cgstRate: cRate, sgstRate: sRate, taxRate: cRate + sRate };
    }
  }

  // Check 3: Item tax template (GST 28%, 12%, 5%, 18%)
  const templateRate = getGstRateFromTemplate(itemTemplate);
  if (templateRate != null) {
    return { type: 'template', rate: templateRate, igstRate: templateRate, taxRate: templateRate };
  }

  // Check 4: No customer tax_category, no item tax_category, no tax template
  // → Compare customer address (state) and company address (state)
  // Customer has no address → CGST+SGST
  if (!customerState) {
    const cRate = cgstTax?.tax_rate ?? 0;
    const sRate = sgstTax?.tax_rate ?? 0;
    return { type: 'cgst_sgst', rate: cRate + sRate, cgstRate: cRate, sgstRate: sRate, taxRate: cRate + sRate };
  }
  // Company has no address (cannot compare) → IGST
  if (!compState) {
    const rate = igstTax?.tax_rate ?? 0;
    return { type: 'igst', rate, igstRate: rate, taxRate: rate };
  }
  // Both have addresses: same state → CGST+SGST, different state → IGST
  if (statesAreSame(customerState, compState)) {
    const cRate = cgstTax?.tax_rate ?? 0;
    const sRate = sgstTax?.tax_rate ?? 0;
    return { type: 'cgst_sgst', rate: cRate + sRate, cgstRate: cRate, sgstRate: sRate, taxRate: cRate + sRate };
  }
  const rate = igstTax?.tax_rate ?? 0;
  return { type: 'igst', rate, igstRate: rate, taxRate: rate };
}

/**
 * Calculate total tax for cart.
 * @param {Array} cart - Cart items with rate, quantity, item_tax_template, tax_category
 * @param {Object} customer - Customer with tax_category, state
 * @param {Object} dutiesAndTaxes - { taxes: [...] } from get_duties_and_taxes_list
 * @param {string} companyState - Company state from POS profile
 * @returns {Object} { totalTax, subtotal, grandTotal, breakdown: [{ label, rate, amount }] }
 */
export function calculateCartTax(cart, customer, dutiesAndTaxes, companyState) {
  const taxes = dutiesAndTaxes?.taxes || [];
  let subtotal = 0;
  const itemTaxes = [];
  let totalTax = 0;

  for (const item of cart || []) {
    const itemAmount = (item.rate || 0) * (item.quantity || 0);
    subtotal += itemAmount;

    const taxInfo = getItemTaxInfo(item, customer, taxes, companyState);
    const itemTaxAmount = itemAmount * (taxInfo.rate / 100);
    totalTax += itemTaxAmount;

    if (itemTaxAmount > 0) {
      if (taxInfo.type === 'cgst_sgst') {
        itemTaxes.push({
          label: 'CGST',
          rate: taxInfo.cgstRate,
          amount: itemAmount * (taxInfo.cgstRate / 100),
        });
        itemTaxes.push({
          label: 'SGST',
          rate: taxInfo.sgstRate,
          amount: itemAmount * (taxInfo.sgstRate / 100),
        });
      } else {
        itemTaxes.push({
          label: 'IGST',
          rate: taxInfo.rate,
          amount: itemTaxAmount,
        });
      }
    }
  }

  const grandTotal = Math.round(subtotal + totalTax);

  const breakdown = itemTaxes.reduce((acc, t) => {
    const existing = acc.find((b) => b.label === t.label && b.rate === t.rate);
    if (existing) {
      existing.amount += t.amount;
    } else {
      acc.push({ label: t.label, rate: t.rate, amount: t.amount });
    }
    return acc;
  }, []);

  return {
    subtotal,
    totalTax,
    grandTotal,
    breakdown: breakdown.filter((b) => b.amount > 0),
  };
}
