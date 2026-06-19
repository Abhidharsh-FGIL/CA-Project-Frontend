/**
 * Smart rounding distribution algorithm.
 * Distributes `total` items across keys based on percentage weights,
 * guaranteeing the sum equals `total` exactly.
 */
export function distributeQuestions(
  total: number,
  weights: Record<string, number>
): Record<string, number> {
  const entries = Object.entries(weights);
  if (entries.length === 0) return {};
  if (entries.length === 1) return { [entries[0][0]]: total };

  // Compute raw values and floor
  const raw = entries.map(([key, w]) => ({
    key,
    exact: (total * w) / 100,
    floor: 0,
    remainder: 0,
  }));

  raw.forEach((r) => {
    r.floor = Math.floor(r.exact);
    r.remainder = r.exact - r.floor;
  });

  let assigned = raw.reduce((s, r) => s + r.floor, 0);
  let remaining = total - assigned;

  // Sort by remainder descending, distribute extras
  const sorted = [...raw].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining && i < sorted.length; i++) {
    sorted[i].floor += 1;
  }

  const result: Record<string, number> = {};
  raw.forEach((r) => {
    result[r.key] = r.floor;
  });
  return result;
}

/**
 * Validates a weightage map: each value 1-100, max 2 decimals, total = 100.
 */
export function validateWeightage(weights: Record<string, number>): {
  valid: boolean;
  total: number;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  let total = 0;

  for (const [key, val] of Object.entries(weights)) {
    if (val == null || isNaN(val)) {
      errors[key] = 'Required';
      continue;
    }
    if (val < 1) {
      errors[key] = 'Min 1%';
    } else if (val > 100) {
      errors[key] = 'Max 100%';
    } else {
      // Check decimal precision
      const parts = String(val).split('.');
      if (parts[1] && parts[1].length > 2) {
        errors[key] = 'Max 2 decimals';
      }
    }
    total += val;
  }

  // Round to avoid floating point issues
  total = Math.round(total * 100) / 100;
  const valid = Object.keys(errors).length === 0 && Math.abs(total - 100) < 0.01;

  return { valid, total, errors };
}

/**
 * Auto-distributes weight evenly across items, rounded to 2 decimal places.
 */
export function distributeEvenly(keys: string[]): Record<string, number> {
  if (keys.length === 0) return {};
  if (keys.length === 1) return { [keys[0]]: 100 };

  const base = Math.floor((10000 / keys.length)) / 100; // 2 decimal places
  const result: Record<string, number> = {};
  let assigned = 0;

  keys.forEach((key, i) => {
    if (i < keys.length - 1) {
      result[key] = base;
      assigned += base;
    } else {
      // Last item gets the remainder to ensure exactly 100
      result[key] = Math.round((100 - assigned) * 100) / 100;
    }
  });

  return result;
}
