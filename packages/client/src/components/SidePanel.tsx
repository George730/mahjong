// Wrapper for the right-side reference panels (glossary + fan table).
// Fixed to the right edge of the viewport.

import { useState } from "react";
import GlossaryPanel from "./GlossaryPanel.tsx";
import FanPanel from "./FanPanel.tsx";

export default function SidePanel() {
  const [collapsed, setCollapsed] = useState(true);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-16 right-0 z-50 w-8 bg-gray-800/95 border border-gray-700 rounded-l-lg flex items-center justify-center hover:bg-gray-700/90 transition-colors py-3"
        title="展开参考面板"
      >
        <span className="text-gray-300 text-xs" style={{ writingMode: "vertical-rl" }}>
          参考 ◀
        </span>
      </button>
    );
  }

  return (
    <div className="fixed top-16 right-2 z-50 w-104 flex flex-col gap-1" style={{ maxHeight: "calc(100vh - 5rem)" }}>
      {/* Collapse button */}
      <div className="flex justify-end">
        <button
          onClick={() => setCollapsed(true)}
          className="text-xs text-gray-500 hover:text-gray-300 px-1"
          title="收起面板"
        >
          ✕ 收起
        </button>
      </div>
      <GlossaryPanel />
      <FanPanel isEmbedded />
    </div>
  );
}
