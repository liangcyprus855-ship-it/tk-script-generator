import { quoteDuration } from '../../../la02-api/pricing.mjs';
export const RECHARGE_MIN_YUAN = 5;
export function durationPriceYuan(duration: string) { return (quoteDuration(duration).amountFen / 100).toFixed(2); }
