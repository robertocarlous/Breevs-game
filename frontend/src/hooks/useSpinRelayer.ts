"use client";

import { useState } from "react";
import { callSpinRelayer, type SpinRelayerResult } from "@/lib/spinRelayer";

export function useSpinRelayer() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeSpin = async (gameId: bigint): Promise<SpinRelayerResult> => {
    setIsPending(true);
    setError(null);
    try {
      return await callSpinRelayer(gameId, "execute");
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  const advanceRound = async (gameId: bigint): Promise<SpinRelayerResult> => {
    setIsPending(true);
    setError(null);
    try {
      return await callSpinRelayer(gameId, "advance");
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { executeSpin, advanceRound, isPending, error };
}
