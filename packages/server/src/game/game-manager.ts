// Server-side game manager — starts games, persists state to Redis, sends player views

import type { GameState, PendingClaim, ClaimResolution, RoundResult } from "@mahjong/common";
import { deal, createPlayerView, drawTile, discardTile, declareClosedKong, submitClaim, passClaim, resolveClaims, declareSelfDrawHu, getDealerForHand, WIND_ROUND_WINDS, TOTAL_HANDS } from "@mahjong/common";
import { redis } from "../redis.js";

const GAME_TTL_SECONDS = 4 * 60 * 60; // 4 hours

function gameKey(roomCode: string): string {
  return `room:${roomCode}:game`;
}

/** Stores game state in Redis. */
export async function saveGameState(roomCode: string, state: GameState): Promise<void> {
  await redis.set(gameKey(roomCode), JSON.stringify(state), "EX", GAME_TTL_SECONDS);
}

/** Retrieves game state from Redis. */
export async function getGameState(roomCode: string): Promise<GameState | null> {
  const data = await redis.get(gameKey(roomCode));
  return data ? (JSON.parse(data) as GameState) : null;
}

/** Deletes game state from Redis. */
export async function deleteGameState(roomCode: string): Promise<void> {
  await redis.del(gameKey(roomCode));
}

/**
 * Starts a new game: deals tiles for the first hand (东一局).
 */
export function startGame(
  playerIds: string[],
): { gameState: GameState } {
  const windRoundIndex = 0;
  const handIndex = 0;
  const dealer = getDealerForHand(windRoundIndex, handIndex);
  const roundWind = WIND_ROUND_WINDS[windRoundIndex];
  const { gameState } = deal(playerIds, dealer, roundWind, windRoundIndex, handIndex);
  return { gameState };
}

/**
 * Creates per-player views for broadcasting.
 * Returns a map of userId → PlayerGameView.
 */
export function createPlayerViews(gameState: GameState): Map<string, ReturnType<typeof createPlayerView>> {
  const views = new Map<string, ReturnType<typeof createPlayerView>>();
  for (const player of gameState.players) {
    views.set(player.userId, createPlayerView(gameState, player.seatIndex));
  }
  return views;
}

/**
 * Draws a tile for the current player. Returns the updated game state.
 */
export function handleDrawTile(gameState: GameState): GameState {
  drawTile(gameState); // mutates in place
  return gameState;
}

/**
 * Discards a tile from the current player. Returns the updated game state.
 */
export function handleDiscardTile(gameState: GameState, tileId: number): GameState {
  discardTile(gameState, tileId); // mutates in place
  return gameState;
}

/**
 * Submits a claim (chow/pung/openKong) on the current discard.
 * The claim is stored as pending and resolved when all players have decided.
 */
export function handleSubmitClaim(
  gameState: GameState,
  seatIndex: number,
  claimType: PendingClaim["type"],
  handTileIds?: [number, number],
): ClaimResolution | null {
  submitClaim(gameState, seatIndex, claimType, handTileIds);
  return resolveClaims(gameState);
}

/**
 * A player passes on the current claim window.
 * Returns resolution if all players have now decided, null otherwise.
 */
export function handleClaimPass(gameState: GameState, seatIndex: number): ClaimResolution | null {
  passClaim(gameState, seatIndex);
  return resolveClaims(gameState);
}

/**
 * Declares a closed kong from hand+drawnTile.
 */
export function handleDeclareClosedKong(gameState: GameState, seatIndex: number, tileIds: number[]): GameState {
  declareClosedKong(gameState, seatIndex, tileIds);
  return gameState;
}

/**
 * Declares a self-draw hu (自摸). Returns the round result.
 */
export function handleDeclareSelfDrawHu(gameState: GameState, seatIndex: number): RoundResult {
  return declareSelfDrawHu(gameState, seatIndex);
}

/**
 * Submits a hu claim on a discard. Goes through the normal claim system.
 */
export function handleClaimHu(
  gameState: GameState,
  seatIndex: number,
): ClaimResolution | null {
  submitClaim(gameState, seatIndex, "hu");
  return resolveClaims(gameState);
}

/**
 * Starts the next hand. Advances handIndex within the wind round, or moves
 * to the next wind round. Returns null if all 16 hands are complete (game over).
 */
export function startNextRound(gameState: GameState): GameState | null {
  if (gameState.phase !== "roundEnd") throw new Error("Round has not ended yet");

  let nextWindRound = gameState.windRoundIndex;
  let nextHand = gameState.handIndex + 1;
  if (nextHand >= 4) {
    nextHand = 0;
    nextWindRound++;
  }

  // Check if the full game (16 hands) is complete
  const handNumber = nextWindRound * 4 + nextHand;
  if (handNumber >= TOTAL_HANDS) {
    return null; // game over
  }

  const playerIds = gameState.players
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((p) => p.userId);

  const dealer = getDealerForHand(nextWindRound, nextHand);
  const roundWind = WIND_ROUND_WINDS[nextWindRound];
  const { gameState: newState } = deal(playerIds, dealer, roundWind, nextWindRound, nextHand);
  return newState;
}
