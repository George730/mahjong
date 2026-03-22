// Canonical game state type, state machine phases, and deal logic for Chinese Standard Mahjong

import type { Tile, Wind } from "./tiles.js";
import { createFullSet, shuffle, isBonusTile } from "./tiles.js";

// --- State machine phases ---

export type GamePhase = "waiting" | "dealing" | "playing" | "roundEnd" | "gameEnd";

// --- Per-player state ---

export interface PlayerState {
  userId: string;
  seatIndex: number; // 0=East, 1=South, 2=West, 3=North
  hand: Tile[]; // tiles in hand (hidden from other players)
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
  bonusTiles: Tile[];
  discards: Tile[];
  melds: Meld[];
}

export interface PlayerGameView {
  phase: GamePhase;
  hand: Tile[]; // only this player's hand
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

// --- Seat-wind mapping ---

const SEAT_WINDS: Wind[] = ["east", "south", "west", "north"];

export function seatWind(seatIndex: number): Wind {
  return SEAT_WINDS[seatIndex];
}

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

/**
 * Creates a player-specific view of the game state (hides other players' hands).
 */
export function createPlayerView(gameState: GameState, seatIndex: number): PlayerGameView {
  const player = gameState.players[seatIndex];

  const players: PublicPlayerState[] = gameState.players.map((p) => ({
    userId: p.userId,
    seatIndex: p.seatIndex,
    handCount: p.hand.length,
    bonusTiles: p.bonusTiles,
    discards: p.discards,
    melds: p.melds,
  }));

  return {
    phase: gameState.phase,
    hand: player.hand,
    bonusTiles: player.bonusTiles,
    players,
    wallCount: gameState.wall.length,
    currentTurn: gameState.currentTurn,
    dealer: gameState.dealer,
    roundWind: gameState.roundWind,
    turnCount: gameState.turnCount,
  };
}
