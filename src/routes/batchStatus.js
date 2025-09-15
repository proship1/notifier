const express = require('express');
const batchManager = require('../utils/batchManager');
const logger = require('../utils/logger');

const router = express.Router();

// GET /batch-status - View current batch status
router.get('/', async (req, res) => {
  try {
    const status = await batchManager.getBatchStatus();
    
    if (status.error) {
      return res.status(503).json(status);
    }

    // HTML response for easy viewing
    const html = generateStatusHTML(status);
    res.send(html);
    
  } catch (error) {
    logger.error('Error getting batch status', { error: error.message });
    res.status(500).json({ error: 'Failed to get batch status' });
  }
});

// GET /batch-status/json - JSON API for batch status
router.get('/json', async (req, res) => {
  try {
    const status = await batchManager.getBatchStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting batch status JSON', { error: error.message });
    res.status(500).json({ error: 'Failed to get batch status' });
  }
});

// POST /batch-status/flush - Emergency flush all batches
router.post('/flush', async (req, res) => {
  try {
    logger.warn('Emergency batch flush requested', { 
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    const result = await batchManager.flushAllBatches();
    res.json(result);
  } catch (error) {
    logger.error('Error flushing batches', { error: error.message });
    res.status(500).json({ error: 'Failed to flush batches' });
  }
});

// GET /batch-status/stats - Just the statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = batchManager.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting batch stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get batch stats' });
  }
});

function generateStatusHTML(status) {
  const { batches, stats, config } = status;
  const totalPending = batches.reduce((sum, batch) => sum + batch.messageCount, 0);
  const batchSize = config?.batchSize || 10;
  const batchInterval = config?.batchInterval || 300000;
  const enabled = config?.enabled || false;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Batch Manager Status</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007cba; padding-bottom: 10px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid #007cba; }
        .stat-number { font-size: 24px; font-weight: bold; color: #007cba; }
        .stat-label { color: #666; font-size: 12px; text-transform: uppercase; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #007cba; color: white; }
        .section { margin: 30px 0; }
        .section h3 { color: #007cba; border-bottom: 1px solid #007cba; padding-bottom: 5px; }
        .alert { padding: 15px; border-radius: 6px; margin: 15px 0; }
        .alert.info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        .alert.success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .alert.warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
        .button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        .button.danger { background: #dc3545; }
        .enabled { color: #28a745; font-weight: bold; }
        .disabled { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 Batch Manager Status</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()} |
               <strong>Batching:</strong> <span class="${enabled ? 'enabled' : 'disabled'}">
               ${enabled ? 'ENABLED' : 'DISABLED'}</span></p>
            <button class="button" onclick="location.reload()">🔄 Refresh</button>
            <button class="button danger" onclick="flushBatches()">⚡ Flush All Batches</button>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${stats.batchesSent.toLocaleString()}</div>
                <div class="stat-label">Batches Sent</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.messagesBatched.toLocaleString()}</div>
                <div class="stat-label">Messages Batched</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.fallbacksSent.toLocaleString()}</div>
                <div class="stat-label">Fallback Sends</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalPending}</div>
                <div class="stat-label">Pending Messages</div>
            </div>
        </div>

        ${!enabled ? 
          '<div class="alert info">ℹ️ <strong>Batching is currently DISABLED.</strong> All messages are being sent immediately.</div>' :
          totalPending === 0 ?
          '<div class="alert success">✅ <strong>No pending batches.</strong> All messages are being processed normally.</div>' :
          '<div class="alert warning">⏳ <strong>Batches pending processing.</strong> Messages will be sent when batch conditions are met.</div>'
        }
        
        ${batches.length > 0 ? `
        <div class="section">
            <h3>📦 Current Batches</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>Group ID</th>
                        <th>Messages</th>
                        <th>Timer Active</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${batches.map(batch => `
                        <tr>
                            <td>${batch.groupId.substring(0, 8)}...</td>
                            <td>${batch.messageCount}/${batchSize}</td>
                            <td>${batch.hasTimer ? '⏰ Yes' : '❌ No'}</td>
                            <td>${batch.messageCount >= batchSize ? '🔥 Full (will send soon)' : '⏳ Waiting'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <div class="section">
            <h3>📊 Configuration</h3>
            <ul>
                <li><strong>Batch Size:</strong> ${batchSize} messages</li>
                <li><strong>Batch Interval:</strong> ${(batchInterval / 1000 / 60)} minutes</li>
                <li><strong>Enabled:</strong> ${enabled ? 'Yes' : 'No'}</li>
            </ul>
        </div>

        <div class="section">
            <h3>🔗 API Endpoints</h3>
            <ul>
                <li><a href="/batch-status/json">JSON Status</a> - Raw data</li>
                <li><a href="/batch-status/stats">Statistics Only</a> - Just the numbers</li>
                <li><a href="#" onclick="flushBatches()">Flush All Batches</a> - Emergency action</li>
            </ul>
        </div>
    </div>

    <script>
        async function flushBatches() {
            if (!confirm('Are you sure you want to flush all pending batches? This will send all queued messages immediately.')) {
                return;
            }
            
            try {
                const response = await fetch('/batch-status/flush', { method: 'POST' });
                const result = await response.json();
                
                if (result.success) {
                    alert(\`Successfully flushed \${result.batchesFlushed} batches\`);
                    location.reload();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
    </script>
</body>
</html>
  `;
}

module.exports = router;