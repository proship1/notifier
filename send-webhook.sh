#!/bin/bash

# Webhook sender with signature
WEBHOOK_URL="https://webhook-line-notifier.fly.dev/webhook"
SECRET="${WEBHOOK_SECRET:-your-secret-key}"  # Set your secret here or as env var

# Get the JSON payload from arguments or stdin
if [ $# -eq 0 ]; then
    echo "Usage: ./send-webhook.sh '{\"message\": \"Your message\"}'"
    exit 1
fi

PAYLOAD="$1"

# Generate HMAC SHA256 signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Send request with signature
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $SIGNATURE" \
  -d "$PAYLOAD"

echo ""