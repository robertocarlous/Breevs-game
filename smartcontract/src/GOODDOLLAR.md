# GoodDollar (G$) integration

Breevs stakes and pays prizes in **G$** on Celo, aligned with [GoodBuilders Season 4](https://gooddollar.notion.site/GoodBuilders-Season-4-2d2f258232f08103a856f170c652ecb7) and the [G$ token guide](https://docs.gooddollar.org/for-developers/developer-guides/how-to-integrate-the-gusd-token).

## Token (Celo mainnet)

| | Address |
|---|---------|
| **G$** | `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` |
| Decimals | 18 |

## Contract

- Stakes: `transferFrom` (user approves game contract, then `createGame` / `joinGame`).
- Prizes & refunds: `safeTransfer` of G$.
- Min stake: **1 G$** | Max: **1000 G$**
- Host must hold **≥ 5× stake** in G$ (not CELO).

Deploy:

```bash
G_TOKEN_ADDRESS=0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A npm run deploy:mainnet
```

## Frontend

1. **Approve + play** — `ensureGAllowance()` then non-payable `createGame` / `joinGame`.
2. **Claim prize** — `claimPrize()` in `WheelOfFortune` (unchanged flow, pays G$).
3. **Claim UBI** — `GoodDollarClaimPanel` on `/Wallet` via `@goodsdks/citizen-sdk`.

Env:

```env
NEXT_PUBLIC_G_TOKEN_ADDRESS=0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
NEXT_PUBLIC_CONTRACT_ADDRESS=0x641ff69fe26c504a8a06E611D2a961A39f2a796b
NEXT_PUBLIC_GOODDOLLAR_ENV=production
```

**Celo mainnet (June 2026):** UUPS proxy `0x641ff69...`, implementation `0x66EE641E...` ([Sourcify](https://repo.sourcify.dev/42220/0x66EE641EAD1432822b319a4e186692DACb87936b)). Host spins via single-tx `spinRound()`.

## GoodBuilders fit

| Requirement | Breevs |
|-------------|--------|
| Meaningful G$ integration | Stakes + prize pool in G$ |
| Claim in app | UBI panel + `claimPrize` on game screen |
| Real usage | On-chain game txs in G$ |

Optional later: `transferAndCall` single-tx join ([ERC-677](https://docs.gooddollar.org/for-developers/developer-guides/how-to-integrate-the-gusd-token)), engagement rewards SDK.

## Migration from CELO contract

The legacy address `0xfce551a702AbCecCD5cd70f2fa29768bedb5D064` uses native CELO. Use the **UUPS proxy** above for G$ stakes.
