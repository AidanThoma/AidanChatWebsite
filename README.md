# ThomaGPT

A self-hosted human-powered chat application built with Next.js, TypeScript, Tailwind CSS, Prisma, PostgreSQL, and Socket.IO.

## Features

- Public anonymous chat experience styled like a modern AI chat app without AI responses
- Admin inbox at `/admin` with authentication
- Real-time delivery of public messages to the admin inbox
- Real-time admin replies back to the anonymous user
- Users can delete their own conversations; admins can delete any conversation
- Typing indicators and realtime presence basics
- Docker Compose support for local hosting

## Quick Start

1. Copy `.env.example` to `.env` and update values as needed.
2. Start PostgreSQL locally or bring up the Docker-powered database:
   - `docker compose up -d db`
3. Run Prisma migrations:
   - `npx prisma db push`
4. Install dependencies if needed:
   - `npm install`
5. Start the app:
   - `npm run dev`

Open `http://localhost:3000` to use the public chat and `http://localhost:3000/admin` to sign in.

## Admin login

Defaults in `.env`:

- Email: `admin@example.com`
- Password: `admin123`

These should be changed before deploying to a real machine.

## Docker Compose

This repo includes a Docker Compose setup that runs the Next.js app and PostgreSQL together:

```bash
docker compose up --build
```

## Project structure

- `app/` — Next.js App Router pages and API routes
- `components/` — public chat and admin admin UI pieces
- `lib/` — Prisma, auth helpers, and socket configuration
- `prisma/` — Prisma schema and future migrations
- `server.js` — custom Next.js server with Socket.IO support
