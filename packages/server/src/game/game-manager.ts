// Server-side game manager — starts games, persists state to Redis, sends player views

import type { GameState } from "@mahjong/common";
import { deal, createPlayerView, drawTile, discardTile } from "@mahjong/common";
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
 * Starts a new game: deals tiles, saves state, returns per-player views.
 * Returns a map of seatIndex → PlayerGameView.
 */
export function startGame(
  playerIds: string[],
  dealer: number = 0,
): { gameState: GameState } {
  const { gameState } = deal(playerIds, dealer);
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
