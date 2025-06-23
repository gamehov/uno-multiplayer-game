'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Users, Copy, Check, Crown } from 'lucide-react';
import { GameRoom } from '@/types/game';

interface GameLobbyProps {
  gameRoom: GameRoom;
  playerId: string;
  onStartGame: () => void;
  onBackToHome: () => void;
}

export default function GameLobby({ gameRoom, playerId, onStartGame, onBackToHome }: GameLobbyProps) {
  const [copied, setCopied] = useState(false);
  const isHost = gameRoom.players[0]?.id === playerId;
  // Host can start with just themselves for testing, or with 2+ players where non-host players are ready
  const canStart = gameRoom.players.length >= 1 && (
    gameRoom.players.length === 1 || // Solo play for testing
    gameRoom.players.filter(p => p.id !== playerId).every(p => p.isReady) // All non-host players are ready
  );

  const handleCopyRoomCode = async () => {
    try {
      const roomUrl = `${window.location.origin}?room=${gameRoom.id}`;
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy room code:', err);
    }
  };

  const handleToggleReady = () => {
    // In a real app, this would send a socket event
    console.log('Toggle ready status');
  };

  const playerColors = ['bg-uno-red', 'bg-uno-blue', 'bg-uno-green', 'bg-uno-yellow'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg via-slate-900 to-slate-800 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <h1 className="text-2xl font-bold text-white">Game Lobby</h1>
          
          <div className="w-16" /> {/* Spacer */}
        </motion.div>

        {/* Room Info */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card-bg rounded-2xl p-6 mb-6 border border-slate-600"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">{gameRoom.name}</h2>
              <p className="text-slate-400">Room ID: {gameRoom.id}</p>
            </div>
            <button
              onClick={handleCopyRoomCode}
              className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-300" />
                  <span className="text-slate-300">Share</span>
                </>
              )}
            </button>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-slate-400">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{gameRoom.players.length}/{gameRoom.maxPlayers} players</span>
            </div>
          </div>
        </motion.div>

        {/* Players List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card-bg rounded-2xl p-6 mb-6 border border-slate-600"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Players</h3>
          
          <div className="space-y-3">
            {gameRoom.players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center justify-between p-3 bg-slate-700 rounded-xl"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${playerColors[index % playerColors.length]} rounded-full flex items-center justify-center text-white font-bold`}>
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">{player.name}</span>
                      {index === 0 && <Crown className="w-4 h-4 text-yellow-400" />}
                      {player.id === playerId && (
                        <span className="text-xs bg-blue-600 px-2 py-1 rounded-full">You</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {player.isReady ? (
                    <span className="text-green-400 text-sm font-medium">Ready</span>
                  ) : (
                    <span className="text-slate-400 text-sm">Not Ready</span>
                  )}
                </div>
              </motion.div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: gameRoom.maxPlayers - gameRoom.players.length }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="flex items-center justify-center p-3 bg-slate-800 rounded-xl border-2 border-dashed border-slate-600"
              >
                <span className="text-slate-500">Waiting for player...</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {!isHost && (
            <button
              onClick={handleToggleReady}
              className="w-full bg-gradient-to-r from-uno-green to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200"
            >
              Ready to Play
            </button>
          )}
          
          {isHost && (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className="w-full bg-gradient-to-r from-uno-red to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              <span>
                {gameRoom.players.length === 1 ? 'Start Solo Game' : 'Start Game'}
              </span>
            </button>
          )}

          {isHost && !canStart && gameRoom.players.length > 1 && (
            <p className="text-center text-slate-400 text-sm">
              Waiting for all players to be ready...
            </p>
          )}
        </motion.div>

        {/* Game Rules */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 bg-card-bg rounded-2xl p-6 border border-slate-600"
        >
          <h3 className="text-lg font-semibold text-white mb-3">Quick Rules</h3>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Match the color or number of the top card</li>
            <li>• Use action cards to skip, reverse, or make opponents draw</li>
            <li>• Say "UNO" when you have one card left</li>
            <li>• First player to empty their hand wins!</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
