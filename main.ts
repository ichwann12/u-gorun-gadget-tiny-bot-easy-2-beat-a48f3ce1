// Tiny Bot — SMA crossover on hourly bars (agent-fun/bars-replay/v1).
//
// Strategy, one line: long-only SMA(10) vs SMA(30) crossover per symbol, full
// position switches between the asset and USDC, with a -10% stop-loss and a
// +30% take-profit.
//
// Rules, per symbol, on closes only (no lookahead: a bar's signal is decided
// on its close and fills at the next bar's open; no clock, no randomness,
// no network, no environment):
//   - Keep every close the harness sends (warm-up bars included, so the
//     averages are seeded before the first tradable bar).
//   - Entry: fast SMA crosses above slow SMA (diff > 0 now, <= 0 on the
//     previous bar), on a symbol not already held. A zero-volume bar
//     signals nothing.
//   - Exit, whole position: fast SMA crosses back below slow SMA (the
//     "down" signal, held while fast stays below slow, so a refused sell
//     is retried on the next bar), or the position is worth <= 90% of its
//     cost (stop-loss), or >= 130% of its cost (take-profit).
//   - Stake: equity split over n = min(universe, max_open_positions)
//     slots, capped by max_weight_bps of equity and by unspent cash;
//     nothing below the minimum notional. Sells go first, then buys,
//     at most max_orders_per_bar in total. Slippage capped at 100 bps.
//   - While warming up, no orders (the replay would reject them).
//
// Paper trading only: this bot moves no real funds and holds no wallet.

import { BPS, runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const FAST_BARS = 10;
const SLOW_BARS = 30;
/** Stop-loss: exit when value <= 9/10 of cost. */
const STOP = [9n, 10n] as const;
/** Take-profit: exit when value >= 13/10 of cost. */
const TAKE = [13n, 10n] as const;
const MAX_SLIPPAGE_BPS = 100;

interface Series {
  closes: number[];
  /** fast SMA minus slow SMA after the previous bar, once both exist. */
  prevDiff: number | null;
  /** True while fast SMA is below slow SMA (cross-down signal, held). */
  down: boolean;
}

const series = new Map<string, Series>();

function sma(closes: number[], span: number): number | null {
  if (closes.length < span) return null;
  let sum = 0;
  for (let i = closes.length - span; i < closes.length; i++) sum += closes[i];
  return sum / span;
}

await runBars({
  onBatch(state, batch) {
    const crossUp = new Set<string>();
    const fresh = new Set<string>();
    for (const bar of batch.bars) {
      let s = series.get(bar.symbol);
      if (s === undefined) {
        s = { closes: [], prevDiff: null, down: false };
        series.set(bar.symbol, s);
      }
      s.closes.push(Number(bar.c));
      fresh.add(bar.symbol);
      const fast = sma(s.closes, FAST_BARS);
      const slow = sma(s.closes, SLOW_BARS);
      if (fast === null || slow === null) continue;
      const diff = fast - slow;
      if (s.prevDiff !== null && bar.v !== '0') {
        if (diff > 0 && s.prevDiff <= 0) crossUp.add(bar.symbol);
        if (diff < 0 && s.prevDiff >= 0) s.down = true;
      }
      if (diff >= 0) s.down = false;
      s.prevDiff = diff;
    }
    if (state.warmingUp) return [];
    const { caps, fees } = state.hello;
    const sells: SellInput[] = [];
    const entries: string[] = [];
    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol)) continue;
      const held = state.positions.get(symbol);
      const s = series.get(symbol)!;
      if (held !== undefined) {
        const value = state.value(symbol, held.qty);
        const stop = value * STOP[1] <= held.cost * STOP[0];
        const take = value * TAKE[1] >= held.cost * TAKE[0];
        if (s.down || stop || take) {
          sells.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      } else if (crossUp.has(symbol)) {
        entries.push(symbol);
      }
    }

    const orders: (SellInput | BuyInput)[] = sells.slice(0, caps.max_orders_per_bar);
    const slots = Math.min(state.hello.symbols.length, caps.max_open_positions);
    const stake = state.equity / BigInt(slots);
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    // Sells decided on this bar fill at the next open alongside the buys,
    // so each sell frees its slot for a replacement buy in the same reply.
    let room = slots - state.positions.size + sells.length;
    let cash = state.cash;
    for (const symbol of entries) {
      if (room <= 0 || orders.length >= caps.max_orders_per_bar) break;
      let slice = stake < byWeight ? stake : byWeight;
      if (cash < slice) slice = cash;
      if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) break;
      orders.push({ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS });
      cash -= slice;
      room--;
    }
    return orders;
  },
});
