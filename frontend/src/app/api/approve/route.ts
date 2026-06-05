import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, maxUint256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
// Read directly from env — contractCalls.ts is "use client" and can't be imported on the server
const GD_TOKEN_ADDRESS = (
  process.env.NEXT_PUBLIC_GD_TOKEN_ADDRESS || "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A"
) as `0x${string}`;

const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
) as `0x${string}`;

const PERMIT_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner",    type: "address" },
      { name: "spender",  type: "address" },
      { name: "value",    type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v",        type: "uint8"   },
      { name: "r",        type: "bytes32" },
      { name: "s",        type: "bytes32" },
    ],
    name: "permit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

function parseRelayerKey(): Hex | null {
  const raw = process.env.SPIN_RELAYER_PRIVATE_KEY?.trim();
  if (!raw) return null;
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (hex.length !== 66) return null;
  return hex as Hex;
}

export async function POST(req: NextRequest) {
  const key = parseRelayerKey();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Relayer not configured (set SPIN_RELAYER_PRIVATE_KEY)" },
      { status: 503 }
    );
  }

  let body: { owner?: string; deadline?: string; v?: number; r?: string; s?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { owner, deadline, v, r, s } = body;
  if (!owner || !deadline || v === undefined || !r || !s) {
    return NextResponse.json({ ok: false, error: "Missing permit fields" }, { status: 400 });
  }

  const RPC = process.env.CELO_RPC_URL || process.env.NEXT_PUBLIC_CELO_RPC_URL || "https://forno.celo.org";

  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({ chain: celo, transport: http(RPC) });
  const wallet = createWalletClient({ account, chain: celo, transport: http(RPC) });

  try {
    // Relayer submits permit() on behalf of the user.
    // The user already signed off-chain — no user transaction needed.
    const hash = await wallet.writeContract({
      address: GD_TOKEN_ADDRESS,
      abi: PERMIT_ABI,
      functionName: "permit",
      args: [
        owner as `0x${string}`,
        CONTRACT_ADDRESS,
        maxUint256,
        BigInt(deadline),
        v,
        r as `0x${string}`,
        s as `0x${string}`,
      ],
      gas: 250000n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
    if (receipt.status === "reverted") {
      return NextResponse.json({ ok: false, error: "Permit reverted on-chain" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, hash });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Permit submission failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
