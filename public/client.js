// UNO Multiplayer Client
class UnoMultiplayerClient {
    constructor() {
        this.socket = io();
        this.gameState = null;
        this.playerName = '';
        this.gameId = '';
        this.pendingWildCard = null;
        
        this.initializeEventListeners();
        this.setupSocketListeners();
        this.createFloatingCards();
    }
    
    initializeEventListeners() {
        // Home screen elements
        const playerNameInput = document.getElementById('playerName');
        const createGameBtn = document.getElementById('createGameBtn');
        const joinGameBtn = document.getElementById('joinGameBtn');
        const gameIdInput = document.getElementById('gameIdInput');
        
        // Enable buttons when name is entered
        playerNameInput.addEventListener('input', (e) => {
            const hasName = e.target.value.trim().length > 0;
            createGameBtn.disabled = !hasName;
            this.updateJoinButton();
        });
        
        gameIdInput.addEventListener('input', () => {
            this.updateJoinButton();
        });
        
        // Game creation and joining
        createGameBtn.addEventListener('click', () => this.createGame());
        joinGameBtn.addEventListener('click', () => this.joinGame());
        
        // Lobby elements
        document.getElementById('copyGameId').addEventListener('click', () => this.copyGameId());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('leaveLobbyBtn').addEventListener('click', () => this.leaveLobby());
        
        // Game elements
        document.getElementById('backToLobbyBtn').addEventListener('click', () => this.leaveLobby());
        document.getElementById('drawPile').addEventListener('click', () => this.drawCard());

        // UNO functionality
        document.getElementById('unoButton').addEventListener('click', () => this.callUno());
        document.getElementById('callOutButton').addEventListener('click', () => this.callOutUno());
        document.getElementById('newRoundBtn').addEventListener('click', () => this.startNewRound());

        // Color picker
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                this.selectColor(color);
            });
        });
        
        // Enter key support
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !createGameBtn.disabled) {
                createGameBtn.click();
            }
        });
        
        gameIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !joinGameBtn.disabled) {
                joinGameBtn.click();
            }
        });
    }
    
    setupSocketListeners() {
        this.socket.on('gameCreated', (data) => {
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            this.showLobby();
        });
        
        this.socket.on('gameJoined', (data) => {
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            this.showLobby();
        });
        
        this.socket.on('playerJoined', (data) => {
            this.gameState = data.gameState;
            this.updateLobby();
            this.showNotification(`${data.playerName} joined the game!`);
        });
        
        this.socket.on('playerLeft', (data) => {
            if (data.gameState) {
                this.gameState = data.gameState;
                this.updateLobby();
            }
            this.showNotification('A player left the game');
        });
        
        this.socket.on('gameStarted', (data) => {
            this.gameState = data.gameState;
            this.showGame();
        });
        
        this.socket.on('cardPlayed', (data) => {
            this.gameState = data.gameState;

            // Track last played card for display
            this.lastPlayedCard = {
                playerId: data.playerId,
                card: data.card
            };

            // Show notification about the played card
            const player = this.gameState.players.find(p => p.id === data.playerId);
            if (player && data.playerId !== this.socket.id) {
                this.showNotification(`${player.name} played ${this.getCardDisplayText(data.card)}`);
            }

            this.updateGameDisplay();

            if (data.roundResult) {
                this.showRoundEnd(data.roundResult);
            }
        });
        
        this.socket.on('cardDrawn', (data) => {
            this.gameState = data.gameState;
            this.updateGameDisplay();

            // Show notification about drawn card
            if (data.playerId === this.socket.id) {
                if (data.gameState.canPlayDrawnCard) {
                    this.showNotification('✅ You drew a playable card! You can play it now.');
                } else {
                    this.showNotification('📤 Card drawn. Turn passed to next player.');
                }
            }
        });
        
        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });

        this.socket.on('unoCall', (data) => {
            this.gameState = data.gameState;
            this.updateGameDisplay();
            this.showNotification(`🎯 ${data.playerName} called UNO!`);
        });

        this.socket.on('unoCallOut', (data) => {
            this.gameState = data.gameState;
            this.updateGameDisplay();
            this.showNotification(`📢 ${data.callerName} called out ${data.targetName} for not saying UNO! ${data.targetName} draws 2 cards.`);
        });
    }
    
    updateJoinButton() {
        const hasName = document.getElementById('playerName').value.trim().length > 0;
        const hasGameId = document.getElementById('gameIdInput').value.trim().length > 0;
        document.getElementById('joinGameBtn').disabled = !hasName || !hasGameId;
    }
    
    createGame() {
        this.playerName = document.getElementById('playerName').value.trim();
        if (this.playerName) {
            this.socket.emit('createGame', { playerName: this.playerName });
        }
    }
    
    joinGame() {
        this.playerName = document.getElementById('playerName').value.trim();
        const gameId = document.getElementById('gameIdInput').value.trim().toUpperCase();
        
        if (this.playerName && gameId) {
            this.socket.emit('joinGame', { 
                playerName: this.playerName, 
                gameId: gameId 
            });
        }
    }
    
    startGame() {
        this.socket.emit('startGame');
    }
    
    leaveLobby() {
        this.showHome();
        // Disconnect and reconnect to leave the game
        this.socket.disconnect();
        this.socket.connect();
    }
    
    copyGameId() {
        navigator.clipboard.writeText(this.gameId).then(() => {
            this.showNotification('Game ID copied to clipboard!');
        });
    }
    
    playCard(cardIndex) {
        const card = this.gameState.playerHand[cardIndex];
        
        if (card.type === 'wild' || card.type === 'wild4') {
            this.pendingWildCard = cardIndex;
            this.showColorPicker();
        } else {
            this.socket.emit('playCard', { cardIndex });
        }
    }
    
    selectColor(color) {
        this.hideColorPicker();
        
        if (this.pendingWildCard !== null) {
            this.socket.emit('playCard', { 
                cardIndex: this.pendingWildCard, 
                chosenColor: color 
            });
            this.pendingWildCard = null;
        }
    }
    
    drawCard() {
        if (this.gameState && this.gameState.isYourTurn) {
            this.socket.emit('drawCard');
        }
    }
    
    showHome() {
        document.getElementById('homeScreen').classList.remove('hidden');
        document.getElementById('lobbyScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.add('hidden');
    }
    
    showLobby() {
        document.getElementById('homeScreen').classList.add('hidden');
        document.getElementById('lobbyScreen').classList.remove('hidden');
        document.getElementById('gameScreen').classList.add('hidden');
        
        document.getElementById('gameIdDisplay').textContent = this.gameId;
        this.updateLobby();
    }
    
    showGame() {
        document.getElementById('homeScreen').classList.add('hidden');
        document.getElementById('lobbyScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        
        document.getElementById('gameIdInGame').querySelector('.text-white').textContent = this.gameId;
        this.updateGameDisplay();
    }
    
    updateLobby() {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        this.gameState.players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'flex items-center justify-between bg-slate-700 rounded-lg p-3';
            playerEl.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        ${player.name.charAt(0).toUpperCase()}
                    </div>
                    <span class="text-white font-medium">${player.name}</span>
                </div>
                <div class="text-slate-400 text-sm">
                    ${player.isCurrentPlayer ? '👑 Host' : 'Player'}
                </div>
            `;
            playersList.appendChild(playerEl);
        });
        
        // Show start button for host (allow solo play for testing)
        const startBtn = document.getElementById('startGameBtn');
        const isHost = this.gameState.players.length > 0 && this.gameState.players[0].id === this.socket.id;
        startBtn.style.display = isHost ? 'block' : 'none';

        // Update button text based on player count
        if (this.gameState.players.length === 1) {
            startBtn.textContent = '🚀 Start Solo Game';
        } else {
            startBtn.textContent = '🚀 Start Game';
        }
    }
    
    updateGameDisplay() {
        if (!this.gameState) return;
        
        // Update top card
        const topCardEl = document.getElementById('topCard');
        if (this.gameState.topCard) {
            let cardClass = `card ${this.gameState.currentColor}`;
            if (this.gameState.currentColor === 'black') {
                cardClass += ' wild-card';
            }
            topCardEl.className = cardClass;

            const cardDisplay = this.getCardDisplay(this.gameState.topCard);
            topCardEl.innerHTML = `
                <div class="card-number">${cardDisplay.number}</div>
                <div class="card-symbol">${cardDisplay.symbol}</div>
            `;
        }
        
        // Update deck count
        document.getElementById('deckCount').textContent = `Cards left: ${this.gameState.deckSize}`;
        
        // Update game message
        const messageEl = document.getElementById('gameMessage');
        if (this.gameState.isYourTurn) {
            messageEl.textContent = "Your turn!";
            messageEl.className = "text-green-400 font-semibold";
        } else {
            const currentPlayer = this.gameState.players.find(p => p.isCurrentPlayer);
            messageEl.textContent = `${currentPlayer ? currentPlayer.name : 'Someone'}'s turn`;
            messageEl.className = "text-white font-semibold";
        }
        
        // Update players info
        this.updatePlayersInfo();
        
        // Update player hand
        this.renderPlayerHand();
    }
    
    updatePlayersInfo() {
        const playersInfoEl = document.getElementById('playersInfo');
        playersInfoEl.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'flex justify-center gap-4 flex-wrap';

        this.gameState.players.forEach(player => {
            const playerEl = document.createElement('div');
            const isCurrentPlayer = player.isCurrentPlayer;
            const isYou = player.id === this.socket.id;

            playerEl.className = `text-center p-3 rounded-lg border-2 transition-all ${
                isCurrentPlayer ? 'border-green-400 bg-green-900/20 text-green-400' :
                'border-slate-600 bg-slate-800 text-white'
            }`;

            // Show UNO status
            const unoStatus = player.handSize === 1 ?
                (player.calledUno ? '🎯 UNO!' : '⚠️ Forgot UNO!') : '';

            playerEl.innerHTML = `
                <div class="font-bold text-lg">${player.name}${isYou ? ' (You)' : ''}</div>
                <div class="text-sm opacity-80">Score: ${player.score || 0}</div>
                <div class="flex items-center justify-center gap-2 mt-2">
                    <div class="text-lg font-bold">${player.handSize}</div>
                    <div class="text-sm">cards</div>
                </div>
                ${unoStatus ? `<div class="text-xs mt-1 font-bold">${unoStatus}</div>` : ''}
                ${isCurrentPlayer ? '<div class="text-xs mt-1 animate-pulse">▶ Playing...</div>' : ''}
                ${this.lastPlayedCard && this.lastPlayedCard.playerId === player.id ?
                    `<div class="text-xs mt-1 text-blue-400">Last played: ${this.getCardDisplayText(this.lastPlayedCard.card)}</div>` : ''}
            `;
            container.appendChild(playerEl);
        });

        playersInfoEl.appendChild(container);
    }
    
    renderPlayerHand() {
        const handEl = document.getElementById('playerHand');
        handEl.innerHTML = '';
        
        if (!this.gameState.playerHand) return;
        
        this.gameState.playerHand.forEach((card, index) => {
            const cardEl = document.createElement('div');
            let cardClass = `card ${card.color}`;

            // Add special styling for wild cards
            if (card.color === 'black') {
                cardClass += ' wild-card';
            }

            // Enhanced visibility for playable/non-playable cards
            if (this.gameState.isYourTurn) {
                if (this.canPlayCard(card)) {
                    cardClass += ' playable';
                } else {
                    cardClass += ' not-playable';
                }
            }

            cardEl.className = cardClass;

            // Create card content with proper UNO styling
            const cardDisplay = this.getCardDisplay(card);
            cardEl.innerHTML = `
                <div class="card-number">${cardDisplay.number}</div>
                <div class="card-symbol">${cardDisplay.symbol}</div>
            `;

            if (this.gameState.isYourTurn && this.canPlayCard(card)) {
                cardEl.addEventListener('click', () => this.playCard(index));
            }

            handEl.appendChild(cardEl);
        });

        // Handle UNO button visibility and warning
        this.updateUnoButton();
    }
    
    canPlayCard(card) {
        if (!this.gameState.topCard) return false;
        
        if (card.type === 'wild' || card.type === 'wild4') return true;
        if (card.color === this.gameState.currentColor) return true;
        if (card.type === 'number' && this.gameState.topCard.type === 'number' && card.value === this.gameState.topCard.value) return true;
        if (card.type === this.gameState.topCard.type && card.type !== 'number') return true;
        
        return false;
    }
    
    getCardDisplay(card) {
        const symbols = {
            'skip': '🚫',
            'reverse': '🔄',
            'draw2': '+2',
            'wild': '🌈',
            'wild4': '🌈+4'
        };

        if (card.type === 'number') {
            return {
                number: card.value,
                symbol: this.getColorSymbol(card.color)
            };
        }

        return {
            number: symbols[card.type] || '?',
            symbol: card.color === 'black' ? '✨' : this.getColorSymbol(card.color)
        };
    }

    getColorSymbol(color) {
        const colorSymbols = {
            'red': '♦',
            'blue': '♠',
            'green': '♣',
            'yellow': '♥',
            'black': '✨'
        };
        return colorSymbols[color] || '●';
    }

    getCardDisplayText(card) {
        const colorNames = {
            'red': 'Red',
            'blue': 'Blue',
            'green': 'Green',
            'yellow': 'Yellow',
            'black': 'Wild'
        };

        if (card.type === 'number') {
            return `${colorNames[card.color]} ${card.value}`;
        } else if (card.type === 'skip') {
            return `${colorNames[card.color]} Skip`;
        } else if (card.type === 'reverse') {
            return `${colorNames[card.color]} Reverse`;
        } else if (card.type === 'draw2') {
            return `${colorNames[card.color]} +2`;
        } else if (card.type === 'wild') {
            return 'Wild Card';
        } else if (card.type === 'wild4') {
            return 'Wild +4';
        }
        return 'Unknown Card';
    }
    
    showColorPicker() {
        document.getElementById('colorPicker').classList.remove('hidden');
    }
    
    hideColorPicker() {
        document.getElementById('colorPicker').classList.add('hidden');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        notificationText.textContent = message;
        notification.classList.remove('hidden');
        
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }
    
    updateUnoButton() {
        const unoButton = document.getElementById('unoButton');
        const unoWarning = document.getElementById('unoWarning');
        const unoCallOut = document.getElementById('unoCallOut');

        // Show UNO button when player has 2 cards (before playing down to 1)
        if (this.gameState && this.gameState.playerHand && this.gameState.playerHand.length === 2 && this.gameState.isYourTurn) {
            unoButton.classList.remove('hidden');
            unoWarning.classList.remove('hidden');
        } else {
            unoButton.classList.add('hidden');
            unoWarning.classList.add('hidden');
        }

        // Show call-out option if any player has 1 card and hasn't called UNO
        const hasPlayerWithOneCard = this.gameState && this.gameState.players &&
            this.gameState.players.some(player => player.handSize === 1 && !player.calledUno && player.id !== this.socket.id);

        if (hasPlayerWithOneCard) {
            unoCallOut.classList.remove('hidden');
        } else {
            unoCallOut.classList.add('hidden');
        }
    }

    callUno() {
        this.socket.emit('callUno');
        this.showNotification('🎯 UNO called!');
        document.getElementById('unoButton').classList.add('hidden');
        document.getElementById('unoWarning').classList.add('hidden');
    }

    callOutUno() {
        this.socket.emit('callOutUno');
        this.showNotification('📢 Called out player for not saying UNO!');
        document.getElementById('unoCallOut').classList.add('hidden');
    }

    showRoundEnd(roundResult) {
        const modal = document.getElementById('roundEndModal');
        const winnerEl = document.getElementById('roundWinner');
        const pointsEl = document.getElementById('roundPoints');
        const scoresEl = document.getElementById('scoresList');

        winnerEl.textContent = `${roundResult.winner.name} wins this round!`;
        pointsEl.textContent = `+${roundResult.points} points`;

        // Display scores
        scoresEl.innerHTML = '';
        roundResult.scores.forEach(score => {
            const scoreEl = document.createElement('div');
            scoreEl.className = 'flex justify-between text-white';
            scoreEl.innerHTML = `
                <span>${score.name}</span>
                <span class="font-bold">${score.score}</span>
            `;
            scoresEl.appendChild(scoreEl);
        });

        modal.classList.remove('hidden');
    }

    startNewRound() {
        document.getElementById('roundEndModal').classList.add('hidden');
        this.socket.emit('startGame');
        this.showNotification('🚀 Starting new round!');
    }

    createFloatingCards() {
        const container = document.getElementById('floatingCards');
        for (let i = 0; i < 6; i++) {
            const card = document.createElement('div');
            card.className = 'floating-card';
            card.style.left = Math.random() * 100 + '%';
            card.style.animationDelay = Math.random() * 5 + 's';
            card.style.animationDuration = (Math.random() * 10 + 10) + 's';
            container.appendChild(card);
        }
    }
}

// Initialize client when page loads
document.addEventListener('DOMContentLoaded', () => {
    new UnoMultiplayerClient();
});
