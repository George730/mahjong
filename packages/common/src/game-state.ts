// Canonical game state type, state machine phases, and deal logic for Chinese Standard Mahjong

import type { Tile, Wind } from "./tiles.js";
import { createFullSet, shuffle, isBonusTile } from "./tiles.js";

// --- State machine phases ---

export type GamePhase = "waiting" | "dealing" | "playing" | "roundEnd" | "gameEnd";

/** Within a "playing" turn, tracks whether the active player needs to draw or discard. */
export type TurnPhase = "draw" | "discard";

// --- Per-player state ---

export interface PlayerState {
  userId: string;
  seatIndex: number; // 0=East, 1=South, 2=West, 3=North
  hand: Tile[]; // tiles in hand (hidden from other players)
  drawnTile: Tile | null; // tile just drawn, shown separately from hand
  bonusTiles: Tile[]; // seasons/flowers set aside
  discards: Tile[]; // tiles discarded by this player
  melds: Meld[]; // exposed melds (chow/pung/kong)
}

export interface Meld {
  type: "chow" | "pung" | "kong";
  tiles: Tile[];
  exposed: boolean; // false for concealed kong
}

// --- Full game state (server-authoritative) ---

export interface GameState {
  phase: GamePhase;
  turnPhase: TurnPhase; // whether active player needs to draw or discard
  wall: Tile[]; // remaining tiles to draw from (front = index 0)
  players: PlayerState[];
  currentTurn: number; // seatIndex of active player
  dealer: number; // seatIndex of the dealer
  roundWind: Wind; // current round wind
  turnCount: number; // how many turns have been taken
}

// --- Player-visible state (sent to each client — hides other players' hands) ---

export interface PublicPlayerState {
  userId: string;
  seatIndex: number;
  handCount: number; // number of hidden tiles (not revealed)
  hasDrawnTile: boolean; // whether this player has a drawn tile shown separately
  bonusTiles: Tile[];
  discards: Tile[];
  melds: Meld[];
}

export interface PlayerGameView {
  phase: GamePhase;
  turnPhase: TurnPhase;
  hand: Tile[]; // only this player's hand
  drawnTile: Tile | null; // tile just drawn (shown separately to the right of hand)
  bonusTiles: Tile[]; // this player's bonus tiles
  players: PublicPlayerState[]; // all players' public info
  wallCount: number; // remaining tiles in wall
  currentTurn: number;
  dealer: number;
  roundWind: Wind;
  turnCount: number;
}

// --- Deal result ---

export interface DealResult {
  gameState: GameState;
}

// Re-export for backwards compatibility — canonical definition is in seat-utils.ts
export { windForSeat as seatWind } from "./seat-utils.js";

// --- Deal logic ---

/**
 * Creates a new game state by shuffling tiles and dealing to 4 players.
 * Dealer (seat 0 = East by default) gets 14 tiles, others get 13.
 * Bonus tiles (seasons/flowers) are automatically replaced from the wall end.
 */
export function deal(playerIds: string[], dealer: number = 0, roundWind: Wind = "east"): DealResult {
  if (playerIds.length !== 4) {
    throw new Error("Exactly 4 players are required");
  }
  if (dealer < 0 || dealer > 3) {
    throw new Error("Dealer must be 0-3");
  }

  const tiles = shuffle(createFullSet());

  // Wall: tiles drawn from front (index 0), replacements drawn from back
  const wall = [...tiles];

  // Initialize player states
  const players: PlayerState[] = playerIds.map((id, i) => ({
    userId: id,
    seatIndex: i,
    hand: [],
    drawnTile: null,
    bonusTiles: [],
    discards: [],
    melds: [],
  }));

  // Deal tiles: 4 rounds of 4 tiles to each player (starting from dealer), then 1 extra to dealer
  // Standard dealing: dealer gets 14, others get 13
  const dealOrder = [0, 1, 2, 3].map((offset) => (dealer + offset) % 4);

  // 3 rounds of 4 tiles each
  for (let round = 0; round < 3; round++) {
    for (const seatIdx of dealOrder) {
      for (let t = 0; t < 4; t++) {
        players[seatIdx].hand.push(wall.shift()!);
      }
    }
  }

  // 1 tile each
  for (const seatIdx of dealOrder) {
    players[seatIdx].hand.push(wall.shift()!);
  }

  // Dealer gets 1 extra tile (14th)
  players[dealer].hand.push(wall.shift()!);

  // Replace bonus tiles for each player (starting from dealer)
  for (const seatIdx of dealOrder) {
    replaceBonusTiles(players[seatIdx], wall);
  }

  const gameState: GameState = {
    phase: "playing",
    turnPhase: "discard", // dealer has 14 tiles, must discard first
    wall,
    players,
    currentTurn: dealer,
    dealer,
    roundWind,
    turnCount: 0,
  };

  return { gameState };
}

/**
 * Replaces bonus tiles (seasons/flowers) in a player's hand with tiles from the wall end.
 * Handles chained replacements (replacement tile is also a bonus).
 */
function replaceBonusTiles(player: PlayerState, wall: Tile[]): void {
  let hasBonus = true;
  while (hasBonus) {
    hasBonus = false;
    for (let i = player.hand.length - 1; i >= 0; i--) {
      if (isBonusTile(player.hand[i])) {
        // Move bonus tile aside
        player.bonusTiles.push(player.hand[i]);
        player.hand.splice(i, 1);
        // Draw replacement from wall end
        if (wall.length > 0) {
          player.hand.push(wall.pop()!);
          hasBonus = true; // Check again in case replacement is also bonus
        }
      }
    }
  }
}

// --- Draw & discard logic ---

/**
 * Draws a tile from the wall for the current player.
 * If the drawn tile is a bonus tile, it is placed in the bonus area and a
 * replacement is drawn from the wall end (repeating for chained bonuses).
 * Mutates gameState in place. Returns the drawn tile (or null if wall empty).
 */
export function drawTile(gameState: GameState): Tile | null {
  if (gameState.phase !== "playing") throw new Error("Game is not in playing phase");
  if (gameState.turnPhase !== "draw") throw new Error("Not in draw phase");
  if (gameState.wall.length === 0) {
    // Wall exhausted — draw game
    gameState.phase = "roundEnd";
    return null;
  }

  const player = gameState.players[gameState.currentTurn];
  let tile = gameState.wall.shift()!;

  // Handle bonus tiles: move to bonus area, draw replacement from wall end
  while (isBonusTile(tile)) {
    player.bonusTiles.push(tile);
    if (gameState.wall.length === 0) {
      gameState.phase = "roundEnd";
      return null;
    }
    tile = gameState.wall.pop()!;
  }

  player.drawnTile = tile;
  gameState.turnPhase = "discard";
  return tile;
}

/**
 * Discards a tile from the current player's hand or drawn tile.
 * The discarded tile goes to the player's discard pile.
 * Advances the turn to the next player (in draw phase).
 * Mutates gameState in place.
 */
export function discardTile(gameState: GameState, tileId: number): void {
  if (gameState.phase !== "playing") throw new Error("Game is not in playing phase");
  if (gameState.turnPhase !== "discard") throw new Error("Not in discard phase");

  const player = gameState.players[gameState.currentTurn];

  // Find the tile to discard — either the drawn tile or a hand tile
  let discarded: Tile | undefined;

  if (player.drawnTile && player.drawnTile.id === tileId) {
    // Discarding the drawn tile directly
    discarded = player.drawnTile;
    player.drawnTile = null;
  } else {
    // Discarding from hand — move drawn tile into hand first
    const handIdx = player.hand.findIndex((t) => t.id === tileId);
    if (handIdx < 0) throw new Error("Tile not found in hand or drawn tile");
    discarded = player.hand[handIdx];
    player.hand.splice(handIdx, 1);
    // If there was a drawn tile, absorb it into the hand
    if (player.drawnTile) {
      player.hand.push(player.drawnTile);
      player.drawnTile = null;
    }
  }

  player.discards.push(discarded);

  // Advance to next player
  gameState.currentTurn = (gameState.currentTurn + 1) % 4;
  gameState.turnPhase = "draw";
  gameState.turnCount++;
}

/**
 * Creates a player-specific view of the game state (hides other players' hands).
 */
export function createPlayerView(gameState: GameState, seatIndex: number): PlayerGameView {
  const player = gameState.players[seatIndex];

  const players: PublicPlayerState[] = gameState.players.map((p) => ({
    userId: p.userId,
    seatIndex: p.seatIndex,
    handCount: p.hand.length,
    hasDrawnTile: p.drawnTile !== null,
    bonusTiles: p.bonusTiles,
    discards: p.discards,
    melds: p.melds,
  }));

  return {
    phase: gameState.phase,
    turnPhase: gameState.turnPhase,
    hand: player.hand,
    drawnTile: player.drawnTile,
    bonusTiles: player.bonusTiles,
    players,
    wallCount: gameState.wall.length,
    currentTurn: gameState.currentTurn,
    dealer: gameState.dealer,
    roundWind: gameState.roundWind,
    turnCount: gameState.turnCount,
  };
}
