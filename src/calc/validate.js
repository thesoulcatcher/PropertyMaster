// Shared input checks for every calculator. A blank, NaN, infinite, negative or
// absurdly large input is refused with a clear message. It never becomes a number.

export const MAX_MONEY = 1_000_000_000;

// Returns the value when it is a finite number in [min, max]; otherwise throws.
export function num(value, name, { min = 0, max = MAX_MONEY } = {}) {
  if (value === null || value === undefined || value === '') {
    throw new TypeError(`${name} is required.`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  if (value < min) {
    throw new RangeError(`${name} cannot be below ${min}.`);
  }
  if (value > max) {
    throw new RangeError(`${name} is above the sanity cap of ${max}. Check the input.`);
  }
  return value;
}

// Optional number: blank means the default, anything given is checked.
export function optNum(value, name, fallback, opts) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return num(value, name, opts);
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}
