// Multiplayer UNO Game Server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game state
const games = new Map();
const players = new Map();

class UnoGame {
    constructor(gameId) {
        this.id = gameId;
        this.players = [];
        this.deck = [];
        this.discardPile = [];
        this.currentPlayerIndex = 0;
        this.direction = 1; // 1 for clockwise, -1 for counterclockwise
        this.currentColor = null;
        this.gameStarted = false;
        this.maxPlayers = 4;
        
        this.createDeck();
        this.shuffleDeck();
    }
    
    createDeck() {
        const colors = ['red', 'blue', 'green', 'yellow'];
        const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const actions = ['skip', 'reverse', 'draw2'];
        
        this.deck = [];
        
        // Number cards
        colors.forEach(color => {
            // One 0 per color
            this.deck.push({ color, type: 'number', value: 0 });
            
            // Two of each 1-9 per color
            for (let num = 1; num <= 9; num++) {
                this.deck.push({ color, type: 'number', value: num });
                this.deck.push({ color, type: 'number', value: num });
            }
            
            // Action cards (2 of each per color)
            actions.forEach(action => {
                this.deck.push({ color, type: action });
                this.deck.push({ color, type: action });
            });
        });
        
        // Wild cards (4 of each)
        for (let i = 0; i < 4; i++) {
            this.deck.push({ color: 'black', type: 'wild' });
            this.deck.push({ color: 'black', type: 'wild4' });
        }
    }
    
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    
    addPlayer(playerId, playerName, socketId) {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }
        
        const player = {
            id: playerId,
            name: playerName,
            socketId: socketId,
            hand: [],
            isReady: false,
            calledUno: false
        };
        
        this.players.push(player);
        return true;
    }
    
    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (this.players.length === 0) {
            games.delete(this.id);
        }
    }
    
    startGame() {
        if (this.players.length < 1) return false; // Allow solo play for testing

        // Shuffle deck before dealing
        this.shuffleDeck();

        // Deal 7 cards to each player
        this.players.forEach((player, playerIndex) => {
            player.hand = [];
            for (let i = 0; i < 7; i++) {
                if (this.deck.length > 0) {
                    player.hand.push(this.deck.pop());
                }
            }
            // Reset UNO calling status
            player.calledUno = false;
            console.log(`Player ${player.name} dealt ${player.hand.length} cards`);
        });
        
        // Find a number card for starting
        let startCard;
        do {
            startCard = this.deck.pop();
        } while (startCard.type !== 'number');
        
        this.discardPile.push(startCard);
        this.currentColor = startCard.color;
        this.gameStarted = true;
        this.currentPlayerIndex = 0;
        
        return true;
    }
    
    canPlayCard(card) {
        if (card.type === 'wild' || card.type === 'wild4') return true;
        
        const topCard = this.discardPile[this.discardPile.length - 1];
        
        if (card.color === this.currentColor) return true;
        if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
        if (card.type === topCard.type && card.type !== 'number') return true;
        
        return false;
    }
    
    playCard(playerId, cardIndex, chosenColor = null) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || this.players[this.currentPlayerIndex].id !== playerId) {
            return { success: false, error: 'Not your turn' };
        }
        
        const card = player.hand[cardIndex];
        if (!card || !this.canPlayCard(card)) {
            return { success: false, error: 'Cannot play this card' };
        }
        
        // Remove card from player's hand
        player.hand.splice(cardIndex, 1);
        this.discardPile.push(card);
        
        // Handle special cards
        let nextPlayerSkipped = false;
        let cardsDrawn = 0;
        
        if (card.type === 'wild' || card.type === 'wild4') {
            this.currentColor = chosenColor || 'red';
            if (card.type === 'wild4') {
                cardsDrawn = 4;
            }
        } else {
            this.currentColor = card.color;
            
            if (card.type === 'skip') {
                nextPlayerSkipped = true;
            } else if (card.type === 'reverse') {
                this.direction *= -1;
            } else if (card.type === 'draw2') {
                cardsDrawn = 2;
            }
        }
        
        // Move to next player
        this.nextPlayer();
        
        // Handle drawing cards for next player
        if (cardsDrawn > 0) {
            const nextPlayer = this.players[this.currentPlayerIndex];
            for (let i = 0; i < cardsDrawn; i++) {
                if (this.deck.length > 0) {
                    nextPlayer.hand.push(this.deck.pop());
                }
            }
            nextPlayerSkipped = true;
        }
        
        // Skip next player if needed
        if (nextPlayerSkipped) {
            this.nextPlayer();
        }
        
        // Check for winner
        const winner = player.hand.length === 0 ? player : null;
        
        return {
            success: true,
            card,
            winner,
            nextPlayer: this.players[this.currentPlayerIndex],
            cardsDrawn
        };
    }
    
    drawCard(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || this.players[this.currentPlayerIndex].id !== playerId) {
            return { success: false, error: 'Not your turn' };
        }
        
        if (this.deck.length === 0) {
            return { success: false, error: 'Deck is empty' };
        }
        
        const drawnCard = this.deck.pop();
        player.hand.push(drawnCard);
        
        // Move to next player
        this.nextPlayer();
        
        return {
            success: true,
            card: drawnCard,
            nextPlayer: this.players[this.currentPlayerIndex]
        };
    }
    
    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
    }
    
    getGameState(playerId) {
        const player = this.players.find(p => p.id === playerId);
        const topCard = this.discardPile[this.discardPile.length - 1];
        
        return {
            gameId: this.id,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                handSize: p.hand.length,
                isCurrentPlayer: this.players[this.currentPlayerIndex].id === p.id
            })),
            playerHand: player ? player.hand : [],
            topCard,
            currentColor: this.currentColor,
            deckSize: this.deck.length,
            gameStarted: this.gameStarted,
            isYourTurn: player && this.players[this.currentPlayerIndex].id === playerId
        };
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    socket.on('createGame', (data) => {
        const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const game = new UnoGame(gameId);
        games.set(gameId, game);
        
        const playerId = socket.id;
        players.set(playerId, { gameId, socketId: socket.id });
        
        game.addPlayer(playerId, data.playerName, socket.id);
        socket.join(gameId);
        
        socket.emit('gameCreated', {
            gameId,
            gameState: game.getGameState(playerId)
        });
        
        // Send updated lobby state to all players
        game.players.forEach(player => {
            io.to(player.socketId).emit('playerJoined', {
                playerName: data.playerName,
                gameState: game.getGameState(player.id)
            });
        });
    });
    
    socket.on('joinGame', (data) => {
        const game = games.get(data.gameId);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        
        const playerId = socket.id;
        const success = game.addPlayer(playerId, data.playerName, socket.id);
        
        if (!success) {
            socket.emit('error', { message: 'Game is full' });
            return;
        }
        
        players.set(playerId, { gameId: data.gameId, socketId: socket.id });
        socket.join(data.gameId);
        
        socket.emit('gameJoined', {
            gameId: data.gameId,
            gameState: game.getGameState(playerId)
        });
        
        // Send updated lobby state to all players
        game.players.forEach(player => {
            io.to(player.socketId).emit('playerJoined', {
                playerName: data.playerName,
                gameState: game.getGameState(player.id)
            });
        });
    });
    
    socket.on('startGame', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const game = games.get(playerData.gameId);
        if (!game) return;
        
        const success = game.startGame();
        if (success) {
            // Send personalized game state to each player
            game.players.forEach(player => {
                io.to(player.socketId).emit('gameStarted', {
                    gameState: game.getGameState(player.id)
                });
            });
        }
    });
    
    socket.on('playCard', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const game = games.get(playerData.gameId);
        if (!game) return;
        
        const result = game.playCard(socket.id, data.cardIndex, data.chosenColor);
        
        if (result.success) {
            // Send personalized game state to each player
            game.players.forEach(player => {
                io.to(player.socketId).emit('cardPlayed', {
                    playerId: socket.id,
                    card: result.card,
                    winner: result.winner,
                    gameState: game.getGameState(player.id)
                });
            });
        } else {
            socket.emit('error', { message: result.error });
        }
    });
    
    socket.on('drawCard', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const game = games.get(playerData.gameId);
        if (!game) return;
        
        const result = game.drawCard(socket.id);
        
        if (result.success) {
            // Send personalized game state to each player
            game.players.forEach(player => {
                io.to(player.socketId).emit('cardDrawn', {
                    playerId: socket.id,
                    gameState: game.getGameState(player.id)
                });
            });
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    socket.on('callUno', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (!game) return;

        const player = game.players.find(p => p.id === socket.id);
        if (player) {
            player.calledUno = true;

            // Send personalized notifications to all players
            game.players.forEach(p => {
                io.to(p.socketId).emit('unoCall', {
                    playerName: player.name,
                    gameState: game.getGameState(p.id)
                });
            });
        }
    });

    socket.on('callOutUno', () => {
        const playerData = players.get(socket.id);
        if (!playerData) return;

        const game = games.get(playerData.gameId);
        if (!game) return;

        // Find player with 1 card who hasn't called UNO
        const targetPlayer = game.players.find(p => p.hand.length === 1 && !p.calledUno);

        if (targetPlayer) {
            // Make target player draw 2 cards
            for (let i = 0; i < 2; i++) {
                if (game.deck.length === 0) {
                    game.shuffleDiscardIntoDeck();
                }
                if (game.deck.length > 0) {
                    targetPlayer.hand.push(game.deck.pop());
                }
            }

            const callerPlayer = game.players.find(p => p.id === socket.id);

            // Send personalized notifications to all players
            game.players.forEach(p => {
                io.to(p.socketId).emit('unoCallOut', {
                    callerName: callerPlayer.name,
                    targetName: targetPlayer.name,
                    gameState: game.getGameState(p.id)
                });
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        const playerData = players.get(socket.id);
        if (playerData) {
            const game = games.get(playerData.gameId);
            if (game) {
                game.removePlayer(socket.id);
                io.to(playerData.gameId).emit('playerLeft', {
                    playerId: socket.id,
                    gameState: game.players.length > 0 ? game.getGameState(game.players[0].id) : null
                });
            }
            players.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`UNO Multiplayer Server running on port ${PORT}`);
});
