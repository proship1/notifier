const express = require('express');
const trackingMonitor = require('../utils/trackingMonitor');
const logger = require('../utils/logger');

const router = express.Router();

// GET /tracking-report - View tracking duplicate statistics
router.get('/', async (req, res) => {
  try {
    const date = req.query.date; // Optional date parameter (YYYY-MM-DD)
    
    const report = await trackingMonitor.getDetailedReport(date);
    
    if (!report.stats) {
      return res.json({
        error: 'No data available',
        message: 'Monitoring data not found for the requested date'
      });
    }
    
    // HTML response for easy viewing
    const html = generateReportHTML(report, date);
    res.send(html);
    
  } catch (error) {
    logger.error('Error generating tracking report', { error: error.message });
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /tracking-report/json - JSON API for tracking statistics
router.get('/json', async (req, res) => {
  try {
    const date = req.query.date; // Optional date parameter (YYYY-MM-DD)
    
    const report = await trackingMonitor.getDetailedReport(date);
    res.json(report);
    
  } catch (error) {
    logger.error('Error getting tracking report JSON', { error: error.message });
    res.status(500).json({ error: 'Failed to get report data' });
  }
});

// GET /tracking-report/stats - Just the statistics
router.get('/stats', async (req, res) => {
  try {
    const date = req.query.date;
    const stats = await trackingMonitor.getStats(date);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting tracking stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /tracking-report/health - Health check for monitoring system
router.get('/health', async (req, res) => {
  try {
    const { getRedisClient } = require('../utils/redisClient');
    const redis = getRedisClient();
    
    if (!redis) {
      return res.status(503).json({ 
        status: 'unhealthy', 
        error: 'Redis not available',
        monitoring: 'disabled'
      });
    }
    
    // Test Redis connectivity
    await redis.ping();
    
    // Get today's stats as a connectivity test
    const stats = await trackingMonitor.getStats();
    
    res.json({
      status: 'healthy',
      monitoring: 'active',
      redis: 'connected',
      todayStats: stats
    });
    
  } catch (error) {
    logger.error('Monitoring health check failed', { error: error.message });
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error.message,
      monitoring: 'degraded'
    });
  }
});

function generateReportHTML(report, date) {
  const { stats, duplicateDetails, duplicateCount, topDuplicates } = report;
  const reportDate = date || new Date().toISOString().split('T')[0];
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Tracking Number Duplicate Report - ${reportDate}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007cba; padding-bottom: 10px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid #007cba; }
        .stat-number { font-size: 24px; font-weight: bold; color: #007cba; }
        .stat-label { color: #666; font-size: 12px; text-transform: uppercase; }
        .duplicate-rate { color: #dc3545; }
        .duplicate-rate.low { color: #28a745; }
        .duplicate-rate.medium { color: #ffc107; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #007cba; color: white; }
        .tracking-number { font-family: monospace; font-weight: bold; }
        .section { margin: 30px 0; }
        .section h3 { color: #007cba; border-bottom: 1px solid #007cba; padding-bottom: 5px; }
        .alert { padding: 15px; border-radius: 6px; margin: 15px 0; }
        .alert.warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
        .alert.success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .refresh-btn { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Tracking Number Duplicate Report</h1>
            <p><strong>Date:</strong> ${reportDate} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${stats.total.toLocaleString()}</div>
                <div class="stat-label">Total Messages</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.unique.toLocaleString()}</div>
                <div class="stat-label">Unique Tracking</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.duplicates.toLocaleString()}</div>
                <div class="stat-label">Duplicate Messages</div>
            </div>
            <div class="stat-card">
                <div class="stat-number duplicate-rate ${getDuplicateRateClass(stats.duplicationRate)}">${stats.duplicationRate}%</div>
                <div class="stat-label">Duplication Rate</div>
            </div>
        </div>
        
        ${stats.duplicationRate > 10 ? 
          '<div class="alert warning">⚠️ <strong>High duplication rate detected!</strong> Consider implementing deduplication logic.</div>' :
          stats.duplicationRate > 0 ? 
          '<div class="alert">ℹ️ Some duplicates detected. Monitoring recommended.</div>' :
          '<div class="alert success">✅ No duplicates detected today.</div>'
        }
        
        ${duplicateCount > 0 ? `
        <div class="section">
            <h3>🔍 Top Duplicate Tracking Numbers</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>Tracking Number</th>
                        <th>Occurrences</th>
                        <th>Unique Orders</th>
                        <th>Unique Users</th>
                    </tr>
                </thead>
                <tbody>
                    ${topDuplicates.map(dup => `
                        <tr>
                            <td class="tracking-number">${dup.trackingNo}</td>
                            <td>${dup.count}</td>
                            <td>${dup.orders.length}</td>
                            <td>${dup.users.length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <div class="section">
            <h3>📈 API Endpoints</h3>
            <ul>
                <li><a href="/tracking-report/json?date=${reportDate}">JSON API</a> - Get raw data</li>
                <li><a href="/tracking-report/stats?date=${reportDate}">Stats Only</a> - Just the numbers</li>
                <li><a href="/tracking-report?date=${new Date(Date.now() - 86400000).toISOString().split('T')[0]}">Yesterday's Report</a></li>
            </ul>
        </div>
        
        <div class="section">
            <h3>💡 Recommendations</h3>
            <ul>
                ${stats.duplicationRate > 15 ? '<li>🔴 High duplication rate - implement Redis-based deduplication immediately</li>' : ''}
                ${stats.duplicationRate > 5 && stats.duplicationRate <= 15 ? '<li>🟡 Moderate duplication - monitor closely and consider deduplication</li>' : ''}
                ${stats.duplicates > 0 ? '<li>📊 Enable tracking monitoring in production for 24-48 hours to get accurate baseline</li>' : ''}
                <li>🔍 Check webhook sender configuration for retry logic</li>
                <li>📝 Monitor LINE API usage to ensure duplicates aren\'t consuming quota</li>
            </ul>
        </div>
    </div>
</body>
</html>
  `;
}

function getDuplicateRateClass(rate) {
  if (rate <= 2) return 'low';
  if (rate <= 10) return 'medium';
  return '';
}

module.exports = router;