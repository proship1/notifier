const https = require('https');

async function getProductionGroups() {
  console.log('📊 FETCHING LINE GROUP INFORMATION FROM PRODUCTION');
  console.log('=' .repeat(70));
  
  // First, let's get the tracking report which might show us which groups are active
  const trackingUrl = 'https://webhook-line-notifier.fly.dev/tracking-report/json';
  
  return new Promise((resolve, reject) => {
    https.get(trackingUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        try {
          const report = JSON.parse(data);
          
          // Extract unique group IDs from any logged data
          const groupIds = new Set();
          
          // Look through duplicate details for any group references
          if (report.duplicateDetails) {
            Object.values(report.duplicateDetails).forEach(duplicates => {
              duplicates.forEach(dup => {
                // User IDs might give us hints about groups
                if (dup.userId) {
                  console.log(`Found user: ${dup.userId.substring(0, 30)}...`);
                }
              });
            });
          }
          
          console.log('\n📝 RECOMMENDATION:');
          console.log('To get a proper group member report, you need to:');
          console.log('\n1. SSH into your Fly.io instance:');
          console.log('   fly ssh console -a webhook-line-notifier');
          console.log('\n2. Access Redis to get group mappings:');
          console.log('   redis-cli');
          console.log('   KEYS user:*');
          console.log('   KEYS apiKey:*');
          console.log('\n3. Or add an API endpoint to your app to list groups');
          console.log('\nAlternatively, check your LINE Official Account Manager:');
          console.log('   https://manager.line.biz/');
          console.log('   You can see all groups your bot is a member of there.');
          
          console.log('\n📱 LINE DEVELOPER CONSOLE:');
          console.log('   https://developers.line.biz/console/');
          console.log('   Check your channel statistics for group information.');
          
        } catch (error) {
          console.error('Error:', error.message);
        }
      });
    }).on('error', (err) => {
      console.error('Request failed:', err.message);
    });
  });
}

getProductionGroups().catch(console.error);