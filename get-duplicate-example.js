const https = require('https');

async function getDuplicateExample() {
  return new Promise((resolve, reject) => {
    const url = 'https://webhook-line-notifier.fly.dev/tracking-report/json';
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const report = JSON.parse(data);
          
          console.log('🔍 DUPLICATE TRACKING NUMBER ANALYSIS');
          console.log('=' .repeat(60));
          console.log(`Date: ${report.stats.date}`);
          console.log(`Total Messages: ${report.stats.total}`);
          console.log(`Duplicates Found: ${report.stats.duplicates}`);
          console.log(`Duplication Rate: ${report.stats.duplicationRate}%\n`);
          
          console.log('📦 DETAILED DUPLICATE EXAMPLES:');
          console.log('=' .repeat(60));
          
          // Get the first few duplicates with details
          const duplicateEntries = Object.entries(report.duplicateDetails || {});
          
          duplicateEntries.slice(0, 3).forEach(([trackingNo, occurrences], index) => {
            console.log(`\n${index + 1}. Tracking Number: ${trackingNo}`);
            console.log(`   Sent ${occurrences.length + 1} times total`);
            console.log(`   Order ID: ${occurrences[0].orderId}`);
            
            // Format timestamps
            occurrences.forEach((occ, i) => {
              const time = new Date(occ.timestamp).toISOString();
              console.log(`   Occurrence ${occ.occurrenceNumber}: ${time}`);
              console.log(`   User ID: ${occ.userId}`);
              console.log(`   User Short: ${occ.userId.substring(0, 20)}...`);
            });
            
            // Show time differences
            if (occurrences.length > 0) {
              const timeDiffs = occurrences.map((occ, i) => {
                if (i === 0) return 'First occurrence';
                const diff = occ.timestamp - occurrences[0].timestamp;
                return `+${diff}ms`;
              });
              console.log(`   Time Pattern: ${timeDiffs.join(' → ')}`);
            }
          });
          
          // Show pattern analysis
          console.log('\n📊 PATTERN ANALYSIS:');
          console.log('=' .repeat(60));
          
          let sameOrderCount = 0;
          let differentUsersCount = 0;
          
          duplicateEntries.forEach(([trackingNo, occurrences]) => {
            // Check if same order (they should all be the same order)
            const orders = [...new Set(occurrences.map(o => o.orderId))];
            if (orders.length === 1) sameOrderCount++;
            
            // Check if different users
            const users = [...new Set(occurrences.map(o => o.userId))];
            if (users.length > 1) differentUsersCount++;
          });
          
          console.log(`✅ Same Order ID: ${sameOrderCount}/${duplicateEntries.length} duplicates`);
          console.log(`👥 Different Users: ${differentUsersCount}/${duplicateEntries.length} duplicates`);
          
          // Show top duplicate tracking number with full details
          if (report.topDuplicates && report.topDuplicates.length > 0) {
            console.log('\n🎯 TOP DUPLICATE EXAMPLE:');
            console.log('=' .repeat(60));
            const top = report.topDuplicates[0];
            console.log(`Tracking: ${top.trackingNo}`);
            console.log(`Sent: ${top.count + 1} times`);
            console.log(`Orders: ${top.orders.length} unique (${top.orders.join(', ')})`);
            console.log(`Users: ${top.users.length} unique`);
            top.users.forEach((user, i) => {
              console.log(`  User ${i + 1}: ${user}`);
            });
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

getDuplicateExample().catch(console.error);