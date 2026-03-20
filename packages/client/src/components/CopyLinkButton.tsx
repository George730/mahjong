// Button that copies the room invite URL to clipboard (shows "Copied!" feedback)

import { useState } from "react";

export default function CopyLinkButton({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/room/${roomCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
    >
      {copied ? "Copied!" : "Copy Invite Link"}
    </button>
  );
}
