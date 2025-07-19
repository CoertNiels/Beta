A web chat app running on Node.js (listening on 192.168.2.12:8080) where anonymous users can connect, get assigned a unique username (anony_####), create and join public chat rooms, and chat in real time. Chat history is stored in SQLite and loaded on join. Text only, no user accounts or private rooms.
Features
Core Features

    Anonymous user connection with generated username: anony_#### (4-digit random integer)

    Users can create new public chat rooms with unique names

    Users can join existing public chat rooms by selecting from a list

    Real-time chat inside rooms using WebSocket (WS) protocol

    Chat messages stored in SQLite database per room

    Chat history loads when joining a room

    Text-only messaging (no images, no typing indicators, no message statuses)

    Unlimited users and rooms

Non-Functional

    Runs on Node.js + Express + WS on 192.168.2.12:8080

    SQLite for persistent chat message storage

    Basic web UI (no React or SPA, focus on backend first)

    No user authentication, no private rooms, no moderation or notifications

Architecture Overview

    Backend:

        Node.js server with Express for HTTP routes and static file serving

        WS (WebSocket) server for real-time chat communication

        SQLite DB to persist chat messages

    Frontend:

        Simple HTML/CSS/JS client that connects to WebSocket server, displays rooms, messages, and sends messages

Database Design (SQLite)
Tables

    rooms

        id INTEGER PRIMARY KEY AUTOINCREMENT

        name TEXT UNIQUE NOT NULL

    messages

        id INTEGER PRIMARY KEY AUTOINCREMENT

        room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE

        username TEXT NOT NULL

        message TEXT NOT NULL

        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP

API / WebSocket Events
HTTP Endpoints (Express)

    GET /rooms — returns list of all rooms (name + id)

    POST /rooms — create new room, body: { name: string }

WebSocket Events
Event	Client → Server	Server → Client	Description
join	{ roomId: number }	{ roomId, messages: [] }	Client joins a room; server responds with history
message	{ roomId, message }	{ username, message, timestamp }	Client sends message; server broadcasts to room
error	—	{ error: string }	Server sends error message
To-Do / Development Milestones
Phase 1 — Setup & Basic Backend

Setup Node.js project with Express and WS

Setup SQLite database with rooms and messages tables

Implement REST API to list and create rooms

Implement username generation function (anony_####) on client connect

Implement WebSocket server handling connection, joining rooms, and broadcasting messages

On join, send last 50 messages from SQLite for that room

    Store incoming messages into SQLite with timestamp and username

Phase 2 — Basic Frontend

Simple HTML page with:

    Room list (loaded via REST API)

    Form to create a new room

    Chat window for joined room showing messages

    Input box to send messages via WebSocket

Generate anonymous username on page load and display it

Handle joining room and receiving messages over WS

    Display chat history on joining room

Phase 3 — Testing & Improvements

Test multiple users joining rooms and chatting

Handle disconnects gracefully

Limit chat history load (e.g., last 50 messages)

Add basic UI improvements (scrolling chat window, timestamps)

Add error handling (invalid room join, duplicate room name, etc.)