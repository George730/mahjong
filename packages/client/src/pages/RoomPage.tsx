// Room lobby page — shows 4 player seats, invite link, leave button, and start game

import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MAX_PLAYERS, windForSeat, WIND_CN, type PlayerGameView } from "@mahjong/common";
import { useAuthStore } from "../stores/auth-store.ts";
import { useRoomStore } from "../stores/room-store.ts";
import { useGameStore } from "../stores/game-store.ts";
import PlayerSlot from "../components/PlayerSlot.tsx";
import CopyLinkButton from "../components/CopyLinkButton.tsx";
import GameCanvas from "../components/three/GameCanvas.tsx";
import HandLayout from "../components/three/HandLayout.tsx";
import TableOverlays from "../components/three/TableOverlays.tsx";

/** In-game view — extracted so hooks can be used unconditionally. */
function GameView({
  gameView,
  room,
  user,
  onLeave,
}: {
  gameView: PlayerGameView;
  room: { code: string };
  user: { id: string } | null;
  onLeave: () => void;
}) {
  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const drawTileFn = useGameStore((s) => s.drawTile);
  const discardTileFn = useGameStore((s) => s.discardTile);
  const availableClaims = useGameStore((s) => s.availableClaims);
  const selectedChowOption = useGameStore((s) => s.selectedChowOption);
  const selectChowOptionFn = useGameStore((s) => s.selectChowOption);
  const claimChowFn = useGameStore((s) => s.claimChow);
  const claimPungFn = useGameStore((s) => s.claimPung);
  const claimOpenKongFn = useGameStore((s) => s.claimOpenKong);
  const claimClosedKongFn = useGameStore((s) => s.claimClosedKong);
  const claimPassFn = useGameStore((s) => s.claimPass);

  const mySeat = gameView.players.find((p) => p.userId === user?.id);
  const mySeatIndex = mySeat?.seatIndex ?? 0;
  const isMyTurn = gameView.currentTurn === mySeatIndex;

  const showDiscardBtn = isMyTurn && gameView.turnPhase === "discard" && selectedTileId !== null;

  // Auto-draw: when it's our turn and draw phase, draw automatically
  const drawingRef = useRef(false);
  useEffect(() => {
    if (isMyTurn && gameView.turnPhase === "draw" && !drawingRef.current) {
      drawingRef.current = true;
      drawTileFn().finally(() => { drawingRef.current = false; });
    }
  }, [isMyTurn, gameView.turnPhase, drawTileFn]);

  const handleDiscard = async () => {
    if (selectedTileId === null) return;
    await discardTileFn(selectedTileId);
  };

  // Claim handlers
  const handleChow = async () => {
    if (!availableClaims) return;
    if (availableClaims.chow.length === 1) {
      await claimChowFn(availableClaims.chow[0].handTileIds);
    } else if (selectedChowOption !== null && availableClaims.chow[selectedChowOption]) {
      await claimChowFn(availableClaims.chow[selectedChowOption].handTileIds);
    }
    // If multiple options and none selected, do nothing (user must pick first)
  };

  const handlePung = () => claimPungFn();
  const handleOpenKong = () => claimOpenKongFn();
  const handleClosedKong = () => {
    if (!availableClaims || !availableClaims.closedKong.length) return;
    claimClosedKongFn(availableClaims.closedKong[0].tileIds);
  };
  const handlePass = () => claimPassFn();

  // Show claim buttons during claiming phase when we have options
  const showClaimBtns =
    availableClaims !== null &&
    gameView.turnPhase === "claiming" &&
    (availableClaims.chow.length > 0 || availableClaims.pung !== null || availableClaims.openKong !== null);

  // Show closed kong button during discard phase
  const showClosedKongBtn =
    availableClaims !== null &&
    gameView.turnPhase === "discard" &&
    availableClaims.closedKong.length > 0;

  // Multiple chow options — need sub-selector
  const multipleChow = availableClaims && availableClaims.chow.length > 1;

  return (
    <div className="w-full max-w-5xl mx-auto mt-2 px-2 select-none" style={{ minHeight: "85vh" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-400">
          Room <span className="text-emerald-400 tracking-widest font-mono">{room.code}</span>
          <span className="mx-2">·</span>
          Round: {WIND_CN[gameView.roundWind]}
          <span className="mx-2">·</span>
          {isMyTurn ? (
            <span className="text-yellow-400 font-medium">Your turn</span>
          ) : gameView.turnPhase === "claiming" ? (
            <span className="text-cyan-400 font-medium">Claim window</span>
          ) : (
            <span className="text-gray-500">{WIND_CN[windForSeat(gameView.currentTurn)]}'s turn</span>
          )}
        </div>
        <button
          onClick={onLeave}
          className="px-3 py-1 bg-red-900/50 hover:bg-red-800/50 rounded text-xs text-red-300"
        >
          Leave
        </button>
      </div>

      {/* 3D game canvas */}
      <div className="relative">
        <GameCanvas>
          <HandLayout />
          <TableOverlays />
        </GameCanvas>

        {/* Discard button — top-right over hand tiles */}
        {showDiscardBtn && (
          <button
            onClick={handleDiscard}
            className="absolute bottom-24 right-34 px-5 py-1.5 bg-red-700/50 hover:bg-red-600/60 rounded-lg font-medium text-white/90 shadow-lg transition-colors text-sm"
          >
            Discard
          </button>
        )}

        {/* Closed kong button — shown alongside discard during own turn */}
        {showClosedKongBtn && (
          <button
            onClick={handleClosedKong}
            className="absolute bottom-24 right-52 px-4 py-1.5 bg-amber-700/50 hover:bg-amber-600/60 rounded-lg font-medium text-white/90 shadow-lg transition-colors text-sm"
          >
            Kong
          </button>
        )}

        {/* Claim buttons — shown during claiming phase */}
        {showClaimBtns && (
          <div className="absolute bottom-24 right-34 flex gap-2">
            {availableClaims!.chow.length > 0 && (
              <button
                onClick={handleChow}
                disabled={!!multipleChow && selectedChowOption === null}
                className={`px-4 py-1.5 rounded-lg font-medium shadow-lg transition-colors text-sm ${
                  multipleChow && selectedChowOption === null
                    ? "bg-gray-600/50 text-gray-400 cursor-not-allowed"
                    : "bg-cyan-700/50 hover:bg-cyan-600/60 text-white/90"
                }`}
              >
                Chow
              </button>
            )}
            {availableClaims!.pung !== null && (
              <button
                onClick={handlePung}
                className="px-4 py-1.5 bg-green-700/50 hover:bg-green-600/60 rounded-lg font-medium text-white/90 shadow-lg transition-colors text-sm"
              >
                Pung
              </button>
            )}
            {availableClaims!.openKong !== null && (
              <button
                onClick={handleOpenKong}
                className="px-4 py-1.5 bg-amber-700/50 hover:bg-amber-600/60 rounded-lg font-medium text-white/90 shadow-lg transition-colors text-sm"
              >
                Kong
              </button>
            )}
            <button
              onClick={handlePass}
              className="px-4 py-1.5 bg-gray-700/50 hover:bg-gray-600/60 rounded-lg font-medium text-white/90 shadow-lg transition-colors text-sm"
            >
              Pass
            </button>
          </div>
        )}

        {/* Chow sub-selector — pick which combination when multiple exist */}
        {showClaimBtns && multipleChow && (
          <div className="absolute bottom-36 right-34 flex gap-1 bg-black/60 rounded-lg p-2">
            <span className="text-xs text-gray-400 mr-1 self-center">Pick combo:</span>
            {availableClaims!.chow.map((_opt, i) => (
              <button
                key={i}
                onClick={() => selectChowOptionFn(selectedChowOption === i ? null : i)}
                className={`px-2 py-1 rounded text-xs ${
                  selectedChowOption === i
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                #{i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { room, socket, connect, joinRoom, leaveRoom, error, displaced } = useRoomStore();
  const { gameView } = useGameStore();

  useEffect(() => {
    if (token && user) connect(token, user.id);
  }, [token, user, connect]);

  useEffect(() => {
    if (roomCode && token && !room) {
      joinRoom(roomCode);
    }
  }, [roomCode, token, room, joinRoom]);

  const handleLeave = () => {
    leaveRoom();
    useGameStore.getState().reset();
    navigate("/");
  };

  const handleStartGame = async () => {
    if (!socket) return;
    await useGameStore.getState().startGame(socket);
  };

  if (displaced) {
    return (
      <div className="text-center mt-16">
        <p className="text-yellow-400 mb-4">Session opened in another tab. This tab is no longer active.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-emerald-400 hover:underline"
        >
          Reconnect here
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="text-center mt-16">
        {error ? (
          <div>
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={() => navigate("/")} className="text-emerald-400 hover:underline">
              Back to Home
            </button>
          </div>
        ) : (
          <p className="text-gray-400">Joining room...</p>
        )}
      </div>
    );
  }

  // Show 3D game board when game is in progress
  if (gameView) {
    return <GameView gameView={gameView} room={room} user={user} onLeave={handleLeave} />;
  }

  const isHost = user?.id === room.hostId;
  const isFull = room.players.length === MAX_PLAYERS;
  const canStart = isHost && isFull && room.status === "waiting";
  const seats = Array.from({ length: MAX_PLAYERS }, (_, i) =>
    room.players.find((p) => p.seatIndex === i),
  );

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">
            Room <span className="text-emerald-400 tracking-widest">{room.code}</span>
          </h1>
          <p className="text-sm text-gray-400">
            {room.players.length}/{MAX_PLAYERS} players
          </p>
        </div>
        <div className="flex gap-2">
          <CopyLinkButton roomCode={room.code} />
          <button
            onClick={handleLeave}
            className="px-4 py-2 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-red-300"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {seats.map((player, i) => (
          <PlayerSlot
            key={i}
            player={player}
            seatIndex={i}
            isHost={player?.userId === room.hostId}
            isSelf={player?.userId === user?.id}
          />
        ))}
      </div>

      <button
        disabled={!canStart}
        onClick={handleStartGame}
        className={
          canStart
            ? "w-full py-3 bg-emerald-700 hover:bg-emerald-600 rounded font-medium text-white"
            : "w-full py-3 bg-gray-700 rounded font-medium text-gray-500 cursor-not-allowed"
        }
        title={
          !isHost
            ? "Only the host can start the game"
            : !isFull
              ? "Need 4 players to start"
              : undefined
        }
      >
        Start Game
      </button>
    </div>
  );
}
