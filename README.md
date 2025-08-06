# Webhook LINE Notifier

A service that receives webhook notifications, parses JSON data, and forwards formatted messages to a LINE group.

## Features

- 🔔 Receives webhook notifications via HTTP POST
- 📝 Parses and formats JSON data
- 💬 Sends formatted messages to LINE groups
- 🔒 Optional webhook signature validation
- 📊 Built-in support for GitHub and Stripe webhooks
- 🎨 Customizable message templates

## Setup

### Prerequisites

- Node.js 18+ 
- LINE Bot account with Channel Access Token and Channel Secret
- LINE Group ID where messages will be sent

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/proship1/notifier.git
cd notifier
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your LINE credentials
```

4. Run the service:
```bash
npm run dev  # Development with auto-reload
npm start    # Production
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Bot channel access token | Yes |
| `LINE_CHANNEL_SECRET` | LINE Bot channel secret | Yes |
| `LINE_GROUP_ID` | Target LINE group ID | Yes |
| `PORT` | Server port (default: 3000) | No |
| `WEBHOOK_SECRET` | Secret for webhook validation | No |
| `MESSAGE_TEMPLATE` | Custom message template | No |
| `LOG_LEVEL` | Logging level (info/debug/error) | No |

### Custom Message Templates

Use placeholders in `MESSAGE_TEMPLATE` to format messages:

```
MESSAGE_TEMPLATE="🔔 New Event: {{event}}\n👤 User: {{user.name}}\n📝 Message: {{message}}"
```

## API Endpoints

### `POST /webhook`
Receives webhook notifications and forwards to LINE.

**Headers (optional):**
- `x-webhook-signature`: HMAC signature for validation

**Body:** Any JSON payload

**Response:**
```json
{
  "success": true,
  "message": "Notification sent"
}
```

### `GET /health`
Health check endpoint.

## Deployment Options

### 1. Docker

```bash
docker build -t webhook-notifier .
docker run -p 3000:3000 --env-file .env webhook-notifier
```

### 2. Docker Compose

```bash
docker-compose up -d
```

### 3. Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/proship1/notifier)

1. Click the deploy button
2. Set environment variables in Vercel dashboard
3. Deploy

### 4. Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/proship1/notifier)

1. Click deploy button
2. Configure environment variables
3. Deploy

### 5. Fly.io

```bash
fly launch
fly secrets set LINE_CHANNEL_ACCESS_TOKEN=xxx
fly secrets set LINE_CHANNEL_SECRET=xxx
fly secrets set LINE_GROUP_ID=xxx
fly deploy
```

### 6. Heroku

```bash
heroku create your-app-name
heroku config:set LINE_CHANNEL_ACCESS_TOKEN=xxx
heroku config:set LINE_CHANNEL_SECRET=xxx
heroku config:set LINE_GROUP_ID=xxx
git push heroku main
```

### 7. Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/webhook-notifier)

1. Click deploy button
2. Configure environment variables
3. Deploy

### 8. Google Cloud Run

```bash
gcloud run deploy webhook-notifier \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="LINE_CHANNEL_ACCESS_TOKEN=xxx,LINE_CHANNEL_SECRET=xxx,LINE_GROUP_ID=xxx"
```

### 9. AWS Lambda (with Serverless Framework)

Create `serverless.yml`:
```yaml
service: webhook-notifier
provider:
  name: aws
  runtime: nodejs18.x
  environment:
    LINE_CHANNEL_ACCESS_TOKEN: ${env:LINE_CHANNEL_ACCESS_TOKEN}
    LINE_CHANNEL_SECRET: ${env:LINE_CHANNEL_SECRET}
    LINE_GROUP_ID: ${env:LINE_GROUP_ID}
functions:
  webhook:
    handler: src/index.handler
    events:
      - http:
          path: webhook
          method: post
```

Deploy:
```bash
serverless deploy
```

## Testing

Send a test webhook:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "message": "Hello from webhook!"}'
```

## Security

- Enable `WEBHOOK_SECRET` for production deployments
- Use HTTPS in production
- Rotate LINE tokens regularly
- Monitor logs for suspicious activity

## License

MIT