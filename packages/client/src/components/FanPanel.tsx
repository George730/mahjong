// Phase 2F: Fan reference panel — lists all 81 国标麻将 fan types grouped by score.
// Fixed to the right edge of the viewport, independent of game canvas layout.
// Click a fan name to expand its explanation and example tile hand.
// Fan names in explanation/desc text are underlined links that navigate to that fan.

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { FAN_DATA, type FanEntry } from "../constants/fan-data.ts";
import MiniHand from "./MiniTile.tsx";

// --- Build lookup: fan name → score group ---
const FAN_NAME_TO_SCORE: Map<string, number> = new Map();
for (const group of FAN_DATA) {
  for (const fan of group.fans) {
    FAN_NAME_TO_SCORE.set(fan.name, group.score);
  }
}
// Sorted longest-first so greedy regex matches longer names before shorter substrings
const ALL_FAN_NAMES = [...FAN_NAME_TO_SCORE.keys()].sort((a, b) => b.length - a.length);
const FAN_NAME_REGEX = new RegExp(`(${ALL_FAN_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, "g");

// Color intensity by score tier
function scoreColor(score: number): string {
  if (score >= 88) return "text-yellow-300";
  if (score >= 64) return "text-amber-400";
  if (score >= 48) return "text-orange-400";
  if (score >= 32) return "text-rose-400";
  if (score >= 24) return "text-pink-400";
  if (score >= 16) return "text-purple-400";
  if (score >= 12) return "text-indigo-400";
  if (score >= 8) return "text-blue-400";
  return "text-gray-400";
}

function scoreBg(score: number): string {
  if (score >= 88) return "bg-yellow-900/30";
  if (score >= 64) return "bg-amber-900/30";
  if (score >= 48) return "bg-orange-900/30";
  if (score >= 32) return "bg-rose-900/30";
  if (score >= 24) return "bg-pink-900/30";
  if (score >= 16) return "bg-purple-900/30";
  if (score >= 12) return "bg-indigo-900/30";
  if (score >= 8) return "bg-blue-900/30";
  return "bg-gray-900/30";
}

// --- Linked text: parses text and turns fan names into clickable links ---

function FanLinkedText({
  text,
  selfName,
  onNavigate,
  className,
}: {
  text: string;
  selfName: string;
  onNavigate: (fanName: string) => void;
  className?: string;
}) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(FAN_NAME_REGEX)) {
    const name = match[0];
    const idx = match.index!;
    // Push preceding text
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    // Don't link to self
    if (name === selfName) {
      parts.push(name);
    } else {
      parts.push(
        <button
          key={`${idx}-${name}`}
          onClick={(ev) => { ev.stopPropagation(); onNavigate(name); }}
          className="underline decoration-dotted underline-offset-2 text-emerald-400 hover:text-emerald-300 cursor-pointer"
        >
          {name}
        </button>
      );
    }
    lastIndex = idx + name.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}

// --- Individual fan item ---

function FanItem({
  fan,
  isOpen,
  onToggle,
  onNavigate,
  itemRef,
}: {
  fan: FanEntry;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (fanName: string) => void;
  itemRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="mb-0.5" ref={itemRef} data-fan={fan.name}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-0.5 px-1 rounded hover:bg-white/5 transition-colors text-left"
      >
        <span className="text-xs text-gray-300">{fan.name}</span>
        <span className={`text-xs font-mono ${scoreColor(fan.score)} opacity-70`}>
          {fan.score}
        </span>
      </button>

      {isOpen && (
        <div className="px-1 pb-1.5 pt-0.5 ml-1 border-l border-gray-700">
          <FanLinkedText
            text={fan.explanation}
            selfName={fan.name}
            onNavigate={onNavigate}
            className="text-xs text-gray-400 leading-relaxed block mb-1"
          />
          {fan.example?.map((ex, i) => (
            <div key={i} className="mb-1">
              <MiniHand notation={ex.tiles} />
              {ex.desc && (
                <FanLinkedText
                  text={ex.desc}
                  selfName={fan.name}
                  onNavigate={onNavigate}
                  className="text-xs text-gray-500 mt-0.5 block"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main panel ---

export default function FanPanel({ isEmbedded = false }: { isEmbedded?: boolean } = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(
    () => new Set(),
  );
  const [openFans, setOpenFans] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fanRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Pending navigation target (set by onNavigate, consumed by effect)
  const [navTarget, setNavTarget] = useState<string | null>(null);

  const toggleGroup = (score: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(score)) next.delete(score);
      else next.add(score);
      return next;
    });
  };

  const toggleFan = useCallback((name: string) => {
    setOpenFans((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const navigateToFan = useCallback((fanName: string) => {
    const score = FAN_NAME_TO_SCORE.get(fanName);
    if (score === undefined) return;

    // Ensure the group is expanded
    setExpandedGroups((prev) => {
      if (prev.has(score)) return prev;
      const next = new Set(prev);
      next.add(score);
      return next;
    });

    // Ensure the fan item is open
    setOpenFans((prev) => {
      if (prev.has(fanName)) return prev;
      const next = new Set(prev);
      next.add(fanName);
      return next;
    });

    // Schedule scroll after render
    setNavTarget(fanName);
  }, []);

  // Scroll to target after state updates have rendered
  useEffect(() => {
    if (!navTarget) return;
    // Use requestAnimationFrame to wait for DOM update
    const raf = requestAnimationFrame(() => {
      const el = fanRefs.current.get(navTarget);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Brief highlight flash
        el.classList.add("ring-1", "ring-emerald-400/60");
        setTimeout(() => el.classList.remove("ring-1", "ring-emerald-400/60"), 1500);
      }
      setNavTarget(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [navTarget]);

  const setFanRef = useCallback((name: string) => (el: HTMLDivElement | null) => {
    if (el) fanRefs.current.set(name, el);
    else fanRefs.current.delete(name);
  }, []);

  // Standalone mode: own fixed positioning + collapse
  if (!isEmbedded && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-16 right-0 z-50 w-8 bg-gray-800/95 border border-gray-700 rounded-l-lg flex items-center justify-center hover:bg-gray-700/90 transition-colors py-3"
        title="展开番种表"
      >
        <span className="text-gray-300 text-xs" style={{ writingMode: "vertical-rl" }}>
          番种表 ◀
        </span>
      </button>
    );
  }

  const wrapperClass = isEmbedded
    ? "bg-gray-800/95 border border-gray-700 rounded-lg flex flex-col overflow-hidden shadow-xl backdrop-blur-sm flex-1 min-h-0"
    : "fixed top-16 right-2 z-50 w-104 bg-gray-800/95 border border-gray-700 rounded-lg flex flex-col overflow-hidden shadow-xl backdrop-blur-sm";
  const wrapperStyle = isEmbedded ? {} : { maxHeight: "calc(100vh - 5rem)" };

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900/60">
        <h3 className="text-sm font-bold text-gray-200">番种表</h3>
        <div className="flex gap-1">
          <button
            onClick={() => {
              if (expandedGroups.size === FAN_DATA.length) {
                setExpandedGroups(new Set());
              } else {
                setExpandedGroups(new Set(FAN_DATA.map((g) => g.score)));
              }
            }}
            className="text-xs text-gray-500 hover:text-gray-300 px-1"
            title={expandedGroups.size === FAN_DATA.length ? "全部折叠" : "全部展开"}
          >
            {expandedGroups.size === FAN_DATA.length ? "▲" : "▼"}
          </button>
          {!isEmbedded && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-xs text-gray-500 hover:text-gray-300 px-1"
              title="收起面板"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Scrollable fan list */}
      <div ref={scrollRef} className="overflow-y-auto flex-1 px-1 py-1" style={{ scrollbarWidth: "thin" }}>
        {FAN_DATA.map((group) => {
          const isExpanded = expandedGroups.has(group.score);
          return (
            <div key={group.score} className="mb-0.5">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.score)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded ${scoreBg(group.score)} hover:brightness-125 transition-all`}
              >
                <span className={`text-xs font-bold ${scoreColor(group.score)}`}>
                  {group.score} 番
                </span>
                <span className="text-gray-500 text-xs">
                  {group.fans.length}种 {isExpanded ? "▲" : "▼"}
                </span>
              </button>

              {/* Fan items */}
              {isExpanded && (
                <div className="pl-1 pr-1 py-0.5">
                  {group.fans.map((fan) => (
                    <FanItem
                      key={fan.name}
                      fan={fan}
                      isOpen={openFans.has(fan.name)}
                      onToggle={() => toggleFan(fan.name)}
                      onNavigate={navigateToFan}
                      itemRef={setFanRef(fan.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-700 bg-gray-900/60">
        <p className="text-xs text-gray-500 text-center">
          共 81 番种 · 国标麻将
        </p>
      </div>
    </div>
  );
}
