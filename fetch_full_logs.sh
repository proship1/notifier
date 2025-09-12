#!/bin/bash

echo "Fetching comprehensive logs from Fly.io..."
echo "This may take a few minutes..."

# Fetch logs and save to file
fly logs -a webhook-line-notifier -n 2>&1 | head -50000 > full_analysis_logs.txt &
PID=$!

# Wait up to 30 seconds
for i in {1..30}; do
    if ! ps -p $PID > /dev/null; then
        break
    fi
    sleep 1
    echo -n "."
done

# Kill if still running
if ps -p $PID > /dev/null; then
    kill $PID 2>/dev/null
fi

echo ""
echo "Log collection complete. Lines captured:"
wc -l full_analysis_logs.txt

echo ""
echo "Analyzing tracking numbers..."

# Extract and count tracking numbers
echo "=== TRACKING NUMBER DUPLICATION ANALYSIS ===" > tracking_analysis.txt
echo "Generated: $(date)" >> tracking_analysis.txt
echo "" >> tracking_analysis.txt

# Count total webhooks
TOTAL_WEBHOOKS=$(grep "Webhook received" full_analysis_logs.txt | wc -l)
echo "Total webhook messages: $TOTAL_WEBHOOKS" >> tracking_analysis.txt

# Extract tracking numbers and count duplicates
echo "" >> tracking_analysis.txt
echo "Duplicate Tracking Numbers (sent more than once):" >> tracking_analysis.txt
echo "=================================================" >> tracking_analysis.txt

grep -o '\\"trackingNo\\":\\"[A-Z0-9]*\\"' full_analysis_logs.txt | \
    sed 's/\\"trackingNo\\":\\"//' | \
    sed 's/\\"//' | \
    sort | uniq -c | \
    sort -rn | \
    awk '$1 > 1 {print $1 " times: " $2}' >> tracking_analysis.txt

# Count unique tracking numbers
UNIQUE_TRACKING=$(grep -o '\\"trackingNo\\":\\"[A-Z0-9]*\\"' full_analysis_logs.txt | \
    sed 's/\\"trackingNo\\":\\"//' | \
    sed 's/\\"//' | \
    sort -u | wc -l)

# Count duplicate occurrences
DUPLICATE_COUNT=$(grep -o '\\"trackingNo\\":\\"[A-Z0-9]*\\"' full_analysis_logs.txt | \
    sed 's/\\"trackingNo\\":\\"//' | \
    sed 's/\\"//' | \
    sort | uniq -c | \
    awk '$1 > 1 {sum += $1 - 1} END {print sum+0}')

echo "" >> tracking_analysis.txt
echo "Summary:" >> tracking_analysis.txt
echo "--------" >> tracking_analysis.txt
echo "Unique tracking numbers: $UNIQUE_TRACKING" >> tracking_analysis.txt
echo "Duplicate messages: $DUPLICATE_COUNT" >> tracking_analysis.txt

# Show results
cat tracking_analysis.txt