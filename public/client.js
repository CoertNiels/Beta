let ws;
let currentRoomId;
let username;

// Get or generate username
function getUsername() {
    let username = localStorage.getItem('username');
    if (!username) {
        username = `anony_${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem('username', username);
    }
    return username;
}

// Register user with server
function registerUser(username) {
    if (ws) {
        ws.send(JSON.stringify({
            type: 'register',
            username: username
        }));
    }
}

// Initialize WebSocket connection
function initWebSocket() {
    // Get WebSocket protocol based on current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const socket = new WebSocket(`${protocol}//${host}`);

    // Add error handling for WebSocket connection
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        alert('Failed to connect to WebSocket server. Please check your network connection.');
    };

    // Store the WebSocket instance
    ws = socket;


    
    ws.onopen = () => {
        console.log('WebSocket connected');
        username = getUsername();
        document.getElementById('username').textContent = username;
        registerUser(username);
        loadRooms();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'join':
                displayChatHistory(data.messages);
                break;
            case 'message':
                // Only add message if we're in the same room
                if (currentRoomId === data.room_id) {
                    addMessageToChat(data);
                }
                break;
            case 'error':
                // Show a single, user-friendly message
                if (data.details) {
                    alert(data.details);
                } else {
                    alert(data.error);
                }
                break;
            case 'clear-cache':
                if (data.success) {
                    alert('Cache cleared successfully!');
                    // Refresh page to start fresh
                    location.reload();
                }
                break;
            case 'register':
                if (data.success) {
                    document.getElementById('username').textContent = username;
                }
                break;
            case 'room-list':
                // Update room list with complete list
                const roomsContainer = document.getElementById('rooms');
                roomsContainer.innerHTML = '';
                data.rooms.forEach(room => {
                    const roomDiv = document.createElement('div');
                    roomDiv.className = 'room-item';
                    roomDiv.onclick = () => joinRoom(room.id);
                    roomDiv.textContent = room.name;
                    roomsContainer.appendChild(roomDiv);
                });
                break;
            case 'user-cleared':
                // Remove all messages from this user
                const chatWindow = document.getElementById('chat-window');
                const messages = chatWindow.querySelectorAll('.message');
                messages.forEach(message => {
                    if (message.dataset.username === data.username) {
                        message.remove();
                    }
                });
                break;
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        ws = null;
        alert('Connection lost. Please refresh the page to reconnect.');
    };
}

// Load rooms from server
async function loadRooms() {
    try {
        const response = await fetch('/rooms');
        if (!response.ok) {
            const error = await response.json();
            alert(error.details || 'Failed to load room list');
            return;
        }
        const rooms = await response.json();
        displayRooms(rooms);
    } catch (error) {
        alert('Failed to load room list. Please try again later.');
        console.error('Error loading rooms:', error);
    }
}

// Display list of rooms
function displayRooms(rooms) {
    const roomsDiv = document.getElementById('rooms');
    roomsDiv.innerHTML = rooms.map(room => 
        `<div class="room-item" onclick="joinRoom(${room.id})">${room.name}</div>`
    ).join('');
}

// Join a room
function joinRoom(roomId) {
    if (ws) {
        ws.send(JSON.stringify({
            type: 'join',
            roomId: roomId
        }));
        currentRoomId = roomId;
        document.getElementById('chat-window-container').style.display = 'block';
    }
}

// Create a new room
async function createRoom() {
    const roomName = document.getElementById('new-room-name').value.trim();
    if (!roomName) return;

    // Check if we have a WebSocket connection and username
    if (!ws || !username) {
        alert('Not connected to server');
        return;
    }

    try {
        const response = await fetch('/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: roomName, username: username })
        });

        if (!response.ok) {
            const error = await response.json();
            if (error.error === 'Access denied') {
                alert(error.details || 'You do not have permission to create rooms');
            } else if (error.error === 'Room already exists') {
                alert(error.details || 'A room with this name already exists');
            } else {
                alert(error.details || 'Failed to create room. Please try again later.');
            }
            return;
        }

        // Clear input field after successful creation
        document.getElementById('new-room-name').value = '';
    } catch (error) {
        alert('Failed to create room. Please try again later.');
        console.error('Error creating room:', error);
    }
}

// Send a message
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (!message || !currentRoomId) return;

    if (ws) {
        ws.send(JSON.stringify({
            type: 'message',
            roomId: currentRoomId,
            message: message,
            username: username
        }));
        messageInput.value = '';
    }
}

// Display chat history
function displayChatHistory(messages) {
    const chatWindow = document.getElementById('chat-window');
    // Sort messages by timestamp in ascending order
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    chatWindow.innerHTML = messages.map(msg => `
        <div class="message">
            <span class="username">${msg.username}</span>: ${msg.message}
            <span style="color: #666; font-size: 0.8em;">
                ${new Date(msg.timestamp).toLocaleTimeString()}
            </span>
        </div>
    `).join('');
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Add message to chat
function addMessageToChat(data) {
    // Only add message if we're in the same room
    if (currentRoomId !== data.room_id) return;
    
    const chatWindow = document.getElementById('chat-window');
    const messageHtml = `
        <div class="message" data-username="${data.username}">
            <span class="username">${data.username}</span>: ${data.message}
            <span style="color: #666; font-size: 0.8em;">
                ${new Date(data.timestamp).toLocaleString('en-US', {
                    timeZone: 'Europe/Berlin',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                })}
            </span>
        </div>
    `;
    
    // Add new message at the bottom
    chatWindow.innerHTML += messageHtml;
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const username = getUsername();
    document.getElementById('username').textContent = username;

    // Add clear cache button handler
    document.getElementById('clear-cache').addEventListener('click', () => {
        // First check if we have a WebSocket connection
        if (!ws) {
            alert('Not connected to server');
            return;
        }

        // Send clear cache request to server
        ws.send(JSON.stringify({
            type: 'clear-cache',
            username: username
        }));

        // Wait for success response before refreshing
        const checkStatus = setInterval(() => {
            // Clear localStorage after successful server response
            localStorage.removeItem('username');
            
            // Generate new username
            username = `anony_${Math.floor(1000 + Math.random() * 9000)}`;
            document.getElementById('username').textContent = username;
            
            // Register new username
            registerUser(username);
            
            // Clear chat window
            document.getElementById('chat-window').innerHTML = '';
            currentRoomId = null;
            document.getElementById('chat-window-container').style.display = 'none';
            
            // Clear room list and reload
            document.getElementById('rooms').innerHTML = '';
            loadRooms();
            
            // Refresh page after successful cache clearing
            location.reload();
            
            clearInterval(checkStatus);
        }, 1000);
    });

    document.getElementById('create-room').addEventListener('click', createRoom);
    document.getElementById('send-button').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    initWebSocket();
});
