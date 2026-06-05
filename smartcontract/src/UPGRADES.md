# UUPS Upgradeable Proxy

`BreevsRussianRoulette` is deployed behind an **ERC-1967 UUPS proxy**.

| Address | Role |
|---------|------|
| **Proxy** | Permanent address — point the frontend `NEXT_PUBLIC_CONTRACT_ADDRESS` here |
| **Implementation** | Logic contract — replaced on upgrade; do not use in the app |
| **Owner** | Wallet that can call `upgradeTo` (deployer by default) |

**You do not redeploy the proxy when upgrading.** Only the implementation address changes; the proxy and all game state stay the same.

## Deploy (new proxy)

```bash
cd smartcontract/src
npm install
npm run deploy:sepolia   # or deploy:mainnet
```

`deployment.json` will contain `proxyAddress`, `implementationAddress`, and `contractAddress` (alias of proxy).

## Upgrade (existing proxy)

1. Change `contracts/breevs.sol` (preserve storage layout — only append new state variables after `__gap`, never reorder or remove).
2. Run:

```bash
npm run upgrade:mainnet   # or upgrade:sepolia
```

Or set `PROXY_ADDRESS=0xYourProxy`. The script reads `proxyAddress` from `deployment.json` by default.

3. Verify the new implementation on Sourcify:

```bash
npm run verify:sourcify
```

Only the **owner** can upgrade. Games in progress and balances stay on the proxy.

## Spin model (`spinRound`)

Current games use **`spinRound(gameId)`** — one host-signed transaction per elimination.

Host calls `spinRound(gameId)` once per elimination (one wallet signature). No server relayer is used.

## Migrating from the old non-proxy deployment

The contract at `0xfce551a7...` on mainnet is a **direct implementation**, not a proxy. You cannot upgrade it in place.

1. Deploy a **new** UUPS proxy with `npm run deploy:mainnet`.
2. Update the frontend env to the new **proxy** address.
3. Treat the old contract as legacy (games there finish on the old contract).

## Storage layout rules

- Do not change order or types of existing state variables.
- Do not remove variables.
- Add new variables only at the end, before `__gap`.
- Shrink `__gap` by the number of new slots you add.
