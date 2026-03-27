// Canonical game state type, state machine phases, and deal logic for Chinese Standard Mahjong

import type { Tile, TileFace, Wind } from "./tiles.js";
import { createFullSet, shuffle, isBonusTile, sameFace } from "./tiles.js";

// --- State machine phases ---

export type GamePhase = "waiting" | "dealing" | "playing" | "roundEnd" | "gameEnd";

/** Within a "playing" turn:
 *  - "draw": active player needs to draw a tile
 *  - "discard": active player needs to discard a tile (or declare closed kong)
 *  - "claiming": a tile was just discarded and other players may claim it
 */
export type TurnPhase = "draw" | "discard" | "claiming";

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
  /** ID of the tile that was claimed from another player's discard (for rendering). */
  claimedTileId?: number;
}

// --- Full game state (server-authoritative) ---

export interface GameState {
  phase: GamePhase;
  turnPhase: TurnPhase; // whether active player needs to draw or discard
  wall: Tile[]; // remaining tiles to draw from (front = index 0)
  players: PlayerState[];
  currentTurn: number; // seatIndex of active player (or discarder during claiming)
  dealer: number; // seatIndex of the dealer
  roundWind: Wind; // current round wind
  turnCount: number; // how many turns have been taken
  /** The last discarded tile available for claiming, or null. */
  lastDiscard: { tile: Tile; fromSeat: number } | null;
  /** Seat indices that have passed on the current claiming window. */
  claimPasses: number[];
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
  /** The last discarded tile available for claiming, or null. */
  lastDiscard: { tile: Tile; fromSeat: number } | null;
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
    lastDiscard: null,
    claimPasses: [],
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
 * Enters claiming phase so other players can claim the discard.
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

  // Enter claiming phase — currentTurn stays on the discarder as a marker
  gameState.lastDiscard = { tile: discarded, fromSeat: gameState.currentTurn };
  gameState.claimPasses = [];
  gameState.turnPhase = "claiming";
  gameState.turnCount++;
}

// --- Claiming logic ---

/**
 * Draw a replacement tile from the wall END for kong declarations.
 * Handles chained bonus tile replacements.
 * Sets turnPhase to "discard" after drawing.
 */
function drawReplacementTile(gameState: GameState, player: PlayerState): void {
  if (gameState.wall.length === 0) {
    gameState.phase = "roundEnd";
    return;
  }

  let tile = gameState.wall.pop()!;

  // Handle bonus tiles: move to bonus area, draw replacement from wall end
  while (isBonusTile(tile)) {
    player.bonusTiles.push(tile);
    if (gameState.wall.length === 0) {
      gameState.phase = "roundEnd";
      return;
    }
    tile = gameState.wall.pop()!;
  }

  player.drawnTile = tile;
  gameState.turnPhase = "discard";
}

/** Remove specific tiles from a player's hand by ID. Returns removed tiles. */
function removeTilesFromHand(player: PlayerState, tileIds: number[]): Tile[] {
  const removed: Tile[] = [];
  for (const id of tileIds) {
    const idx = player.hand.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error(`Tile ${id} not found in hand`);
    removed.push(player.hand[idx]);
    player.hand.splice(idx, 1);
  }
  return removed;
}

/** Finish a claim: clear lastDiscard, remove the claimed tile from discarder's discards. */
function finishClaim(gameState: GameState): Tile {
  const ld = gameState.lastDiscard;
  if (!ld) throw new Error("No discard to claim");

  // Remove the claimed tile from the discarder's discard pile (it was the last one added)
  const discarder = gameState.players[ld.fromSeat];
  const discardIdx = discarder.discards.findIndex((t) => t.id === ld.tile.id);
  if (discardIdx >= 0) {
    discarder.discards.splice(discardIdx, 1);
  }

  const claimedTile = ld.tile;
  gameState.lastDiscard = null;
  gameState.claimPasses = [];
  return claimedTile;
}

/**
 * Claims a chow (sequence) from the last discard.
 * Claimer must be the next player in turn order after the discarder.
 */
export function claimChow(
  gameState: GameState,
  claimerSeat: number,
  handTileIds: [number, number],
): void {
  if (gameState.phase !== "playing") throw new Error("Game is not in playing phase");
  if (gameState.turnPhase !== "claiming") throw new Error("Not in claiming phase");
  if (!gameState.lastDiscard) throw new Error("No discard to claim");

  const ld = gameState.lastDiscard;
  if ((ld.fromSeat + 1) % 4 !== claimerSeat) {
    throw new Error("Chow can only be claimed by the next player in turn order");
  }

  const claimer = gameState.players[claimerSeat];

  // Validate hand tiles form a valid sequence with the discard
  const handTiles = removeTilesFromHand(claimer, handTileIds);
  const claimedTile = finishClaim(gameState);

  // Sort tiles by rank for the meld
  const allTiles = [claimedTile, ...handTiles];
  allTiles.sort((a, b) => {
    if (a.face.category === "suited" && b.face.category === "suited") {
      return a.face.rank - b.face.rank;
    }
    return 0;
  });

  claimer.melds.push({
    type: "chow",
    tiles: allTiles,
    exposed: true,
    claimedTileId: claimedTile.id,
  });

  gameState.currentTurn = claimerSeat;
  gameState.turnPhase = "discard";
}

/**
 * Claims a pung (triplet) from the last discard.
 * Any player (except the discarder) can claim.
 */
export function claimPung(gameState: GameState, claimerSeat: number): void {
  if (gameState.phase !== "playing") throw new Error("Game is not in playing phase");
  if (gameState.turnPhase !== "claiming") throw new Error("Not in claiming phase");
  if (!gameState.lastDiscard) throw new Error("No discard to claim");
  if (gameState.lastDiscard.fromSeat === claimerSeat) throw new Error("Cannot claim own discard");

  const claimer = gameState.players[claimerSeat];
  const discardFace = gameState.lastDiscard.tile.face;

  // Find 2 matching tiles in hand
  const matching = claimer.hand.filter((t) => sameFace(t.face, discardFace));
  if (matching.length < 2) throw new Error("Not enough matching tiles for pung");

  const handTileIds: [number, number] = [matching[0].id, matching[1].id];
  const handTiles = removeTilesFromHand(claimer, handTileIds);
  const claimedTile = finishClaim(gameState);

  claimer.melds.push({
    type: "pung",
    tiles: [claimedTile, ...handTiles],
    exposed: true,
    claimedTileId: claimedTile.id,
  });

  gameState.currentTurn = claimerSeat;
  gameState.turnPhase = "discard";
}

/**
 * Claims an open kong (quad) from the last discard.
 * Any player (except the discarder) can claim.
 * Auto-draws a replacement tile from the wall end.
 */
export function claimOpenKong(gameState: GameState, claimerSeat: number): void {
  if (gameState.phase !== "playing") throw new Error("Game is not in playing phase");
  if (gameState.turnPhase !== "claiming") throw new Error("Not in claiming phase");
  if (!gameState.lastDiscard) throw new Error("No discard to claim");
  if (gameState.lastDiscard.fromSeat === claimerSeat) throw new Error("Cannot claim own discard");

  const claimer = gameState.players[claimerSeat];
  const discardFace = gameState.lastDiscard.tile.face;

  // Find 3 matching tiles in hand
  const matching = claimer.hand.filter((t) => sameFace(t.face, discardFace));
  if (matching.length < 3) throw new Error("Not enough matching tiles for kong");

  const handTileIds: [number, number, number] = [matching[0].id, matching[1].id, matching[2].id];
  const handTiles = removeTilesFromHand(claimer, handTileIds);
  const claimedTile = finishClaim(gameState);

  claimer.melds.push({
    type: "kong",
    tiles: [claimedTile, ...handTiles],
    exposed: true,
    claimedTileId: claimedTile.id,
  });

  gameState.currentTurn = claimerSeat;

  // Auto-draw replacement from wall end
  drawReplacementTile(gameState, claimer);
}

/**
 * Declares a closed kong (4 identical tiles all in own hand/drawnTile).
 * Can only be done during the discard phase by the current player.
 * Auto-draws a replacement tile from the wall end.
 */
export function declareClosedKong(
  gameState: GameState,
  seatIndex: number,
  tileIds: number[],
): void {
  if (gameState.phase !== "playing") throw new Error("Game is not in playing phase");
  if (gameState.turnPhase !== "discard") throw new Error("Not in discard phase");
  if (gameState.currentTurn !== seatIndex) throw new Error("Not your turn");
  if (tileIds.length !== 4) throw new Error("Closed kong requires exactly 4 tiles");

  const player = gameState.players[seatIndex];

  // Collect all tiles from hand + drawnTile
  const allTiles = player.drawnTile ? [...player.hand, player.drawnTile] : [...player.hand];

  // Validate all 4 tile IDs exist and share the same face
  const kongTiles: Tile[] = [];
  for (const id of tileIds) {
    const tile = allTiles.find((t) => t.id === id);
    if (!tile) throw new Error(`Tile ${id} not found in hand or drawn tile`);
    kongTiles.push(tile);
  }

  // All must share the same face
  const face = kongTiles[0].face;
  for (let i = 1; i < kongTiles.length; i++) {
    if (!sameFace(face, kongTiles[i].face)) {
      throw new Error("All tiles in a closed kong must have the same face");
    }
  }

  // Remove tiles from hand and drawnTile
  const tileIdSet = new Set(tileIds);
  player.hand = player.hand.filter((t) => !tileIdSet.has(t.id));
  if (player.drawnTile && tileIdSet.has(player.drawnTile.id)) {
    player.drawnTile = null;
  }

  player.melds.push({
    type: "kong",
    tiles: kongTiles,
    exposed: false,
  });

  // Auto-draw replacement from wall end
  drawReplacementTile(gameState, player);
}

/**
 * A player passes on claiming the current discard.
 * When all non-discarder players have passed, advances to the next player's draw phase.
 */
export function passClaim(gameState: GameState, seatIndex: number): void {
  if (gameState.phase !== "playing") throw new Error("Game is not in playing phase");
  if (gameState.turnPhase !== "claiming") throw new Error("Not in claiming phase");
  if (!gameState.lastDiscard) throw new Error("No active claim window");

  const discarderSeat = gameState.lastDiscard.fromSeat;
  if (seatIndex === discarderSeat) throw new Error("Discarder does not need to pass");

  // Don't double-count passes
  if (!gameState.claimPasses.includes(seatIndex)) {
    gameState.claimPasses.push(seatIndex);
  }

  // Check if all 3 non-discarder players have passed
  if (gameState.claimPasses.length >= 3) {
    // Advance to next player's draw phase
    gameState.currentTurn = (discarderSeat + 1) % 4;
    gameState.turnPhase = "draw";
    gameState.lastDiscard = null;
    gameState.claimPasses = [];
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
    lastDiscard: gameState.lastDiscard,
  };
}
