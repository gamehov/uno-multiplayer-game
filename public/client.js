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
            this.updateGameDisplay();
            
            if (data.winner) {
                this.showNotification(`🎉 ${data.winner.name} wins!`);
            }
        });
        
        this.socket.on('cardDrawn', (data) => {
            this.gameState = data.gameState;
            this.updateGameDisplay();
        });
        
        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
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
            topCardEl.className = `card ${this.gameState.currentColor}`;
            topCardEl.textContent = this.getCardDisplay(this.gameState.topCard);
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
            playerEl.className = `text-center ${player.isCurrentPlayer ? 'text-green-400' : 'text-white'}`;
            playerEl.innerHTML = `
                <div class="font-medium">${player.name}</div>
                <div class="text-sm text-slate-400">${player.handSize} cards</div>
                ${player.isCurrentPlayer ? '<div class="text-xs text-green-400">▶ Current</div>' : ''}
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
            cardEl.className = `card ${card.color}`;
            cardEl.textContent = this.getCardDisplay(card);
            
            if (this.gameState.isYourTurn && this.canPlayCard(card)) {
                cardEl.classList.add('playable');
            }
            
            if (this.gameState.isYourTurn) {
                cardEl.addEventListener('click', () => this.playCard(index));
            }
            
            handEl.appendChild(cardEl);
        });
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
        if (card.type === 'number') return card.value;
        if (card.type === 'skip') return '⊘';
        if (card.type === 'reverse') return '↻';
        if (card.type === 'draw2') return '+2';
        if (card.type === 'wild') return 'W';
        if (card.type === 'wild4') return '+4';
        return '?';
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
