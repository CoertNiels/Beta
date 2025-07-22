# Room Chat App

A web-based chat application that allows anonymous users to communicate in public chat rooms.

## Features

- Anonymous user system
- Real-time chat functionality
- Multiple public chat rooms
- WebSocket-based communication
- SQLite database for message persistence
- Modern web interface

## Getting Started

### Try it Now

You can try the chat application right away at:
[https://chatroom-ba76.onrender.com](https://chatroom-ba76.onrender.com)

### For Developers

To run locally:

1. Install Node.js (v14 or higher)
2. Clone the repository
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

## Project Structure

- `server.js` - Main server file with WebSocket and Express setup
- `public/` - Contains client-side assets
- `messages.db` - SQLite database for storing messages
- `users.db` - SQLite database for user management
- `offensive-words.json` - List of offensive words for filtering

## Technologies Used

- Node.js
- Express.js
- WebSocket (ws)
- SQLite3
- CORS
- HTML5/CSS3
- JavaScript

## Technical Description

### Architecture Overview
The application follows a client-server architecture with WebSocket-based real-time communication:

1. **Frontend (Client-side)**
   - Built with vanilla JavaScript
   - Uses WebSocket for real-time communication
   - Maintains a persistent username in localStorage
   - Implements responsive UI with HTML5 and CSS3

2. **Backend (Server-side)**
   - Node.js server with Express.js framework
   - WebSocket server for real-time messaging
   - SQLite3 databases for data persistence
   - CORS middleware for cross-origin requests

### Key Components

1. **Authentication System**
   - Anonymous user system with unique usernames
   - Username persistence using localStorage
   - Automatic username generation if none exists

2. **Real-time Communication**
   - WebSocket protocol for instant messaging
   - Automatic reconnection handling
   - Message broadcasting to all room participants
   - Error handling for connection issues

3. **Message Handling**
   - Real-time message display
   - Message history persistence
   - Offensive word filtering
   - Message censorship system

4. **Room Management**
   - Dynamic room creation
   - Room joining/leaving functionality
   - Room list display
   - User presence tracking

### Security Features

1. **Offensive Content Filtering**
   - Maintains a list of offensive words
   - Automatic message censorship
   - Preserves message formatting while censoring
   - Case-insensitive word matching

2. **WebSocket Security**
   - Secure WebSocket connections (WSS)
   - Error handling for connection failures
   - Automatic reconnection attempts

3. **Data Persistence**
   - SQLite3 databases for storing:
     - User information
     - Message history
     - Room data

## License

This project is licensed under the MIT License - see the LICENSE file for details.
# tt
