import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GameStatus, GameInfo } from "@/lib/contractCalls";

// Helper to convert BigInt fields to strings for serialization
const serializeGameInfo = (game: GameInfo | null): any => {
  if (!game) return null;
  return {
    ...game,
    gameId: game.gameId.toString(),
    stake: game.stake.toString(),
    prizePool: game.prizePool.toString(),
    roundEnd: game.roundEnd.toString(),
    roundDuration: game.roundDuration.toString(),
    eliminatedPlayers: game.eliminatedPlayers || [],
  };
};

// Helper to deserialize strings back to BigInt
const deserializeGameInfo = (data: any): GameInfo | null => {
  if (!data) return null;
  return {
    ...data,
    gameId: BigInt(data.gameId),
    stake: BigInt(data.stake),
    prizePool: BigInt(data.prizePool),
    roundEnd: BigInt(data.roundEnd),
    roundDuration: BigInt(data.roundDuration),
    eliminatedPlayers: data.eliminatedPlayers || [],
  };
};

interface GameStore {
  activeGames: GameInfo[];
  myGames: GameInfo[];
  addGame: (game: GameInfo) => void;
  filters: {
    sortBy: string;
    sortOrder: string;
    minStake: string;
    status: GameStatus;
  };
  loading: boolean;
  selectedGame: GameInfo | null;
  activeTab: "active" | "my-games";
  currentPlayerGame: GameInfo | null;
  currentCreatorGame: GameInfo | null;

  setLoading: (state: boolean) => void;
  setActiveGames: (games: GameInfo[]) => void;
  setMyGames: (games: GameInfo[]) => void;
  updateGameStatus: (gameId: bigint, status: GameStatus) => void;
  updateGameInfo: (gameId: bigint, gameInfo: GameInfo) => void;
  clearGames: () => void;
  setSelectedGame: (game: GameInfo | null) => void;
  setFilters: (filters: GameStore["filters"]) => void;
  setActiveTab: (tab: "active" | "my-games") => void;
  setCurrentPlayerGame: (game: GameInfo | null, stxAddress: string) => void;
  setCurrentCreatorGame: (game: GameInfo | null) => void;
  clearCurrentGames: () => void;
  restrictPlayerActions: (stxAddress: string) => boolean;
  restrictCreatorActions: (stxAddress: string) => boolean;
  hasActiveGame: (stxAddress: string) => boolean;
  getCurrentActiveGame: (stxAddress: string) => GameInfo | null;
  addToMyGames: (game: GameInfo) => void;
  removeFromMyGames: (gameId: bigint) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      activeGames: [],
      myGames: [],
      addGame: (game) => {
        console.log("useGameStore: Adding game:", game);
        set((state) => ({
          myGames: [
            ...state.myGames.filter((g) => g.gameId !== game.gameId),
            game,
          ],
        }));
      },
      filters: {
        sortBy: "newest",
        sortOrder: "desc",
        minStake: "0",
        status: GameStatus.Active,
      },
      loading: false,
      selectedGame: null,
      activeTab: "active",
      currentPlayerGame: null,
      currentCreatorGame: null,

      setLoading: (state) => set({ loading: state }),

      setActiveGames: (games) => set({ activeGames: games }),

      setMyGames: (games) =>
        set({
          myGames: games.filter(
            (game, index, self) =>
              index === self.findIndex((g) => g.gameId === game.gameId)
          ),
        }),

      updateGameStatus: (gameId, status) =>
        set((state) => {
          const updateGame = (g: GameInfo) =>
            g.gameId === gameId ? { ...g, status } : g;

          const isOver = status === GameStatus.Ended || status === GameStatus.Cancelled;

          const newCurrentPlayerGame =
            state.currentPlayerGame?.gameId === gameId && isOver
              ? null
              : state.currentPlayerGame?.gameId === gameId
              ? { ...state.currentPlayerGame, status }
              : state.currentPlayerGame;

          const newCurrentCreatorGame =
            state.currentCreatorGame?.gameId === gameId && isOver
              ? null
              : state.currentCreatorGame?.gameId === gameId
              ? { ...state.currentCreatorGame, status }
              : state.currentCreatorGame;

          return {
            activeGames: state.activeGames.map(updateGame),
            myGames: state.myGames.map(updateGame),
            currentPlayerGame: newCurrentPlayerGame,
            currentCreatorGame: newCurrentCreatorGame,
          };
        }),

      updateGameInfo: (gameId: bigint, gameInfo: GameInfo) =>
        set((state) => {
          const updateGame = (g: GameInfo) =>
            g.gameId === gameId ? { ...g, ...gameInfo } : g;

          const newCurrentPlayerGame =
            state.currentPlayerGame?.gameId === gameId
              ? { ...state.currentPlayerGame, ...gameInfo }
              : state.currentPlayerGame;

          const newCurrentCreatorGame =
            state.currentCreatorGame?.gameId === gameId
              ? { ...state.currentCreatorGame, ...gameInfo }
              : state.currentCreatorGame;

          return {
            activeGames: state.activeGames.map(updateGame),
            myGames: state.myGames.map(updateGame),
            currentPlayerGame: newCurrentPlayerGame,
            currentCreatorGame: newCurrentCreatorGame,
          };
        }),

      clearGames: () =>
        set({
          activeGames: [],
          myGames: [],
        }),

      clearCurrentGames: () =>
        set({
          currentPlayerGame: null,
          currentCreatorGame: null,
        }),

      setSelectedGame: (game) => set({ selectedGame: game }),

      setFilters: (filters) => set({ filters }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setCurrentPlayerGame: (game, stxAddress) => {
        if (!stxAddress) return;
        const isOver = (s: GameStatus) => s === GameStatus.Ended || s === GameStatus.Cancelled;
        const hasActive = get().hasActiveGame(stxAddress);
        if (hasActive && game && !isOver(game.status)) {
          return;
        }
        if (game && isOver(game.status)) {
          set({ currentPlayerGame: null });
        } else {
          set({ currentPlayerGame: game });
          if (game && !get().myGames.some((g) => g.gameId === game.gameId)) {
            get().addToMyGames(game);
          }
        }
      },

      setCurrentCreatorGame: (game) => {
        const isOver = (s: GameStatus) => s === GameStatus.Ended || s === GameStatus.Cancelled;
        if (game && isOver(game.status)) {
          set({ currentCreatorGame: null });
        } else {
          set({ currentCreatorGame: game });
          if (game && !get().myGames.some((g) => g.gameId === game.gameId)) {
            get().addToMyGames(game);
          }
        }
      },

      restrictPlayerActions: (stxAddress) => {
        if (!stxAddress) return false;
        const { currentPlayerGame } = get();
        const isOver = (s: GameStatus) => s === GameStatus.Ended || s === GameStatus.Cancelled;
        return (
          currentPlayerGame !== null &&
          currentPlayerGame.players.includes(stxAddress) &&
          !isOver(currentPlayerGame.status)
        );
      },

      restrictCreatorActions: (stxAddress) => {
        if (!stxAddress) return false;
        const { currentCreatorGame } = get();
        const isOver = (s: GameStatus) => s === GameStatus.Ended || s === GameStatus.Cancelled;
        return (
          currentCreatorGame !== null &&
          currentCreatorGame.creator === stxAddress &&
          !isOver(currentCreatorGame.status)
        );
      },

      hasActiveGame: (stxAddress) => {
        if (!stxAddress) return false;
        const { myGames } = get();
        const isOver = (s: GameStatus) => s === GameStatus.Ended || s === GameStatus.Cancelled;
        return myGames.some(
          (game) =>
            (game.players.includes(stxAddress) || game.creator === stxAddress) &&
            !isOver(game.status)
        );
      },

      getCurrentActiveGame: (stxAddress) => {
        if (!stxAddress) return null;
        const { myGames } = get();
        const isOver = (s: GameStatus) => s === GameStatus.Ended || s === GameStatus.Cancelled;
        return (
          myGames.find(
            (game) =>
              (game.players.includes(stxAddress) || game.creator === stxAddress) &&
              !isOver(game.status)
          ) || null
        );
      },

      addToMyGames: (game: GameInfo) =>
        set((state) => ({
          myGames: [
            ...state.myGames.filter((g) => g.gameId !== game.gameId),
            game,
          ],
        })),

      removeFromMyGames: (gameId: bigint) =>
        set((state) => ({
          myGames: state.myGames.filter((g) => g.gameId !== gameId),
          currentPlayerGame:
            state.currentPlayerGame?.gameId === gameId
              ? null
              : state.currentPlayerGame,
          currentCreatorGame:
            state.currentCreatorGame?.gameId === gameId
              ? null
              : state.currentCreatorGame,
        })),
    }),
    {
      name: "breevs-game-store",
      partialize: (state) => ({
        currentPlayerGame: serializeGameInfo(state.currentPlayerGame),
        currentCreatorGame: serializeGameInfo(state.currentCreatorGame),
        activeTab: state.activeTab,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            ...data,
            state: {
              ...data.state,
              currentPlayerGame: deserializeGameInfo(
                data.state.currentPlayerGame
              ),
              currentCreatorGame: deserializeGameInfo(
                data.state.currentCreatorGame
              ),
            },
          };
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
