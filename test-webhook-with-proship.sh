#!/bin/bash

echo "🧪 Testing Webhook with ProShip API Integration"
echo "=============================================="
echo ""
echo "This will send a TEST webhook with your real order ID"
echo "The LINE message will show:"
echo "- Customer name with 'TEST' appended"
echo "- Phone number with last 4 digits masked"
echo ""

# Your webhook URL
WEBHOOK_URL="https://webhook-line-notifier.fly.dev/webhook"

# Test with your real order that exists in ProShip
ORDER_ID="order-90bd5760-7349-11f0-9ce5-a5f5bce0b7501754542024662"
USER_ID="user-e8d394b0-bafb-11eb-ac73-d5dec46ffb141621687667067"

echo "📤 Sending test webhook..."
echo "Order: $ORDER_ID"
echo "User: $USER_ID"
echo ""

# Send the webhook
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"{\\\"message\\\":\\\"ทดสอบระบบ ProShip API Integration\\\",\\\"eType\\\":\\\"order\\\",\\\"eId\\\":\\\"$ORDER_ID\\\",\\\"createdBy\\\":\\\"$USER_ID\\\",\\\"trackingNo\\\":\\\"JN497383275TH\\\"}\"
  }"

echo ""
echo ""
echo "✅ Test webhook sent!"
echo ""
echo "Expected LINE message format:"
echo "----------------------------"
echo "🚚 การแจ้งเตือนคำสั่งซื้อ"
echo "📦 Order: 90bd5760"
echo "📝 สถานะ: ทดสอบระบบ ProShip API Integration"
echo "🏷️ Tracking: JN497383275TH"
echo "👤 ลูกค้า: นายมาลัย คงมั่น [actual name from API]"
echo "📞 เบอร์โทร: 0642654670 [actual phone from API]"
echo "🕒 [current time]"
echo ""
echo "Check your LINE group for the message!"
echo ""
echo "To check logs:"
echo "fly logs --tail"