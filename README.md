# Full Stack Chat & Messaging System

A real-time messaging app with **Next.js (App Router)** frontend and **Node.js + Express + MongoDB** backend, featuring WebSockets, JWT auth, WhatsApp-like UI, and message delivery/seen status.

## Features

- **Auth**: Register, login, JWT authentication
- **Chat list**: Last message + timestamp, search users/chats
- **1:1 chat**: Message bubbles, real-time via WebSockets
- **Typing indicator** and **sent/delivered/seen** status
- **Group chats** with admin roles
- **Online/offline status** indicators
- **File & image uploads**
- **Chat archiving & pinned conversations**
- **In-app notifications**
- **Security**: Rate limiting, validation, bcrypt, safe queries

## Quick Start

### 1. Prerequisites

- Node.js 18+
- MongoDB (local or cloud like MongoDB Atlas)
- npm or yarn

### 2. MongoDB

Have MongoDB running locally (e.g., `mongod`) or use a cloud URI from [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).

### 3. Backend Setup

```
bash
cd backend
npm install

# Create .env file
cp .env.example .env
```

Edit `.env` with your settings:

```
env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

Start the backend:

```
bash
npm run dev
```

Server runs at **http://localhost:5000**

### 4. Frontend Setup

```
bash
cd frontend
npm install

# Create .env.local file
cp .env.local.example .env.local
```

Edit `.env.local`:

```
env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Start the frontend:

```
bash
npm run dev
```

App runs at **http://localhost:3000**

### 5. Usage

1. Open http://localhost:3000
2. Register a new account
3. In another browser/incognito, register a second user
4. From the first user, search for the second by name/email and start a chat
5. Send messages and see typing + read receipts

## Project Structure

```
chat-and-messaging-system/
├── backend/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   ├── rateLimit.js       # Rate limiting
│   │   └── validation.js     # Input validation
│   ├── models/
│   │   ├── User.js           # User model
│   │   ├── Message.js        # Message model
│   │   └── Conversation.js   # Conversation model
│   ├── routes/
│   │   ├── auth.js           # Auth routes
│   │   ├── conversations.js  # Conversation routes
│   │   ├── messages.js      # Message routes
│   │   └── users.js         # User routes
│   ├── socket/
│   │   └── index.js         # Socket.io handlers
│   ├── uploads/              # File uploads
│   ├── server.js            # Express + Socket.io server
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── chats/           # Chat pages
│   │   │   ├── [id]/        # Individual chat
│   │   │   ├── archived/    # Archived chats
│   │   │   └── new-group/   # Create group
│   │   ├── login/           # Login page
│   │   └── register/        # Register page
│   ├── components/          # React components
│   │   ├── AuthProvider.tsx
│   │   ├── SocketProvider.tsx
│   │   ├── PresenceProvider.tsx
│   │   └── NotificationsCenter.tsx
│   ├── hooks/
│   │   └── useSocket.ts     # Socket hook
│   ├── lib/
│   │   ├── api.ts           # API client
│   │   └── socket.ts        # Socket client
│   └── package.json
│
└── README.md
```

## API Overview

### Authentication Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Conversation Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List conversations (paginated) |
| GET | `/api/conversations/:id` | Get single conversation |
| GET | `/api/conversations/direct/:userId` | Get or create direct chat |
| POST | `/api/conversations` | Create group conversation |
| PATCH | `/api/conversations/:id/pin` | Pin/unpin conversation |
| PATCH | `/api/conversations/:id/archive` | Archive/unarchive conversation |
| DELETE | `/api/conversations/:id` | Delete conversation |

### Message Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/conversation/:id` | Get chat history (paginated) |
| POST | `/api/messages/upload` | Upload attachment |
| POST | `/api/messages/mark-seen` | Mark messages as seen |

### User Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?q=` | Search users |

## WebSocket Events (Socket.io)

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_conversation` | `{ conversationId }` | Join a chat room |
| `leave_conversation` | `{ conversationId }` | Leave a chat room |
| `typing_start` | `{ conversationId }` | Start typing |
| `typing_stop` | `{ conversationId }` | Stop typing |
| `send_message` | `{ conversationId, content }` | Send message |
| `mark_seen` | `{ conversationId }` | Mark messages as seen |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | `{ message }` | New message received |
| `typing` | `{ conversationId, userId, userName }` | User is typing |
| `typing_stopped` | `{ conversationId, userId }` | User stopped typing |
| `messages_seen` | `{ conversationId, seenBy }` | Messages seen |
| `user_status` | `{ userId, isOnline, lastSeen }` | User online status |
| `new_message_notification` | `{ conversationId, message }` | In-app notification |

## Environment Variables

### Backend (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/chat-app` |
| `JWT_SECRET` | Secret for JWT signing | Required |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `CLIENT_URL` | Frontend origin | `http://localhost:3000` |

### Frontend (`.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5000/api` |

## Deployment (Optional)

### Backend - Render

1. Push code to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. Connect your GitHub repository
4. Set environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: Generate a secure secret
   - `CLIENT_URL`: Your frontend URL

### Frontend - Vercel/Netlify

1. Push code to GitHub
2. Import project to [Vercel](https://vercel.com) or [Netlify](https://netlify.com)
3. Set environment variable:
   - `NEXT_PUBLIC_API_URL`: Your backend URL
4. Deploy!

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Socket.io Client
- **Backend**: Node.js, Express, Socket.io, MongoDB/Mongoose
- **Authentication**: JWT, bcrypt
- **Security**: Rate limiting, input validation, safe query patterns

## License

MIT
