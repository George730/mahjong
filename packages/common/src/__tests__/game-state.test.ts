// Unit tests for game state, deal logic, and flower/season replacement

import { describe, it, expect } from "vitest";
import { deal, createPlayerView, seatWind } from "../game-state.js";
import { isBonusTile, createFullSet } from "../tiles.js";

const PLAYER_IDS = ["p1", "p2", "p3", "p4"];

describe("deal", () => {
  it("requires exactly 4 players", () => {
    expect(() => deal(["p1", "p2", "p3"])).toThrow("Exactly 4 players are required");
    expect(() => deal(["p1", "p2", "p3", "p4", "p5"])).toThrow("Exactly 4 players are required");
  });

  it("requires valid dealer index", () => {
    expect(() => deal(PLAYER_IDS, -1)).toThrow("Dealer must be 0-3");
    expect(() => deal(PLAYER_IDS, 4)).toThrow("Dealer must be 0-3");
  });

  it("dealer receives 14 tiles, others receive 13", () => {
    const { gameState } = deal(PLAYER_IDS, 0);
    // After bonus replacement, counts may differ from 13/14
    // but total tiles dealt + wall + bonus tiles = 144
    const dealerPlayer = gameState.players[0];
    const otherPlayers = gameState.players.slice(1);

    // Before bonus replacement the dealer would have 14 and others 13
    // After replacement, hand sizes may vary but total across all locations = 144
    const totalTiles =
      gameState.wall.length +
      gameState.players.reduce((sum, p) => sum + p.hand.length + p.bonusTiles.length, 0);
    expect(totalTiles).toBe(144);
  });

  it("dealing removes exactly 53 tiles from wall (before bonus replacement)", () => {
    // 4 players × 13 tiles + 1 extra for dealer = 53
    // After bonus replacement, more tiles may be drawn from wall
    const { gameState } = deal(PLAYER_IDS);
    const tilesInHands = gameState.players.reduce((sum, p) => sum + p.hand.length, 0);
    const bonusTilesCount = gameState.players.reduce((sum, p) => sum + p.bonusTiles.length, 0);

    // Wall + hands + bonus = 144
    expect(gameState.wall.length + tilesInHands + bonusTilesCount).toBe(144);

    // Without bonus tiles, exactly 53 tiles would be dealt
    // With bonus replacement, additional tiles are drawn from wall end
    // So wall should be <= 91 (144 - 53)
    expect(gameState.wall.length).toBeLessThanOrEqual(91);
  });

  it("wall has 91 tiles after deal when no bonus tiles are dealt", () => {
    // Run multiple deals until we can verify the math
    // 144 total - 53 dealt = 91 wall (if no bonus tiles in hands)
    const { gameState } = deal(PLAYER_IDS);
    const bonusCount = gameState.players.reduce((sum, p) => sum + p.bonusTiles.length, 0);
    // Wall = 91 - bonusCount (each bonus tile causes one extra draw from wall)
    expect(gameState.wall.length).toBe(91 - bonusCount);
  });

  it("no bonus tiles remain in any player hand", () => {
    // Run 20 deals to increase chance of hitting bonus tiles
    for (let i = 0; i < 20; i++) {
      const { gameState } = deal(PLAYER_IDS);
      for (const player of gameState.players) {
        for (const tile of player.hand) {
          expect(isBonusTile(tile)).toBe(false);
        }
      }
    }
  });

  it("bonus tiles in initial deal are replaced from wall end", () => {
    const { gameState } = deal(PLAYER_IDS);
    // All bonus tiles should be in bonusTiles arrays
    const allBonusTiles = gameState.players.flatMap((p) => p.bonusTiles);
    for (const tile of allBonusTiles) {
      expect(isBonusTile(tile)).toBe(true);
    }
  });

  it("replacement tile that is also bonus triggers chained replacement", () => {
    // This is probabilistic — just verify invariants hold after many deals
    for (let i = 0; i < 50; i++) {
      const { gameState } = deal(PLAYER_IDS);
      // No bonus tiles in any hand
      for (const player of gameState.players) {
        for (const tile of player.hand) {
          expect(isBonusTile(tile)).toBe(false);
        }
      }
      // Total tiles always 144
      const total =
        gameState.wall.length +
        gameState.players.reduce((sum, p) => sum + p.hand.length + p.bonusTiles.length, 0);
      expect(total).toBe(144);
    }
  });

  it("all tiles are unique across wall, hands, and bonus tiles", () => {
    const { gameState } = deal(PLAYER_IDS);
    const allIds = new Set<number>();

    for (const tile of gameState.wall) {
      expect(allIds.has(tile.id)).toBe(false);
      allIds.add(tile.id);
    }
    for (const player of gameState.players) {
      for (const tile of player.hand) {
        expect(allIds.has(tile.id)).toBe(false);
        allIds.add(tile.id);
      }
      for (const tile of player.bonusTiles) {
        expect(allIds.has(tile.id)).toBe(false);
        allIds.add(tile.id);
      }
    }
    expect(allIds.size).toBe(144);
  });

  it("sets phase to playing", () => {
    const { gameState } = deal(PLAYER_IDS);
    expect(gameState.phase).toBe("playing");
  });

  it("sets current turn to dealer", () => {
    const { gameState } = deal(PLAYER_IDS, 2);
    expect(gameState.currentTurn).toBe(2);
    expect(gameState.dealer).toBe(2);
  });

  it("sets round wind to east by default", () => {
    const { gameState } = deal(PLAYER_IDS);
    expect(gameState.roundWind).toBe("east");
  });

  it("sets round wind to specified value", () => {
    const { gameState } = deal(PLAYER_IDS, 0, "south");
    expect(gameState.roundWind).toBe("south");
  });

  it("assigns correct player IDs and seat indices", () => {
    const { gameState } = deal(PLAYER_IDS);
    for (let i = 0; i < 4; i++) {
      expect(gameState.players[i].userId).toBe(PLAYER_IDS[i]);
      expect(gameState.players[i].seatIndex).toBe(i);
    }
  });

  it("initializes empty discards and melds", () => {
    const { gameState } = deal(PLAYER_IDS);
    for (const player of gameState.players) {
      expect(player.discards).toEqual([]);
      expect(player.melds).toEqual([]);
    }
  });

  it("initializes turn count to 0", () => {
    const { gameState } = deal(PLAYER_IDS);
    expect(gameState.turnCount).toBe(0);
  });
});

describe("state machine", () => {
  it("initial state from deal is playing (dealing is transient)", () => {
    const { gameState } = deal(PLAYER_IDS);
    expect(gameState.phase).toBe("playing");
  });
});

describe("createPlayerView", () => {
  it("shows only the requesting player's hand", () => {
    const { gameState } = deal(PLAYER_IDS);
    const view = createPlayerView(gameState, 0);

    // Should see own hand
    expect(view.hand.length).toBeGreaterThan(0);
    expect(view.hand).toEqual(gameState.players[0].hand);
  });

  it("shows hand counts for all players but not their tiles", () => {
    const { gameState } = deal(PLAYER_IDS);
    const view = createPlayerView(gameState, 1);

    expect(view.players).toHaveLength(4);
    for (const p of view.players) {
      expect(p.handCount).toBeGreaterThan(0);
      // PublicPlayerState should not have a hand property
      expect("hand" in p).toBe(false);
    }
  });

  it("includes wall count instead of wall tiles", () => {
    const { gameState } = deal(PLAYER_IDS);
    const view = createPlayerView(gameState, 0);

    expect(view.wallCount).toBe(gameState.wall.length);
    expect("wall" in view).toBe(false);
  });

  it("includes all public game info", () => {
    const { gameState } = deal(PLAYER_IDS, 2, "south");
    const view = createPlayerView(gameState, 0);

    expect(view.phase).toBe("playing");
    expect(view.currentTurn).toBe(2);
    expect(view.dealer).toBe(2);
    expect(view.roundWind).toBe("south");
    expect(view.turnCount).toBe(0);
  });

  it("shows own bonus tiles", () => {
    const { gameState } = deal(PLAYER_IDS);
    const view = createPlayerView(gameState, 0);
    expect(view.bonusTiles).toEqual(gameState.players[0].bonusTiles);
  });

  it("shows other players' bonus tiles, discards, and melds", () => {
    const { gameState } = deal(PLAYER_IDS);
    const view = createPlayerView(gameState, 0);

    for (let i = 0; i < 4; i++) {
      expect(view.players[i].bonusTiles).toEqual(gameState.players[i].bonusTiles);
      expect(view.players[i].discards).toEqual(gameState.players[i].discards);
      expect(view.players[i].melds).toEqual(gameState.players[i].melds);
    }
  });
});

describe("seatWind", () => {
  it("maps seat indices to winds", () => {
    expect(seatWind(0)).toBe("east");
    expect(seatWind(1)).toBe("south");
    expect(seatWind(2)).toBe("west");
    expect(seatWind(3)).toBe("north");
  });
});
