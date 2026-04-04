// Manual test page for the scoring engine.
// Build a hand from 34 tile types, define melds, compute tenpai, select win tile, get score.

import { useState, useMemo, useCallback } from "react";
import {
  indexToFace, faceToIndex, tilesToCounts,
  findAllDecompositions, scoreHandFull,
  computeTenpai,
  FAN_REGISTRY,
  type ScoringMeld, type WinContext, type TenpaiResult, type ScoringResult, type FanMatch,
  type TenpaiContext,
} from "@mahjong/common";
import type { Tile, TileFace, Wind } from "@mahjong/common";

// --- Tile display helpers ---

const SUIT_LABELS = ["万", "条", "筒"];
const WIND_LABELS = ["东", "南", "西", "北"];
const DRAGON_LABELS = ["中", "发", "白"];

function tileName(idx: number): string {
  if (idx < 27) {
    const suit = Math.floor(idx / 9);
    const rank = (idx % 9) + 1;
    return `${rank}${SUIT_LABELS[suit]}`;
  }
  if (idx < 31) return WIND_LABELS[idx - 27];
  return DRAGON_LABELS[idx - 31];
}

function tileColor(idx: number): string {
  if (idx < 9) return "text-blue-400";        // wan
  if (idx < 18) return "text-green-400";       // tiao
  if (idx < 27) return "text-orange-400";      // tong
  if (idx < 31) return "text-gray-300";        // winds
  if (idx === 31) return "text-red-400";       // zhong
  if (idx === 32) return "text-green-400";     // fa
  return "text-gray-300";                       // bai
}

// --- Meld definition ---

interface MeldDef {
  type: "chow" | "pung" | "kong";
  tileIndices: number[];
  concealed: boolean;
}

// --- Tile picker button ---

function TileButton({
  idx,
  count,
  onClick,
  disabled,
  size = "normal",
}: {
  idx: number;
  count?: number;
  onClick: () => void;
  disabled?: boolean;
  size?: "normal" | "small";
}) {
  const sz = size === "small" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${sz} rounded border border-gray-600 flex flex-col items-center justify-center
        ${disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-700 cursor-pointer"}
        ${tileColor(idx)} font-bold bg-gray-800 relative`}
      title={tileName(idx)}
    >
      <span>{tileName(idx)}</span>
      {count !== undefined && count > 0 && (
        <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}

// --- Meld display ---

function MeldDisplay({ meld, onRemove }: { meld: MeldDef; onRemove: () => void }) {
  const label = meld.type === "chow" ? "顺" : meld.type === "pung" ? "刻" : "杠";
  const bgColor = meld.type === "chow" ? "bg-cyan-900/40" : meld.type === "pung" ? "bg-green-900/40" : "bg-amber-900/40";
  const borderColor = meld.type === "chow" ? "border-cyan-700" : meld.type === "pung" ? "border-green-700" : "border-amber-700";

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded border ${bgColor} ${borderColor}`}>
      <span className="text-xs text-gray-400 mr-1">
        {label}{meld.concealed ? "暗" : "明"}
      </span>
      {meld.tileIndices.map((idx, i) => (
        <span key={i} className={`text-sm font-bold ${tileColor(idx)}`}>
          {tileName(idx)}
        </span>
      ))}
      <button
        onClick={onRemove}
        className="ml-1 text-red-400 hover:text-red-300 text-xs"
        title="Remove meld"
      >
        ✕
      </button>
    </div>
  );
}

// --- Main page ---

export default function ScoringTestPage() {
  // Hand tiles (closed hand, as tile indices with counts)
  const [handCounts, setHandCounts] = useState<number[]>(() => new Array(34).fill(0));
  // Declared melds
  const [melds, setMelds] = useState<MeldDef[]>([]);
  // Meld builder state
  const [meldType, setMeldType] = useState<"chow" | "pung" | "kong">("chow");
  const [meldConcealed, setMeldConcealed] = useState(false);
  const [meldTiles, setMeldTiles] = useState<number[]>([]);
  // Context
  const [seatWind, setSeatWind] = useState<Wind>("east");
  const [roundWind, setRoundWind] = useState<Wind>("east");
  const [winSource, setWinSource] = useState<"selfDraw" | "discard">("discard");
  // Selected winning tile (from tenpai waits)
  const [selectedWait, setSelectedWait] = useState<number | null>(null);

  // Total tiles used
  const totalHandTiles = handCounts.reduce((a, b) => a + b, 0);
  const totalMeldTiles = melds.reduce((sum, m) => sum + m.tileIndices.length, 0);
  const totalTiles = totalHandTiles + totalMeldTiles;
  const neededMelds = 4 - melds.length;
  const expectedHandTiles = neededMelds * 3 + 2; // melds * 3 + pair
  // For tenpai we need expectedHandTiles - 1 = 13 (or less with melds)
  const tenpaiHandSize = expectedHandTiles - 1;

  // Count tiles used per index (hand + melds) for the 4-copy limit
  const usedCounts = useMemo(() => {
    const counts = [...handCounts];
    for (const m of melds) {
      for (const idx of m.tileIndices) counts[idx]++;
    }
    return counts;
  }, [handCounts, melds]);

  // Add tile to hand
  const addTile = useCallback((idx: number) => {
    if (usedCounts[idx] >= 4) return;
    if (totalHandTiles >= expectedHandTiles) return;
    setHandCounts(prev => {
      const next = [...prev];
      next[idx]++;
      return next;
    });
    setSelectedWait(null);
  }, [usedCounts, totalHandTiles, expectedHandTiles]);

  // Remove tile from hand
  const removeTile = useCallback((idx: number) => {
    setHandCounts(prev => {
      if (prev[idx] <= 0) return prev;
      const next = [...prev];
      next[idx]--;
      return next;
    });
    setSelectedWait(null);
  }, []);

  // Meld builder: add tile to current meld being built
  const addToMeld = useCallback((idx: number) => {
    const needed = meldType === "kong" ? 4 : 3;
    if (meldTiles.length >= needed) return;
    setMeldTiles(prev => [...prev, idx]);
  }, [meldType, meldTiles]);

  // Confirm meld
  const confirmMeld = useCallback(() => {
    const needed = meldType === "kong" ? 4 : 3;
    if (meldTiles.length !== needed) return;

    // Validate: chow must be same suit, consecutive
    if (meldType === "chow") {
      const sorted = [...meldTiles].sort((a, b) => a - b);
      if (sorted.some(i => i >= 27)) return; // no honors in chow
      if (Math.floor(sorted[0] / 9) !== Math.floor(sorted[2] / 9)) return; // same suit
      if (sorted[1] - sorted[0] !== 1 || sorted[2] - sorted[1] !== 1) return; // consecutive
    }

    // Validate: pung must be all same
    if (meldType === "pung") {
      if (!meldTiles.every(i => i === meldTiles[0])) return;
    }

    // Validate: kong must be all same
    if (meldType === "kong") {
      if (!meldTiles.every(i => i === meldTiles[0])) return;
    }

    // Check 4-copy limit
    const tempCounts = [...usedCounts];
    for (const idx of meldTiles) {
      tempCounts[idx]++;
      if (tempCounts[idx] > 4) return;
    }

    setMelds(prev => [...prev, {
      type: meldType,
      tileIndices: [...meldTiles].sort((a, b) => a - b),
      concealed: meldConcealed,
    }]);
    setMeldTiles([]);
    setSelectedWait(null);
  }, [meldType, meldConcealed, meldTiles, usedCounts]);

  // Remove meld
  const removeMeld = useCallback((idx: number) => {
    setMelds(prev => prev.filter((_, i) => i !== idx));
    setSelectedWait(null);
  }, []);

  // Compute tenpai
  const tenpaiResult = useMemo((): TenpaiResult | null => {
    if (totalHandTiles !== tenpaiHandSize) return null;

    // Build fake Tile array from counts
    const fakeTiles: Tile[] = [];
    let id = 0;
    for (let idx = 0; idx < 34; idx++) {
      for (let c = 0; c < handCounts[idx]; c++) {
        fakeTiles.push({ id: id++, face: indexToFace(idx) });
      }
    }

    // Build fake Melds
    const fakeMelds = melds.map((m, i) => ({
      type: m.type as "chow" | "pung" | "kong",
      tiles: m.tileIndices.map((idx, j) => ({ id: 1000 + i * 10 + j, face: indexToFace(idx) })),
      exposed: !m.concealed,
    }));

    const ctx: TenpaiContext = {
      melds: fakeMelds,
      seatWind,
      roundWind,
      bonusTileCount: 0,
      visibleCounts: new Array(34).fill(0), // simplified: no visible info in test
    };

    try {
      return computeTenpai(fakeTiles, ctx);
    } catch {
      return null;
    }
  }, [handCounts, melds, totalHandTiles, tenpaiHandSize, seatWind, roundWind]);

  // Compute full score for selected wait
  const scoringResult = useMemo((): ScoringResult | null => {
    if (selectedWait === null) return null;
    if (!tenpaiResult?.isTenpai) return null;

    // Build full hand counts (hand + win tile)
    const fullCounts = [...handCounts];
    fullCounts[selectedWait]++;

    const scoringMelds: ScoringMeld[] = melds.map(m => ({
      type: m.type,
      tileIndices: m.tileIndices,
      concealed: m.concealed,
    }));

    const context: WinContext = {
      winTile: selectedWait,
      winSource,
      seatWind,
      roundWind,
      seatIndex: 0,
      isDealer: seatWind === "east",
      wallCount: 50,
      bonusTileCount: 0,
      isKongDraw: false,
      isRobbingKong: false,
      declaredMeldCount: melds.filter(m => !m.concealed).length,
      winTileVisibleCount: 0,
    };

    try {
      return scoreHandFull(fullCounts, scoringMelds, selectedWait, context);
    } catch {
      return null;
    }
  }, [selectedWait, tenpaiResult, handCounts, melds, winSource, seatWind, roundWind]);

  // Reset
  const resetAll = () => {
    setHandCounts(new Array(34).fill(0));
    setMelds([]);
    setMeldTiles([]);
    setSelectedWait(null);
  };

  return (
    <div className="max-w-4xl mx-auto mt-4 px-4 pb-16 select-none">
      <h1 className="text-xl font-bold mb-4">Scoring Engine Test</h1>

      {/* Status bar */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
        <span>Hand: <span className={totalHandTiles === tenpaiHandSize ? "text-emerald-400" : "text-yellow-400"}>{totalHandTiles}/{tenpaiHandSize}</span> tiles</span>
        <span>Melds: {melds.length}/4</span>
        <span>Total: {totalTiles}</span>
        <button onClick={resetAll} className="ml-auto px-3 py-1 bg-red-900/40 hover:bg-red-800/40 rounded text-red-300 text-xs">
          Reset
        </button>
      </div>

      {/* Context settings */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <label className="text-gray-400">
          Seat wind:
          <select
            value={seatWind}
            onChange={e => setSeatWind(e.target.value as Wind)}
            className="ml-1 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-200"
          >
            {(["east", "south", "west", "north"] as Wind[]).map(w => (
              <option key={w} value={w}>{WIND_LABELS[["east", "south", "west", "north"].indexOf(w)]}</option>
            ))}
          </select>
        </label>
        <label className="text-gray-400">
          Round wind:
          <select
            value={roundWind}
            onChange={e => setRoundWind(e.target.value as Wind)}
            className="ml-1 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-200"
          >
            {(["east", "south", "west", "north"] as Wind[]).map(w => (
              <option key={w} value={w}>{WIND_LABELS[["east", "south", "west", "north"].indexOf(w)]}</option>
            ))}
          </select>
        </label>
        <label className="text-gray-400">
          Win by:
          <select
            value={winSource}
            onChange={e => setWinSource(e.target.value as "selfDraw" | "discard")}
            className="ml-1 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-200"
          >
            <option value="selfDraw">自摸</option>
            <option value="discard">点炮</option>
          </select>
        </label>
      </div>

      {/* Tile picker: 34 tiles arranged by suit */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Click to add to hand (right-click to remove)</h3>
        {/* Wan */}
        <div className="flex gap-1 mb-1">
          <span className="text-xs text-gray-500 w-8 self-center">万</span>
          {Array.from({ length: 9 }, (_, i) => i).map(idx => (
            <TileButton
              key={idx}
              idx={idx}
              count={handCounts[idx]}
              onClick={() => addTile(idx)}
              disabled={usedCounts[idx] >= 4 || totalHandTiles >= expectedHandTiles}
            />
          ))}
        </div>
        {/* Tiao */}
        <div className="flex gap-1 mb-1">
          <span className="text-xs text-gray-500 w-8 self-center">条</span>
          {Array.from({ length: 9 }, (_, i) => i + 9).map(idx => (
            <TileButton
              key={idx}
              idx={idx}
              count={handCounts[idx]}
              onClick={() => addTile(idx)}
              disabled={usedCounts[idx] >= 4 || totalHandTiles >= expectedHandTiles}
            />
          ))}
        </div>
        {/* Tong */}
        <div className="flex gap-1 mb-1">
          <span className="text-xs text-gray-500 w-8 self-center">筒</span>
          {Array.from({ length: 9 }, (_, i) => i + 18).map(idx => (
            <TileButton
              key={idx}
              idx={idx}
              count={handCounts[idx]}
              onClick={() => addTile(idx)}
              disabled={usedCounts[idx] >= 4 || totalHandTiles >= expectedHandTiles}
            />
          ))}
        </div>
        {/* Winds + Dragons */}
        <div className="flex gap-1 mb-1">
          <span className="text-xs text-gray-500 w-8 self-center">字</span>
          {Array.from({ length: 7 }, (_, i) => i + 27).map(idx => (
            <TileButton
              key={idx}
              idx={idx}
              count={handCounts[idx]}
              onClick={() => addTile(idx)}
              disabled={usedCounts[idx] >= 4 || totalHandTiles >= expectedHandTiles}
            />
          ))}
        </div>
      </div>

      {/* Current hand display */}
      <div className="mb-4 p-3 bg-gray-900/60 rounded border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Hand (closed tiles)</h3>
        <div className="flex flex-wrap gap-1 min-h-[40px]">
          {Array.from({ length: 34 }, (_, idx) => idx).flatMap(idx =>
            Array.from({ length: handCounts[idx] }, (_, c) => (
              <TileButton
                key={`${idx}-${c}`}
                idx={idx}
                onClick={() => removeTile(idx)}
                size="small"
              />
            ))
          )}
          {totalHandTiles === 0 && <span className="text-gray-600 text-sm">Click tiles above to add</span>}
        </div>
      </div>

      {/* Declared melds */}
      <div className="mb-4 p-3 bg-gray-900/60 rounded border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Declared Melds</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {melds.map((m, i) => (
            <MeldDisplay key={i} meld={m} onRemove={() => removeMeld(i)} />
          ))}
          {melds.length === 0 && <span className="text-gray-600 text-sm">No melds declared</span>}
        </div>

        {/* Meld builder */}
        {melds.length < 4 && (
          <div className="border-t border-gray-700 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">Add meld:</span>
              {(["chow", "pung", "kong"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setMeldType(t); setMeldTiles([]); }}
                  className={`px-2 py-0.5 rounded text-xs ${meldType === t ? "bg-emerald-700 text-white" : "bg-gray-700 text-gray-400"}`}
                >
                  {t === "chow" ? "顺(Chow)" : t === "pung" ? "刻(Pung)" : "杠(Kong)"}
                </button>
              ))}
              <label className="flex items-center gap-1 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={meldConcealed}
                  onChange={e => setMeldConcealed(e.target.checked)}
                />
                Concealed
              </label>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {meldTiles.map((idx, i) => (
                  <span key={i} className={`text-sm font-bold ${tileColor(idx)} bg-gray-700 px-1 rounded`}>
                    {tileName(idx)}
                  </span>
                ))}
                {meldTiles.length < (meldType === "kong" ? 4 : 3) && (
                  <span className="text-gray-600 text-xs self-center">
                    Pick {(meldType === "kong" ? 4 : 3) - meldTiles.length} more tile{(meldType === "kong" ? 4 : 3) - meldTiles.length > 1 ? "s" : ""} below
                  </span>
                )}
              </div>
              <button
                onClick={confirmMeld}
                disabled={meldTiles.length !== (meldType === "kong" ? 4 : 3)}
                className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs text-white"
              >
                Confirm
              </button>
              <button
                onClick={() => setMeldTiles([])}
                className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
              >
                Clear
              </button>
            </div>
            {/* Mini tile picker for meld building */}
            {meldTiles.length < (meldType === "kong" ? 4 : 3) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Array.from({ length: 34 }, (_, idx) => idx).map(idx => (
                  <button
                    key={idx}
                    onClick={() => addToMeld(idx)}
                    disabled={usedCounts[idx] + meldTiles.filter(t => t === idx).length >= 4}
                    className={`w-7 h-7 text-xs rounded border border-gray-700 flex items-center justify-center font-bold
                      ${usedCounts[idx] + meldTiles.filter(t => t === idx).length >= 4 ? "opacity-20" : "hover:bg-gray-700"}
                      ${tileColor(idx)} bg-gray-800`}
                  >
                    {tileName(idx)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tenpai result */}
      <div className="mb-4 p-3 bg-gray-900/60 rounded border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Tenpai Analysis</h3>
        {totalHandTiles !== tenpaiHandSize ? (
          <p className="text-gray-600 text-sm">
            Need exactly {tenpaiHandSize} tiles in hand ({totalHandTiles} now)
          </p>
        ) : tenpaiResult === null ? (
          <p className="text-gray-600 text-sm">Computing...</p>
        ) : !tenpaiResult.isTenpai ? (
          <p className="text-red-400 text-sm">Not tenpai — no winning tiles available</p>
        ) : (
          <div>
            <p className="text-emerald-400 text-sm mb-2">
              Tenpai! Waiting for {tenpaiResult.waits.length} tile type{tenpaiResult.waits.length > 1 ? "s" : ""}:
            </p>
            <div className="flex flex-wrap gap-2">
              {tenpaiResult.waits.map(w => (
                <button
                  key={w.tileIndex}
                  onClick={() => setSelectedWait(w.tileIndex === selectedWait ? null : w.tileIndex)}
                  className={`flex flex-col items-center p-2 rounded border transition-colors ${
                    selectedWait === w.tileIndex
                      ? "border-emerald-400 bg-emerald-900/30"
                      : "border-gray-600 bg-gray-800 hover:border-gray-500"
                  }`}
                >
                  <span className={`text-lg font-bold ${tileColor(w.tileIndex)}`}>
                    {tileName(w.tileIndex)}
                  </span>
                  <span className="text-xs text-gray-400">
                    base {w.baseScore} fan
                  </span>
                  <span className="text-xs text-gray-500">
                    {w.remainingCount} left
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Score result */}
      {selectedWait !== null && scoringResult && (
        <div className="mb-4 p-3 bg-gray-900/60 rounded border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-2">
            Score — Hu with <span className={`font-bold ${tileColor(selectedWait)}`}>{tileName(selectedWait)}</span>
            {" "}({winSource === "selfDraw" ? "自摸" : "点炮"})
          </h3>
          {!scoringResult.isWin ? (
            <div>
              <p className="text-red-400 text-sm">
                Cannot hu: {scoringResult.reason === "insufficient-fan"
                  ? `Only ${scoringResult.bestScore} fan (need 8 minimum)`
                  : "No valid decomposition"
                }
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-2xl font-bold text-yellow-400">
                  {scoringResult.result!.totalScore} 番
                </span>
                <span className="text-sm text-gray-400">
                  (fan: {scoringResult.result!.fanScore} + bonus: {scoringResult.result!.bonusScore})
                </span>
              </div>

              {/* Fan breakdown */}
              <div className="space-y-1">
                {scoringResult.result!.fans.map((fan, i) => (
                  <div key={i} className="flex items-center justify-between px-2 py-1 bg-gray-800/50 rounded">
                    <span className="text-sm text-gray-200">
                      {fan.fan}
                      {fan.count > 1 && <span className="text-gray-500"> x{fan.count}</span>}
                    </span>
                    <span className="text-sm font-mono text-yellow-400">
                      {fan.score * fan.count}
                    </span>
                  </div>
                ))}
              </div>

              {/* Decomposition info */}
              {scoringResult.result!.hand && (
                <div className="mt-3 pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-500">
                    Form: {scoringResult.result!.hand.form}
                    {scoringResult.result!.hand.pair >= 0 && (
                      <> | Pair: <span className={tileColor(scoringResult.result!.hand.pair)}>{tileName(scoringResult.result!.hand.pair)}</span></>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {scoringResult.result!.hand.allMelds.map((m, i) => (
                      <span key={i} className="text-xs bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
                        <span className="text-gray-500">
                          {m.type === "chow" ? "顺" : m.type === "pung" ? "刻" : "杠"}
                          {m.concealed ? "暗" : "明"}:
                        </span>{" "}
                        {m.tileIndices.map(idx => tileName(idx)).join(" ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
