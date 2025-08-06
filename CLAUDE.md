# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Webhook to LINE Bot Notifier - A Node.js service that receives webhook notifications and forwards formatted messages to LINE groups.

## Architecture

- **Express Server**: HTTP server handling webhook endpoints
- **LINE Bot SDK**: Official SDK for LINE messaging integration  
- **Message Formatter**: Extensible system for formatting different webhook types
- **Webhook Validator**: Optional HMAC signature validation for security

## Commands

```bash
npm install      # Install dependencies
npm start        # Run production server
npm run dev      # Run with auto-reload (nodemon)
npm run lint     # Run ESLint
npm test         # Run tests (when implemented)
```

## Key Files

- `src/index.js`: Main server and webhook endpoint
- `src/utils/messageFormatter.js`: Message formatting logic with built-in GitHub/Stripe support
- `src/middleware/webhookValidator.js`: HMAC signature validation
- `.env.example`: Required environment variables template

## Deployment

The project includes configurations for multiple deployment platforms:
- Docker (`Dockerfile`, `docker-compose.yml`)
- Vercel (`vercel.json`)
- Render (`render.yaml`)
- Fly.io (`fly.toml`)
- GitHub Actions (`.github/workflows/deploy.yml`)

## Environment Variables

Required:
- `LINE_CHANNEL_ACCESS_TOKEN`: Bot channel access token
- `LINE_CHANNEL_SECRET`: Bot channel secret  
- `LINE_GROUP_ID`: Target group for messages

Optional:
- `WEBHOOK_SECRET`: For signature validation
- `MESSAGE_TEMPLATE`: Custom message format with `{{placeholder}}` syntax