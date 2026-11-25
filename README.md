# Tiny Bot — SMA Crossover on Solana Hourly Bars

[![make.fun · u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![Rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/ichwann12/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![Reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/ichwann12/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

A tiny paper-trading bot for the make.fun bounty **"Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana"** (`u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1`).

## Strategy

Long-only **SMA(10) vs SMA(30) crossover** on hourly closes, per symbol (SOL, WETH, JITOSOL, RAY, FARTCOIN, POPCAT, WIF):

- **Buy** when the fast SMA crosses above the slow SMA; hold the asset.
- **Sell everything** when the fast SMA crosses back below the slow SMA, or the position hits a **−10% stop-loss**, or a **+30% take-profit**.
- **Sizing:** equity split evenly over the open slots, capped at 25% of equity per symbol and by unspent cash; nothing below the $1 minimum notional.
- **Discipline:** signals use closes only (decided on a bar's close, filled at the next bar's open — no lookahead), no clock, no randomness, no network, no outside data. Paper trading only — no real funds, no wallet.

## Run

The entrypoint is `main.ts` (Node 22.18+ runs its TypeScript as-is):

```sh
node main.ts
```

It speaks the `agent-fun/bars-replay/v1` line protocol on stdin/stdout (`hello` / `batch` / `done` in, one `reply` per batch out). `vendor/makefun-bars.ts` is the kit's provided protocol shim, vendored unchanged.

## Grade locally

From the unpacked kit directory:

```sh
node cli/makefun.mjs grade-local --kit . --bot <this repository> --driver process
```

## License

MIT — see [LICENSE](LICENSE).
