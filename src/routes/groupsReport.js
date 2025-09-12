const express = require('express');
const { Client } = require('@line/bot-sdk');
const { getRedisClient } = require('../utils/redisClient');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize LINE client
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const lineClient = new Client(lineConfig);

// GET /groups-report - Get all groups and their members
router.get('/', async (req, res) => {
  try {
    const redis = getRedisClient();
    const allGroups = new Set();
    const userMappings = {};
    
    if (redis) {
      // Use SCAN to safely get keys
      let cursor = 0;
      
      // Scan for user keys
      do {
        const result = await redis.scan(cursor, {
          MATCH: 'user:*',
          COUNT: 100
        });
        
        cursor = result.cursor;
        const keys = result.keys;
        
        for (const key of keys) {
          try {
            const groupId = await redis.get(key);
            if (groupId) {
              allGroups.add(groupId);
              const userId = key.replace('user:', '');
              if (!userMappings[groupId]) {
                userMappings[groupId] = [];
              }
              userMappings[groupId].push(userId);
            }
          } catch (e) {
            // Key might be wrong type, skip
            logger.warn(`Could not read key ${key}: ${e.message}`);
          }
        }
      } while (cursor !== 0);
      
      // Reset cursor for API keys
      cursor = 0;
      
      // Scan for API keys
      do {
        const result = await redis.scan(cursor, {
          MATCH: 'apiKey:*',
          COUNT: 100
        });
        
        cursor = result.cursor;
        const keys = result.keys;
        
        for (const key of keys) {
          try {
            const apiData = await redis.get(key);
            if (apiData) {
              try {
                const parsed = JSON.parse(apiData);
                if (parsed.groupId) {
                  allGroups.add(parsed.groupId);
                }
              } catch (e) {
                // Not JSON, skip
              }
            }
          } catch (e) {
            // Key might be wrong type, skip
            logger.warn(`Could not read key ${key}: ${e.message}`);
          }
        }
      } while (cursor !== 0);
    }
    
    // Add environment group if exists
    if (process.env.LINE_GROUP_ID && process.env.LINE_GROUP_ID !== 'your_line_group_id_here') {
      allGroups.add(process.env.LINE_GROUP_ID);
    }
    
    const groupReports = [];
    const errors = [];
    
    // Get information for each group
    for (const groupId of allGroups) {
      try {
        // Get group summary
        const groupSummary = await lineClient.getGroupSummary(groupId);
        
        // Get member count
        const memberCount = await lineClient.getGroupMembersCount(groupId);
        
        // Try to get member IDs (might fail for large groups)
        let memberIds = [];
        let memberProfiles = [];
        
        try {
          const members = await lineClient.getGroupMemberIds(groupId);
          memberIds = members.userIds;
          
          // Get bot's user ID to exclude it
          let botUserId = null;
          try {
            const botInfo = await lineClient.getBotInfo();
            botUserId = botInfo.userId;
          } catch (e) {
            // Bot info not available
          }
          
          // Filter out bot
          const humanMembers = botUserId ? 
            memberIds.filter(id => id !== botUserId) : 
            memberIds;
          
          // Get first few member profiles (to avoid rate limits)
          const profileLimit = Math.min(5, humanMembers.length);
          for (let i = 0; i < profileLimit; i++) {
            try {
              const profile = await lineClient.getGroupMemberProfile(groupId, humanMembers[i]);
              memberProfiles.push({
                userId: humanMembers[i],
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl
              });
              
              // Small delay to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
              memberProfiles.push({
                userId: humanMembers[i],
                displayName: 'Unknown',
                error: e.message
              });
            }
          }
        } catch (e) {
          // Could not get member list (group too large or no permission)
        }
        
        groupReports.push({
          groupId,
          groupName: groupSummary.groupName,
          pictureUrl: groupSummary.pictureUrl,
          memberCount: memberCount.count,
          humanMemberCount: memberIds.length > 0 ? 
            memberIds.filter(id => !id.includes('bot')).length : 
            memberCount.count - 1, // Assume bot is counted
          memberProfiles,
          mappedUsers: userMappings[groupId] || [],
          mappedUserCount: (userMappings[groupId] || []).length
        });
        
        // Delay between groups
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        errors.push({
          groupId,
          error: error.message,
          statusCode: error.statusCode
        });
      }
    }
    
    // Generate HTML report
    const html = generateGroupReportHTML(groupReports, errors);
    res.send(html);
    
  } catch (error) {
    logger.error('Error generating groups report', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to generate report',
      message: error.message 
    });
  }
});

// GET /groups-report/json - JSON version of the report
router.get('/json', async (req, res) => {
  try {
    const redis = getRedisClient();
    const allGroups = new Set();
    const userMappings = {};
    
    if (redis) {
      // Use SCAN to safely get keys
      let cursor = 0;
      
      // Scan for user keys
      do {
        const result = await redis.scan(cursor, {
          MATCH: 'user:*',
          COUNT: 100
        });
        
        cursor = result.cursor;
        const keys = result.keys;
        
        for (const key of keys) {
          try {
            const groupId = await redis.get(key);
            if (groupId) {
              allGroups.add(groupId);
              const userId = key.replace('user:', '');
              if (!userMappings[groupId]) {
                userMappings[groupId] = [];
              }
              userMappings[groupId].push(userId);
            }
          } catch (e) {
            // Key might be wrong type, skip
          }
        }
      } while (cursor !== 0);
    }
    
    const groupData = [];
    
    for (const groupId of allGroups) {
      try {
        const groupSummary = await lineClient.getGroupSummary(groupId);
        const memberCount = await lineClient.getGroupMembersCount(groupId);
        
        groupData.push({
          groupId,
          groupName: groupSummary.groupName,
          totalMembers: memberCount.count,
          mappedUsers: userMappings[groupId] || []
        });
      } catch (error) {
        groupData.push({
          groupId,
          error: error.message,
          mappedUsers: userMappings[groupId] || []
        });
      }
    }
    
    res.json({
      totalGroups: allGroups.size,
      groups: groupData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error generating JSON report', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to generate report',
      message: error.message 
    });
  }
});

function generateGroupReportHTML(groups, errors) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>LINE Groups Member Report</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #00B900; padding-bottom: 10px; margin-bottom: 20px; }
        h1 { color: #00B900; }
        .group-card { border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 6px; background: #fafafa; }
        .group-header { display: flex; align-items: center; margin-bottom: 15px; }
        .group-image { width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; }
        .group-info { flex: 1; }
        .group-name { font-size: 18px; font-weight: bold; color: #333; }
        .group-id { font-size: 12px; color: #666; font-family: monospace; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 10px 0; }
        .stat { background: white; padding: 10px; border-radius: 4px; }
        .stat-label { font-size: 11px; color: #666; text-transform: uppercase; }
        .stat-value { font-size: 20px; font-weight: bold; color: #00B900; }
        .members-section { margin-top: 15px; }
        .member { display: flex; align-items: center; padding: 8px; background: white; margin: 5px 0; border-radius: 4px; }
        .member-avatar { width: 30px; height: 30px; border-radius: 50%; margin-right: 10px; }
        .member-name { flex: 1; }
        .member-id { font-size: 11px; color: #999; }
        .error-card { background: #fee; border-color: #fcc; }
        .summary { background: #00B900; color: white; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .summary-item { text-align: center; }
        .summary-value { font-size: 28px; font-weight: bold; }
        .summary-label { font-size: 12px; opacity: 0.9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 LINE Groups Member Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">${groups.length}</div>
                    <div class="summary-label">Active Groups</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${groups.reduce((sum, g) => sum + (g.humanMemberCount || 0), 0)}</div>
                    <div class="summary-label">Total Human Members</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${groups.reduce((sum, g) => sum + g.mappedUserCount, 0)}</div>
                    <div class="summary-label">Mapped Users</div>
                </div>
            </div>
        </div>
        
        ${groups.map(group => `
            <div class="group-card">
                <div class="group-header">
                    ${group.pictureUrl ? 
                      `<img src="${group.pictureUrl}" class="group-image" onerror="this.style.display='none'">` : 
                      '<div class="group-image" style="background:#00B900;color:white;display:flex;align-items:center;justify-content:center;font-size:24px;">👥</div>'
                    }
                    <div class="group-info">
                        <div class="group-name">${group.groupName}</div>
                        <div class="group-id">${group.groupId}</div>
                    </div>
                </div>
                
                <div class="stats">
                    <div class="stat">
                        <div class="stat-label">Total Members</div>
                        <div class="stat-value">${group.memberCount}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Human Members</div>
                        <div class="stat-value">${group.humanMemberCount}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Mapped Users</div>
                        <div class="stat-value">${group.mappedUserCount}</div>
                    </div>
                </div>
                
                ${group.memberProfiles && group.memberProfiles.length > 0 ? `
                    <div class="members-section">
                        <h4>Sample Members:</h4>
                        ${group.memberProfiles.map(member => `
                            <div class="member">
                                ${member.pictureUrl ? 
                                  `<img src="${member.pictureUrl}" class="member-avatar" onerror="this.style.display='none'">` :
                                  '<div class="member-avatar" style="background:#ddd;"></div>'
                                }
                                <div>
                                    <div class="member-name">${member.displayName}</div>
                                    <div class="member-id">${member.userId.substring(0, 20)}...</div>
                                </div>
                            </div>
                        `).join('')}
                        ${group.humanMemberCount > group.memberProfiles.length ? 
                          `<p style="text-align:center;color:#666;font-size:12px;">... and ${group.humanMemberCount - group.memberProfiles.length} more members</p>` : 
                          ''
                        }
                    </div>
                ` : ''}
            </div>
        `).join('')}
        
        ${errors.length > 0 ? `
            <div class="error-card group-card">
                <h3>⚠️ Groups with Errors:</h3>
                ${errors.map(err => `
                    <div style="margin:10px 0;">
                        <strong>${err.groupId}</strong><br>
                        Error: ${err.error} (${err.statusCode || 'Unknown'})
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        <div style="margin-top:30px;padding:15px;background:#f0f0f0;border-radius:6px;">
            <h4>📝 Notes:</h4>
            <ul style="font-size:14px;color:#666;">
                <li>Member counts exclude the bot itself</li>
                <li>Only showing first 5 members per group to avoid rate limits</li>
                <li>Large groups may not return full member lists</li>
                <li>"Mapped Users" are users who have triggered webhooks</li>
            </ul>
        </div>
    </div>
</body>
</html>
  `;
}

module.exports = router;