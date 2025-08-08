// Temporary script to get LINE Group ID
// Run this locally to find your group ID

const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

app.post('/line', (req, res) => {
  console.log('=== LINE EVENT RECEIVED ===');
  console.log(JSON.stringify(req.body, null, 2));
  
  if (req.body.events) {
    req.body.events.forEach(event => {
      if (event.source?.groupId) {
        console.log('\n🎯 GROUP ID FOUND:', event.source.groupId);
        console.log('Copy this ID to your .env file as LINE_GROUP_ID\n');
      }
    });
  }
  
  res.status(200).send('OK');
});

const port = 3001;
app.listen(port, () => {
  console.log(`Group ID finder running on port ${port}`);
  console.log('\n1. Use ngrok to expose this port: ngrok http 3001');
  console.log('2. Set the ngrok URL as webhook in LINE Developer Console');
  console.log('3. Send a message in your LINE group');
  console.log('4. The Group ID will appear here\n');
});