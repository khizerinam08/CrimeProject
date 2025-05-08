# Chat History Backend

A Node.js Express server for storing and retrieving chat history, built with MongoDB.

## Features

- Store and retrieve chat messages
- Create, read, update, and delete chat histories
- RESTful API design
- MongoDB database for persistent storage

## Prerequisites

- Node.js (v14 or later)
- MongoDB (local or cloud instance)

## Installation

1. Clone the repository
2. Navigate to the Backend directory
3. Install dependencies

```bash
cd Backend
npm install
```

4. Create a `.env` file with the following environment variables:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chat-history
```

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

## API Endpoints

### Chats

- **GET /api/chats** - Get all chats
- **GET /api/chats/:chatId** - Get a specific chat by ID
- **POST /api/chats** - Create a new chat
  - Request body: `{ "title": "Chat Title", "sessionId": "optional-session-id" }`
- **PUT /api/chats/:chatId/messages** - Add a message to a chat
  - Request body: `{ "text": "Message content", "sender": "user|bot", "html": false }`
- **DELETE /api/chats/:chatId** - Delete a chat

## Integration with Frontend

The frontend can use these API endpoints to:
1. Create a new chat when a user starts a conversation
2. Save messages as they're sent and received
3. Load message history when a user opens an existing chat
4. Delete chats when they're no longer needed

## Error Handling

The API returns appropriate HTTP status codes and JSON responses with the following structure:

```json
{
  "success": true|false,
  "data": {...}|null,
  "message": "Error message (if success is false)"
}
``` 