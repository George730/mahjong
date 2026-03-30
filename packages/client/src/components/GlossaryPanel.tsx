// Mahjong glossary panel — explains common terminology (术语).
// Rendered as a collapsible section above the fan panel.

import { useState } from "react";
import MiniHand from "./MiniTile.tsx";

interface Term {
  name: string;
  explanation: string;
  /** Optional tile examples in compact notation. */
  example?: string;
}

const GLOSSARY: Term[] = [
  {
    name: "花色",
    explanation: "序数牌的三种门类：万（万子）、条（索子）、饼（筒子），每种1-9各4张。",
    example: "1m 5m 9m|1s 5s 9s|1p 5p 9p",
  },
  {
    name: "字牌",
    explanation: "包括风牌（东南西北）和箭牌（中发白），各4张，共28张。",
    example: "E S W N|Z F B",
  },
  {
    name: "花牌",
    explanation: "春夏秋冬、梅兰竹菊共8张。摸到后亮出并补牌，每张计1番。",
    example: "春 夏 秋 冬|梅 兰 竹 菊",
  },
  {
    name: "门",
    explanation: "门风：每位玩家的座位风。东家（庄家）、南家、西家、北家按逆时针排列。",
  },
  {
    name: "圈",
    explanation: "圈风：当前整局的风。四位玩家各做一次庄为一圈，依次为东圈、南圈、西圈、北圈。",
  },
  {
    name: "顺子",
    explanation: "同一花色三张序数相连的牌。如一二三万、四五六条。又称「吃」得到的面子。",
    example: "1m 2m 3m",
  },
  {
    name: "刻子",
    explanation: "三张相同的牌。暗刻为自己摸齐，明刻为碰他人的牌。",
    example: "5p 5p 5p",
  },
  {
    name: "将牌",
    explanation: "和牌时必须有的一对（2张相同的牌），也叫「眼」「雀头」。",
    example: "9s 9s",
  },
  {
    name: "吃",
    explanation: "上家打出的牌与自己手中两张牌组成顺子时可以吃。吃后顺子亮出，从手中打出一张。",
    example: "4m 5m 6m",
  },
  {
    name: "碰",
    explanation: "任何人打出的牌与自己手中两张相同牌可以碰，组成明刻。碰后亮出，从手中打出一张。",
    example: "E E E",
  },
  {
    name: "杠",
    explanation: "四张相同的牌。明杠：碰后自摸第四张或手中有暗刻碰他人一张；暗杠：自己摸齐四张。杠后从牌墙尾部补一张。",
    example: "7s 7s 7s 7s",
  },
  {
    name: "点炮",
    explanation: "又叫「放炮」「荣和」。他人打出的牌恰好是自己需要的最后一张，可以和牌。点炮者需付分给和牌者。",
  },
];

export default function GlossaryPanel() {
  const [collapsed, setCollapsed] = useState(true);
  const [openTerms, setOpenTerms] = useState<Set<string>>(() => new Set());

  const toggleTerm = (name: string) => {
    setOpenTerms((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="bg-gray-800/95 border border-gray-700 rounded-lg flex flex-col overflow-hidden shadow-xl backdrop-blur-sm">
      {/* Header — always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900/60 w-full text-left"
      >
        <h3 className="text-sm font-bold text-gray-200">麻将术语</h3>
        <span className="text-xs text-gray-500">{collapsed ? "▼" : "▲"}</span>
      </button>

      {!collapsed && (
        <div className="overflow-y-auto px-1 py-1" style={{ maxHeight: "40vh", scrollbarWidth: "thin" }}>
          {GLOSSARY.map((term) => {
            const isOpen = openTerms.has(term.name);
            return (
              <div key={term.name} className="mb-0.5">
                <button
                  onClick={() => toggleTerm(term.name)}
                  className="w-full flex items-center justify-between py-0.5 px-1 rounded hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-xs text-gray-300 font-medium">{term.name}</span>
                  <span className="text-xs text-gray-600">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div className="px-1 pb-1.5 pt-0.5 ml-1 border-l border-gray-700">
                    <p className="text-xs text-gray-400 leading-relaxed mb-1">{term.explanation}</p>
                    {term.example && <MiniHand notation={term.example} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
