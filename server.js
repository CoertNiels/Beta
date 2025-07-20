const express = require('express');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Server configuration
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// SSL certificate configuration (only needed for HTTPS)
const SSL_CONFIG = {
    key: process.env.SSL_KEY ? fs.readFileSync(process.env.SSL_KEY) : null,
    cert: process.env.SSL_CERT ? fs.readFileSync(process.env.SSL_CERT) : null,
    ca: process.env.SSL_CA ? fs.readFileSync(process.env.SSL_CA) : null
};

// Load offensive words from external file
const OFFENSIVE_WORDS = new Set(require('./offensive-words.json').words.map(word => word.toLowerCase()));

// Function to censor offensive words in a message, preserving punctuation
const censorMessage = (message) => {
  // Regular expression to match words with optional punctuation
  const wordPattern = /\b(\w+)([\p{P}\p{S}]*)\b/gu;
  
  // Replace each word with its censored version if it's offensive
  return message.replace(wordPattern, (match, word, punctuation) => {
    const lowerWord = word.toLowerCase();
    if (OFFENSIVE_WORDS.has(lowerWord)) {
      // Preserve the original punctuation
      return '#'.repeat(word.length) + punctuation;
    }
    return match;
  });
};

// Initialize databases
let usersDb;
let messagesDb;

// Table creation functions
const createUserTables = () => {
  usersDb.serialize(() => {
    usersDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        last_seen DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
        created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
        block_count INTEGER DEFAULT 0,
        is_blocked BOOLEAN DEFAULT 0
      )
    `);

    usersDb.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_by TEXT,
        created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
        FOREIGN KEY (created_by) REFERENCES users(username)
      )
    `);

    usersDb.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    usersDb.run(`CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name)`);
  });
};

const createMessagesTables = () => {
  messagesDb.serialize(() => {
    messagesDb.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
      )
    `);

    messagesDb.run(`CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id)`);
    messagesDb.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);
  });
};

// Initialize databases
usersDb = new sqlite3.Database(path.join(__dirname, 'users.db'), (err) => {
  if (err) {
    console.error('Error opening users database:', err);
    process.exit(1);
  }
  console.log('Connected to users database');
  createUserTables();
});

messagesDb = new sqlite3.Database(path.join(__dirname, 'messages.db'), (err) => {
  if (err) {
    console.error('Error opening messages database:', err);
    process.exit(1);
  }
  console.log('Connected to messages database');
  createMessagesTables();
});

// Initialize Express app
const app = express();

// Create server based on configuration
const server = USE_HTTPS 
    ? https.createServer(SSL_CONFIG, app)
    : http.createServer(app);

const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// REST API endpoints
app.get('/rooms', (req, res) => {
  usersDb.all('SELECT * FROM rooms', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      // Send user-friendly error
      res.status(500).json({ 
        error: 'Failed to load room list', 
        details: 'An unexpected error occurred while loading the room list. Please try again later.' 
      });
      return;
    }
    res.json(rows);
  });
});

app.post('/rooms', (req, res) => {
  const { name, username } = req.body;
  
  if (!name) {
    res.status(400).json({ 
      error: 'Invalid input', 
      details: 'Please enter a room name' 
    });
    return;
  }

  // Check if user is blocked
  usersDb.get('SELECT is_blocked FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ 
        error: 'Server error', 
        details: 'An unexpected error occurred while checking user status. Please try again later.' 
      });
      return;
    }

    if (row && row.is_blocked) {
      res.status(403).json({ 
        error: 'Access denied', 
        details: 'Blocked users cannot create rooms' 
      });
      return;
    }

    // Create room
    usersDb.run('INSERT INTO rooms (name, created_by) VALUES (?, ?)', [name, username], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ 
            error: 'Room already exists', 
            details: 'A room with this name already exists. Please choose a different name.' 
          });
        } else {
          console.error('Database error:', err);
          res.status(500).json({ 
            error: 'Server error', 
            details: 'An unexpected error occurred while creating the room. Please try again later.' 
          });
        }
        return;
      }

      const roomId = this.lastID;
      
      // Get all rooms including the new one
      usersDb.all('SELECT * FROM rooms', [], (err, rooms) => {
        if (err) {
          console.error('Error fetching rooms:', err);
          return;
        }

        // Broadcast room list to all clients
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'room-list',
              rooms: rooms
            }));
          }
        });

        // Send success response to the creator
        res.json({ id: roomId, name });
      });
    });
  });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'register':
          registerUser(ws, data);
          break;
        case 'join':
          handleJoin(ws, data);
          break;
        case 'message':
          handleMessage(ws, data);
          break;

      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'Connection error', 
        details: 'Failed to process your request. Please try refreshing the page.' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Helper function to register a user
const registerUser = (ws, data) => {
  const { username } = data;
  
  usersDb.run(
    'INSERT OR IGNORE INTO users (username) VALUES (?)',
    [username],
    (err) => {
      if (err) {
        console.error('Error registering user:', err);
        ws.send(JSON.stringify({ 
          type: 'error', 
          error: 'Registration failed', 
          details: 'Failed to register your username. Please try refreshing the page.' 
        }));
        return;
      }
      
      // Update last_seen timestamp
      usersDb.run(
        'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE username = ?',
        [username],
        (err) => {
          if (err) {
            console.error('Error updating user timestamp:', err);
            ws.send(JSON.stringify({ 
              type: 'error', 
              error: 'Registration failed', 
              details: 'Failed to complete registration. Please try again.' 
            }));
            return;
          }
          ws.send(JSON.stringify({ type: 'register', success: true }));
        }
      );
    }
  );
};

// Helper functions for WebSocket events
const handleJoin = (ws, data) => {
  const { roomId } = data;
  
  // Load chat history
  messagesDb.all(
    'SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp ASC LIMIT 50',
    [roomId],
    (err, rows) => {
      if (err) {
        ws.send(JSON.stringify({ type: 'error', error: 'Failed to load chat history' }));
        return;
      }
      
      // Censor messages in chat history
      const censoredRows = rows.map(row => ({
        ...row,
        message: censorMessage(row.message)
      }));
      
      ws.send(JSON.stringify({
        type: 'join',
        roomId,
        messages: censoredRows
      }));
    }
  );
};

const handleMessage = (ws, data) => {
  const { roomId, message, username } = data;
  
  // Check if user is blocked
  usersDb.get('SELECT is_blocked FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      ws.send(JSON.stringify({ type: 'error', error: 'Database error' }));
      return;
    }
    
    if (row && row.is_blocked) {
      ws.send(JSON.stringify({ type: 'error', error: 'You are blocked from sending messages' }));
      ws.close();
      return;
    }

    // Censor offensive words
    const censoredMessage = censorMessage(message);
    const originalWords = message.split(' ');
    const censoredWords = censoredMessage.split(' ');
    const containsOffensive = originalWords.some((word, index) => 
      word.toLowerCase() !== censoredWords[index].toLowerCase()
    );

    // Store message in database
    messagesDb.run(
      'INSERT INTO messages (room_id, username, message) VALUES (?, ?, ?)',
      [roomId, username, censoredMessage],
      (err) => {
        if (err) {
          ws.send(JSON.stringify({ type: 'error', error: err.message }));
          return;
        }

        // If the message contained offensive words, update user's block count
        if (containsOffensive) {
          usersDb.get('SELECT block_count FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', error: 'Database error' }));
              return;
            }
            
            const newBlockCount = (row && row.block_count) ? row.block_count + 1 : 1;
            
            // Update block count
            usersDb.run(
              'UPDATE users SET block_count = ?, is_blocked = ? WHERE username = ?',
              [newBlockCount, newBlockCount >= 3, username],
              (err) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'error', error: 'Database error' }));
                  return;
                }
                
                // If user is now blocked, notify them and close connection
                if (newBlockCount >= 3) {
                  ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'You have been blocked from sending messages due to multiple offensive messages' 
                  }));
                  ws.close();
                  return;
                }
              }
            );
          });
        }

        // Broadcast message to all clients in the room
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'message',
              username,
              message: censoredMessage,
              timestamp: new Date().toISOString(),
              room_id: roomId
            }));
          }
        });
      }
    );
  });
};

// Start server
server.listen(PORT, HOST, () => {
  const protocol = USE_HTTPS ? 'https' : 'http';
  console.log(`Server running on ${protocol}://${HOST}:${PORT}`);
  console.log('WebSocket server is running');
});
