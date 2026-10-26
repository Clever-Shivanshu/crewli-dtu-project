import { getSkill, addOnsTotal } from './catalog.js';

/**
 * Compute the offered price for a given skill + travel distance + add-ons.
 * This is what a worker will earn if they accept the job.
 */
export function computePrice(skillKey, distanceKm, addOns) {
  const s = getSkill(skillKey);
  if (!s) return { basePrice: 0, perKmRate: 0, price: 0, distanceKm: 0, addOnsTotal: 0 };

  const dist = Math.max(0, distanceKm || 0);
  const addOnSum = addOnsTotal(addOns);
  const price = Math.round(s.basePrice + dist * s.perKmRate + addOnSum);
  return {
    basePrice: s.basePrice,
    perKmRate: s.perKmRate,
    distanceKm: +dist.toFixed(2),
    addOnsTotal: addOnSum,
    price,
  };
}
