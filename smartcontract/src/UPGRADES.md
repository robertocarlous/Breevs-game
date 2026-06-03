# UUPS Upgradeable Proxy

`BreevsRussianRoulette` is deployed behind an **ERC-1967 UUPS proxy**.

| Address | Role |
|---------|------|
| **Proxy** | Permanent address — point the frontend `NEXT_PUBLIC_CONTRACT_ADDRESS` here |
| **Implementation** | Logic contract — replaced on upgrade; do not use in the app |
| **Owner** | Wallet that can call `upgradeTo` (deployer by default) |

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
PROXY_ADDRESS=0xYourProxy npm run upgrade:sepolia
```

Or rely on `proxyAddress` in `deployment.json`.

Only the **owner** can upgrade. Games in progress and balances stay on the proxy.

## Migrating from the old non-proxy deployment

The contract at `0xfce551a7...` on mainnet is a **direct implementation**, not a proxy. You cannot upgrade it in place.

## Gasless spins (relayer)

After upgrading to an implementation with `spinOperator`:

1. Fund a dedicated relayer wallet with CELO for gas.
2. `SPIN_OPERATOR=0xRelayer... npx hardhat run scripts/set-spin-operator.cjs --network celo-mainnet`
3. Set `SPIN_RELAYER_PRIVATE_KEY` in the Next.js server env (same relayer key).
4. Players only sign **create**, **join**, and **claim**; spins use commit/reveal on-chain via `/api/spin`.

1. Deploy a **new** UUPS proxy with `npm run deploy:mainnet`.
2. Update the frontend env to the new **proxy** address.
3. Treat the old contract as legacy (games there finish on the old contract).

## Storage layout rules

- Do not change order or types of existing state variables.
- Do not remove variables.
- Add new variables only at the end, before `__gap`.
- Shrink `__gap` by the number of new slots you add.
