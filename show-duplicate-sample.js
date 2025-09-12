const https = require('https');

async function showDuplicateSample() {
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
          
          console.log('🎯 REAL DUPLICATE TRACKING NUMBER EXAMPLE');
          console.log('=' .repeat(70));
          
          // Get the most interesting duplicate (sent most times)
          const topDuplicate = report.topDuplicates[0];
          const trackingNo = topDuplicate.trackingNo;
          const duplicateDetails = report.duplicateDetails[trackingNo];
          
          console.log(`📦 Tracking Number: ${trackingNo}`);
          console.log(`📋 Order ID: ${topDuplicate.orders[0]}`);
          console.log(`🔄 Total Occurrences: ${topDuplicate.count + 1} times`);
          console.log(`👥 Different Users: ${topDuplicate.users.length}\n`);
          
          console.log('📅 DUPLICATE TIMELINE:');
          console.log('-'.repeat(70));
          
          // Show first occurrence (we only see duplicates, so this is occurrence #2+)
          console.log('1st Occurrence: [Not in duplicate log - this is the original]');
          console.log('   🕐 Time: [Original timestamp not logged]');
          console.log('   👤 User: [One of the users below sent it first]');
          console.log('   📝 Status: Original webhook (not duplicate)');
          
          // Show each duplicate occurrence
          duplicateDetails.forEach((dup, index) => {
            const time = new Date(dup.timestamp).toISOString();
            const userShort = dup.userId.substring(5, 25); // Remove "user-" prefix and shorten
            
            console.log(`\n${dup.occurrenceNumber}${getOrdinalSuffix(dup.occurrenceNumber)} Occurrence: [DUPLICATE DETECTED] ⚠️`);
            console.log(`   🕐 Time: ${time}`);
            console.log(`   👤 User: ${userShort}...`);
            console.log(`   📝 Status: DUPLICATE - Same tracking number, same order`);
            
            if (index > 0) {
              const timeDiff = dup.timestamp - duplicateDetails[0].timestamp;
              console.log(`   ⏱️  Time since previous: ${timeDiff}ms`);
            }
          });
          
          console.log('\n🔍 ANALYSIS:');
          console.log('-'.repeat(70));
          console.log(`✅ Same Order ID: YES - ${topDuplicate.orders[0]}`);
          console.log(`✅ Same Tracking: YES - ${trackingNo}`);
          console.log(`⚠️  Different Users: ${topDuplicate.users.length > 1 ? 'YES' : 'NO'}`);
          
          if (topDuplicate.users.length > 1) {
            console.log('\n👥 USER DETAILS:');
            console.log('-'.repeat(70));
            topDuplicate.users.forEach((user, i) => {
              const userShort = user.substring(5, 25);
              console.log(`User ${i + 1}: ${userShort}... (${user})`);
            });
            
            console.log('\n🧩 PROBABLE CAUSE:');
            console.log('-'.repeat(70));
            console.log('• Same order is being processed by multiple users/systems');
            console.log('• Each user/system sends identical webhook with same tracking number');
            console.log('• This creates duplicate notifications for the same shipment');
            console.log('• Pattern suggests webhook sender has race condition or retry logic');
          }
          
          console.log('\n💡 IMPACT:');
          console.log('-'.repeat(70));
          console.log(`• This single tracking number was sent ${topDuplicate.count + 1} times`);
          console.log(`• Wasted LINE API calls: ${topDuplicate.count} extra calls`);
          console.log(`• If user was mapped: ${topDuplicate.count} duplicate LINE messages sent`);
          console.log(`• Multiplied across ${report.duplicateCount} duplicates: Significant waste`);
          
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

function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

showDuplicateSample().catch(console.error);