#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Fetching logs and analyzing group message distribution...\n');

try {
  // Fetch recent logs (last 1000 lines)
  const logs = execSync('fly logs --app webhook-line-notifier 2>/dev/null || true', {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  });

  const lines = logs.split('\n');
  
  // Track statistics
  const groupCounts = {};
  const userMappings = {};
  let totalMessagesSent = 0;
  let unmappedUsers = 0;
  let duplicatesBlocked = 0;
  
  // Parse each log line
  lines.forEach(line => {
    // Check for successful group mapping and message sending
    const groupMappingMatch = line.match(/User ([\w-]+) mapped to group ([\w-]+)/);
    if (groupMappingMatch) {
      const userId = groupMappingMatch[1];
      const groupId = groupMappingMatch[2];
      userMappings[userId] = groupId;
    }
    
    // Check for successful LINE message sends
    if (line.includes('Message sent to LINE group successfully')) {
      totalMessagesSent++;
      // Try to find the associated group from recent mapping logs
      const timestamp = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      // Look for the most recent group mapping before this message
      for (let i = lines.indexOf(line) - 1; i >= 0 && i > lines.indexOf(line) - 20; i--) {
        const prevLine = lines[i];
        if (prevLine.includes('mapped to group')) {
          const match = prevLine.match(/mapped to group ([\w-]+)/);
          if (match) {
            const groupId = match[1];
            groupCounts[groupId] = (groupCounts[groupId] || 0) + 1;
            break;
          }
        }
      }
    }
    
    // Check for unmapped users
    if (line.includes('User not mapped - skipping message')) {
      unmappedUsers++;
    }
    
    // Check for duplicates blocked
    if (line.includes('Duplicate order detected - skipping LINE message') || 
        line.includes('Duplicate order - LINE message skipped')) {
      duplicatesBlocked++;
    }
  });
  
  // Display results
  console.log('=== GROUP MESSAGE DISTRIBUTION ===\n');
  
  if (Object.keys(groupCounts).length > 0) {
    console.log('Messages sent per group:');
    const sortedGroups = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
    sortedGroups.forEach(([groupId, count]) => {
      const percentage = ((count / totalMessagesSent) * 100).toFixed(1);
      console.log(`  ${groupId}: ${count} messages (${percentage}%)`);
    });
  } else {
    console.log('No group-specific data found in recent logs.');
    console.log('The logs might not contain enough detail or may need to be fetched differently.');
  }
  
  console.log('\n=== SUMMARY STATISTICS ===\n');
  console.log(`Total LINE messages sent: ${totalMessagesSent}`);
  console.log(`Unmapped user requests: ${unmappedUsers}`);
  console.log(`Duplicate orders blocked: ${duplicatesBlocked}`);
  console.log(`Unique groups identified: ${Object.keys(groupCounts).length}`);
  console.log(`Unique user mappings found: ${Object.keys(userMappings).length}`);
  
  // Show sample of user-to-group mappings
  if (Object.keys(userMappings).length > 0) {
    console.log('\n=== SAMPLE USER MAPPINGS ===\n');
    const sampleMappings = Object.entries(userMappings).slice(0, 5);
    sampleMappings.forEach(([userId, groupId]) => {
      console.log(`  ${userId.substring(0, 20)}... → ${groupId}`);
    });
    if (Object.keys(userMappings).length > 5) {
      console.log(`  ... and ${Object.keys(userMappings).length - 5} more`);
    }
  }
  
  console.log('\n=== RECOMMENDATIONS ===\n');
  console.log('For better group-level tracking, consider:');
  console.log('1. Using the /groups-report endpoint for current group statistics');
  console.log('2. Implementing Redis-based group message counters');
  console.log('3. Adding group ID to the tracking monitor statistics');
  
} catch (error) {
  console.error('Error fetching or analyzing logs:', error.message);
  console.log('\nAlternative: Check the /groups-report endpoint for current group information');
  console.log('Visit: https://webhook-line-notifier.fly.dev/groups-report');
}