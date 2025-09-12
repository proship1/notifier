#!/bin/bash

echo "🚀 Deploying LINE Notifier with Tracking Monitoring..."
echo "======================================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if Fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Error: Fly CLI not found. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Build and deploy
echo "📦 Deploying to Fly.io..."
fly deploy

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    
    # Get the app name
    APP_NAME=$(fly status --json 2>/dev/null | grep -o '"Name":"[^"]*"' | cut -d'"' -f4)
    if [ -z "$APP_NAME" ]; then
        APP_NAME="webhook-line-notifier"
    fi
    
    echo "🌐 Your app is now running with tracking monitoring!"
    echo "   App URL: https://$APP_NAME.fly.dev"
    echo ""
    echo "📊 Monitoring Dashboard:"
    echo "   https://$APP_NAME.fly.dev/tracking-report"
    echo ""
    echo "🔧 API Endpoints:"
    echo "   Stats JSON: https://$APP_NAME.fly.dev/tracking-report/json"
    echo "   Stats Only: https://$APP_NAME.fly.dev/tracking-report/stats"
    echo "   Health Check: https://$APP_NAME.fly.dev/health"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Wait 24-48 hours to collect baseline data"
    echo "   2. Visit the monitoring dashboard to see duplicate statistics"
    echo "   3. Monitor logs for 'DUPLICATE TRACKING NUMBER DETECTED' warnings"
    echo "   4. Check the duplication rate and decide on next actions"
    echo ""
    echo "🔍 To check logs:"
    echo "   fly logs -a $APP_NAME"
    echo ""
    echo "   Look for these log entries:"
    echo "   - 'Tracking monitoring result' (every webhook)"
    echo "   - 'DUPLICATE TRACKING NUMBER DETECTED' (when duplicates found)"
else
    echo "❌ Deployment failed!"
    echo "Please check the error messages above and try again."
    exit 1
fi