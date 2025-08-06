#!/bin/bash

echo "🚀 Fly.io Deployment Script for Webhook LINE Notifier"
echo "======================================================"
echo ""

# Check if fly CLI is installed
if ! command -v flyctl &> /dev/null && ! command -v fly &> /dev/null; then
    echo "📦 Installing Fly CLI..."
    curl -L https://fly.io/install.sh | sh
    export FLYCTL_INSTALL="/Users/$USER/.fly"
    export PATH="$FLYCTL_INSTALL/bin:$PATH"
    echo ""
fi

echo "✅ Step 1: Authenticate with Fly.io"
echo "-----------------------------------"
fly auth login
echo ""

echo "✅ Step 2: Launch the app"
echo "------------------------"
echo "Creating app in Tokyo region (nrt) for optimal LINE performance..."
fly launch --name webhook-line-notifier \
  --region nrt \
  --no-deploy \
  --org personal \
  --yes

echo ""
echo "✅ Step 3: Set your LINE Bot credentials"
echo "----------------------------------------"
echo "Please enter your LINE Bot credentials:"
echo ""

read -p "LINE_CHANNEL_ACCESS_TOKEN: " LINE_TOKEN
read -p "LINE_CHANNEL_SECRET: " LINE_SECRET  
read -p "LINE_GROUP_ID: " LINE_GROUP
read -p "WEBHOOK_SECRET (optional, press enter to skip): " WEBHOOK_SECRET

echo ""
echo "Setting secrets..."
fly secrets set LINE_CHANNEL_ACCESS_TOKEN="$LINE_TOKEN"
fly secrets set LINE_CHANNEL_SECRET="$LINE_SECRET"
fly secrets set LINE_GROUP_ID="$LINE_GROUP"

if [ ! -z "$WEBHOOK_SECRET" ]; then
    fly secrets set WEBHOOK_SECRET="$WEBHOOK_SECRET"
fi

echo ""
echo "✅ Step 4: Deploy to Fly.io"
echo "---------------------------"
fly deploy

echo ""
echo "✅ Step 5: Get your webhook URL"
echo "-------------------------------"
fly status
echo ""
echo "Your webhook URL is: https://webhook-line-notifier.fly.dev/webhook"
echo ""

echo "✅ Step 6: Test the deployment"
echo "------------------------------"
echo "Testing health endpoint..."
curl -s https://webhook-line-notifier.fly.dev/health | jq .

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo "Webhook URL: https://webhook-line-notifier.fly.dev/webhook"
echo "View logs: fly logs"
echo "Check status: fly status"
echo ""
echo "Test your webhook with:"
echo 'curl -X POST https://webhook-line-notifier.fly.dev/webhook \
  -H "Content-Type: application/json" \
  -d '"'"'{"message": "Hello from Fly.io!"}'"'"''