/** Points earned per game joined (on-chain gamesPlayed). */
export const POINTS_PER_GAME = 10;

/** Points earned per game won (on-chain gamesWon). */
export const POINTS_PER_WIN = 50;

/** Derive reward points from on-chain userStats — no contract upgrade needed. */
export function computePoints(gamesPlayed: number, gamesWon: number): number {
  return gamesPlayed * POINTS_PER_GAME + gamesWon * POINTS_PER_WIN;
}

/** Human-readable breakdown for tooltips / sublabels. */
export function pointsBreakdown(gamesPlayed: number, gamesWon: number): string {
  const fromGames = gamesPlayed * POINTS_PER_GAME;
  const fromWins = gamesWon * POINTS_PER_WIN;
  return `${fromGames} play · ${fromWins} win`;
}
