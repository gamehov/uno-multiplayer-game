'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Users, Plus, Share2 } from 'lucide-react';
import GameLobby from '@/components/GameLobby';
import GameBoard from '@/components/GameBoard';
import { GameRoom, Player } from '@/types/game';

export default function Home() {
  const [currentView, setCurrentView] = useState<'home' | 'lobby' | 'game'>('home');
  const [playerName, setPlayerName] = useState('');
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [playerId, setPlayerId] = useState('');

  useEffect(() => {
    // Generate unique player ID
    setPlayerId(`player-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
    
    const newRoom: GameRoom = {
      id: `room-${Math.random().toString(36).substr(2, 9)}`,
      name: `${playerName}'s Game`,
      players: [{
        id: playerId,
        name: playerName,
        cards: [],
        isReady: true, // Host is ready by default
      }],
      maxPlayers: 4,
      isPrivate: false,
      createdAt: new Date(),
    };
    
    setGameRoom(newRoom);
    setCurrentView('lobby');
  };

  const handleJoinRoom = (roomId: string) => {
    // In a real app, this would connect to an existing room
    // For now, create a demo room
    const newRoom: GameRoom = {
      id: roomId,
      name: 'Demo Game',
      players: [
        {
          id: playerId,
          name: playerName,
          cards: [],
          isReady: false,
        },
        {
          id: 'bot-1',
          name: 'Player 2',
          cards: [],
          isReady: true,
        }
      ],
      maxPlayers: 4,
      isPrivate: false,
      createdAt: new Date(),
    };
    
    setGameRoom(newRoom);
    setCurrentView('lobby');
  };

  const handleStartGame = () => {
    setCurrentView('game');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setGameRoom(null);
  };

  if (currentView === 'game' && gameRoom) {
    return (
      <GameBoard 
        gameRoom={gameRoom} 
        playerId={playerId}
        onBackToLobby={() => setCurrentView('lobby')}
      />
    );
  }

  if (currentView === 'lobby' && gameRoom) {
    return (
      <GameLobby 
        gameRoom={gameRoom}
        playerId={playerId}
        onStartGame={handleStartGame}
        onBackToHome={handleBackToHome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-bg via-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md space-y-8"
      >
        {/* Logo */}
        <motion.div 
          className="text-center"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1 className="text-6xl font-bold bg-gradient-to-r from-uno-red via-uno-yellow to-uno-blue bg-clip-text text-transparent mb-2">
            UNO
          </h1>
          <p className="text-slate-400 text-lg">Play with friends online</p>
        </motion.div>

        {/* Player Name Input */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="space-y-4"
        >
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 bg-card-bg border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            maxLength={20}
          />
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="space-y-4"
        >
          <button
            onClick={handleCreateRoom}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-uno-red to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            <span>Create Game</span>
          </button>

          <button
            onClick={() => handleJoinRoom('demo-room')}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-uno-blue to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:cursor-not-allowed"
          >
            <Users className="w-5 h-5" />
            <span>Join Demo Game</span>
          </button>
        </motion.div>

        {/* Share Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center"
        >
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'UNO Game',
                  text: 'Play UNO online with friends!',
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
              }
            }}
            className="inline-flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Game</span>
          </button>
        </motion.div>
      </motion.div>

      {/* Floating Cards Animation */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-16 h-24 bg-gradient-to-br from-uno-red to-uno-blue rounded-lg opacity-10"
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 100,
              rotate: Math.random() * 360
            }}
            animate={{
              y: -100,
              rotate: Math.random() * 360 + 360,
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>
    </div>
  );
}
