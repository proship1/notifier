const { Client } = require('@line/bot-sdk');
require('dotenv').config();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const lineClient = new Client(lineConfig);

async function getGroupsReport() {
  console.log('📊 LINE GROUPS MEMBER REPORT');
  console.log('=' .repeat(70));
  console.log(`Generated: ${new Date().toISOString()}\n`);

  // Get group IDs from your configuration files
  const fs = require('fs');
  const path = require('path');
  
  // Load user-group mappings to find all group IDs
  let allGroupIds = new Set();
  
  // Check JSON config file
  try {
    const configPath = path.join(__dirname, 'src', 'config', 'userGroupMappings.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Extract group IDs from users
      if (config.users) {
        Object.values(config.users).forEach(groupId => {
          if (groupId) allGroupIds.add(groupId);
        });
      }
      
      // Extract group IDs from apiKeys (they have groupId field)
      if (config.apiKeys) {
        Object.values(config.apiKeys).forEach(apiConfig => {
          if (apiConfig.groupId) allGroupIds.add(apiConfig.groupId);
        });
      }
    }
  } catch (error) {
    console.log('Could not load JSON config:', error.message);
  }

  // Also check environment variable if set
  if (process.env.LINE_GROUP_ID) {
    allGroupIds.add(process.env.LINE_GROUP_ID);
  }

  if (allGroupIds.size === 0) {
    console.log('❌ No group IDs found in configuration');
    console.log('Please ensure groups are configured in userGroupMappings.json or .env file');
    return;
  }

  console.log(`Found ${allGroupIds.size} configured group(s)\n`);

  let totalMembers = 0;
  let totalGroups = 0;
  let failedGroups = [];

  // Process each group
  for (const groupId of allGroupIds) {
    console.log('-'.repeat(70));
    console.log(`📍 Group ID: ${groupId}`);
    
    try {
      // Get group summary (includes member count)
      const groupSummary = await lineClient.getGroupSummary(groupId);
      console.log(`   Group Name: ${groupSummary.groupName}`);
      console.log(`   Total Members: ${groupSummary.memberCount}`);
      
      // Get member IDs (excluding bot)
      try {
        const members = await lineClient.getGroupMemberIds(groupId);
        
        // Get bot's own user ID
        const botProfile = await lineClient.getBotInfo();
        const botUserId = botProfile.userId;
        
        // Filter out bot from members
        const humanMembers = members.userIds.filter(userId => userId !== botUserId);
        
        console.log(`   Human Members: ${humanMembers.length}`);
        console.log(`   Bot Included: ${members.userIds.length > humanMembers.length ? 'Yes' : 'No'}`);
        
        // Get details for first few members (API has rate limits)
        console.log('\n   👥 Member Details (first 5):');
        const memberDetailsLimit = Math.min(5, humanMembers.length);
        
        for (let i = 0; i < memberDetailsLimit; i++) {
          try {
            const memberProfile = await lineClient.getGroupMemberProfile(groupId, humanMembers[i]);
            console.log(`      ${i + 1}. ${memberProfile.displayName}`);
            console.log(`         User ID: ${humanMembers[i].substring(0, 20)}...`);
            
            // Add small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (profileError) {
            console.log(`      ${i + 1}. User ID: ${humanMembers[i].substring(0, 20)}...`);
            console.log(`         (Could not fetch profile)`);
          }
        }
        
        if (humanMembers.length > memberDetailsLimit) {
          console.log(`      ... and ${humanMembers.length - memberDetailsLimit} more members`);
        }
        
        totalMembers += humanMembers.length;
        totalGroups++;
        
      } catch (memberError) {
        console.log(`   ⚠️  Could not fetch member list: ${memberError.message}`);
        console.log(`   (Group might be too large or bot lacks permissions)`);
        totalGroups++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      
      if (error.statusCode === 404) {
        console.log(`   (Bot might not be in this group anymore)`);
      } else if (error.statusCode === 401) {
        console.log(`   (Invalid access token)`);
      } else if (error.statusCode === 429) {
        console.log(`   (Rate limit exceeded - wait before retrying)`);
      }
      
      failedGroups.push({
        groupId,
        error: error.message
      });
    }
    
    // Add delay between groups to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '=' .repeat(70));
  console.log('📈 SUMMARY:');
  console.log(`   Total Groups: ${totalGroups}`);
  console.log(`   Total Human Members: ${totalMembers}`);
  console.log(`   Average Members per Group: ${totalGroups > 0 ? (totalMembers / totalGroups).toFixed(1) : 0}`);
  
  if (failedGroups.length > 0) {
    console.log(`\n⚠️  Failed to retrieve ${failedGroups.length} group(s):`);
    failedGroups.forEach(fg => {
      console.log(`   - ${fg.groupId}: ${fg.error}`);
    });
  }

  console.log('\n💡 NOTES:');
  console.log('   - Member count excludes the bot itself');
  console.log('   - Some groups might show errors if bot was removed');
  console.log('   - Large groups might not return full member lists due to API limits');
  console.log('   - Rate limits may prevent fetching all member profiles');
}

// Run the report
getGroupsReport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});