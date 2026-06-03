import { BREEVS_ABI, CONTRACT_ADDRESS } from "@/lib/contractCalls";

export type SpinRelayerAction = "execute" | "advance";

export interface SpinRelayerResult {
  ok: boolean;
  commitTxHash?: string;
  resolveTxHash?: string;
  advanceTxHash?: string;
  error?: string;
}

export async function callSpinRelayer(
  gameId: bigint,
  action: SpinRelayerAction = "execute"
): Promise<SpinRelayerResult> {
  const res = await fetch("/api/spin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameId: gameId.toString(),
      action,
    }),
  });

  const data = (await res.json()) as SpinRelayerResult;
  if (!res.ok) {
    throw new Error(data.error || "Spin relayer request failed");
  }
  return data;
}

export { BREEVS_ABI, CONTRACT_ADDRESS };
