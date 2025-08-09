const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const logger = require('../utils/logger');
const { createSetupSession } = require('../utils/setupManager');

const router = express.Router();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const lineClient = new Client(lineConfig);

// Thai messages (simplified)
const MESSAGES = {
  setupInProgress: {
    type: 'text',
    text: '⚠️ มีลิงก์ตั้งค่าที่ยังใช้งานอยู่!\n\nกรุณาใช้ลิงก์เดิม หรือรอ 30 นาที แล้วพิมพ์ "ตั้งค่า" ใหม่'
  },
  setupError: {
    type: 'text',
    text: '❌ เกิดข้อผิดพลาด!\n\nกรุณาลองพิมพ์ "ตั้งค่า" ใหม่อีกครั้ง'
  }
};

const createSetupMessage = (groupId, setupToken) => {
  const setupUrl = `${process.env.BASE_URL || 'https://webhook-line-notifier.fly.dev'}/setup/${groupId}?token=${setupToken}`;
  
  return {
    type: 'flex',
    altText: 'ลิงก์ตั้งค่าระบบแจ้งเตือน',
    contents: {
      type: 'bubble',
      styles: {
        body: {
          backgroundColor: '#06C755'
        }
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🚀 พร้อมตั้งค่าแล้ว!',
            weight: 'bold',
            size: 'xl',
            color: '#ffffff',
            align: 'center'
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#ffffff'
          },
          {
            type: 'text',
            text: 'คลิกปุ่มด้านล่างเพื่อใส่ข้อมูล',
            size: 'md',
            color: '#ffffff',
            align: 'center',
            margin: 'md',
            wrap: true
          },
          {
            type: 'text',
            text: 'ใส่เพียง 2 อย่าง:',
            size: 'sm',
            color: '#ffffff',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '1️⃣ รหัสผู้ใช้ (User ID)',
            size: 'sm',
            color: '#ffffff',
            margin: 'sm'
          },
          {
            type: 'text',
            text: '2️⃣ รหัส API (API Key)',
            size: 'sm',
            color: '#ffffff',
            margin: 'sm'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        backgroundColor: '#F0F0F0',
        paddingAll: 'md',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'lg',
            action: {
              type: 'uri',
              label: '👉 คลิกที่นี่เพื่อเริ่มตั้งค่า',
              uri: setupUrl
            },
            color: '#06C755'
          },
          {
            type: 'text',
            text: '⚠️ สำคัญ: ลิงก์นี้ใช้ได้ 30 นาทีเท่านั้น!',
            size: 'sm',
            color: '#FF0000',
            align: 'center',
            margin: 'md',
            weight: 'bold'
          }
        ]
      }
    }
  };
};

const handleMessage = async (event) => {
  const { message, source } = event;
  
  // Only handle group messages
  if (source.type !== 'group') {
    return null;
  }
  
  const groupId = source.groupId;
  const messageText = message.text?.trim().toLowerCase();
  
  logger.info('LINE bot message received', { 
    groupId, 
    messageText: message.text,
    messageType: message.type 
  });

  switch (messageText) {
    case 'ตั้งค่า':
    case 'setup':
      try {
        // Check if setup is already in progress
        const existingSession = await require('../utils/setupManager').getSetupSession(groupId);
        if (existingSession && existingSession.status === 'pending') {
          const expiresAt = new Date(existingSession.expiresAt);
          if (Date.now() < expiresAt.getTime()) {
            return MESSAGES.setupInProgress;
          }
        }

        // Create new setup session
        const setupToken = await createSetupSession(groupId);
        if (!setupToken) {
          return MESSAGES.setupError;
        }

        return createSetupMessage(groupId, setupToken);
      } catch (error) {
        logger.error('Failed to handle setup command', { error: error.message, groupId });
        return MESSAGES.setupError;
      }

    // Remove help command since we have immediate setup
    // Keep group id finder for advanced users only

    default:
      // Don't respond to other messages to avoid spam
      return null;
  }
};

const handleJoin = async (event) => {
  const { source } = event;
  
  if (source.type !== 'group') {
    logger.info('Bot joined non-group chat', { sourceType: source.type });
    return null;
  }

  const groupId = source.groupId;
  logger.info('LINE bot joined group - starting setup flow', { groupId });
  
  // Immediately create setup session when bot joins
  try {
    logger.info('Creating setup session for new group', { groupId });
    const setupToken = await createSetupSession(groupId);
    
    if (!setupToken) {
      logger.error('Setup token creation returned null', { groupId });
      return {
        type: 'text',
        text: '❌ เกิดข้อผิดพลาดในการสร้างลิงก์ตั้งค่า\nพิมพ์ "ตั้งค่า" เพื่อลองใหม่'
      };
    }
    
    logger.info('Setup token created successfully', { groupId, token: setupToken.substring(0, 8) + '...' });
    
    // Return properly formatted flex message
    const setupUrl = `${process.env.BASE_URL || 'https://webhook-line-notifier.fly.dev'}/setup/${groupId}?token=${setupToken}`;
    
    return {
      type: 'flex',
      altText: '🎉 ยินดีต้อนรับ! คลิกเพื่อตั้งค่าระบบแจ้งเตือน',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🎉 ยินดีต้อนรับ!',
              weight: 'bold',
              size: 'xl',
              color: '#06C755',
              align: 'center'
            },
            {
              type: 'text',
              text: 'ตั้งค่าระบบแจ้งเตือน ProShip',
              size: 'md',
              color: '#333333',
              align: 'center',
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'xl'
            },
            {
              type: 'text',
              text: 'กรอกข้อมูล 2 อย่างเพื่อเริ่มใช้งาน:',
              size: 'md',
              color: '#666666',
              margin: 'xl',
              align: 'center'
            },
            {
              type: 'text',
              text: '1️⃣ รหัสผู้ใช้ ProShip',
              size: 'sm',
              color: '#666666',
              margin: 'md'
            },
            {
              type: 'text',
              text: '2️⃣ รหัส API Key',
              size: 'sm',
              color: '#666666',
              margin: 'sm'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '👉 คลิกที่นี่เพื่อตั้งค่า',
                uri: setupUrl
              },
              color: '#06C755'
            },
            {
              type: 'text',
              text: '⚠️ ลิงก์นี้ใช้ได้ 30 นาทีเท่านั้น',
              size: 'xs',
              color: '#FF5551',
              align: 'center',
              margin: 'sm'
            }
          ]
        }
      }
    };
  } catch (error) {
    logger.error('Error creating welcome setup message', { 
      error: error.message, 
      stack: error.stack,
      groupId 
    });
    
    // Return simple fallback message
    return {
      type: 'text',
      text: '🎉 ยินดีต้อนรับสู่ระบบแจ้งเตือน ProShip!\n\n📝 พิมพ์ "ตั้งค่า" เพื่อเริ่มใช้งาน'
    };
  }
};

// GET endpoint for testing
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'LINE Bot webhook endpoint is ready',
    description: 'Bot automatically shows setup button when added to group',
    supportedCommands: [
      'ตั้งค่า - Request new setup link if needed'
    ],
    webhookUrl: 'https://webhook-line-notifier.fly.dev/line/webhook'
  });
});

// LINE webhook endpoint
router.post('/', async (req, res) => {
  try {
    // TEMPORARILY DISABLE SIGNATURE VALIDATION FOR TESTING
    // TODO: Re-enable after confirming channel secret matches
    logger.info('LINE webhook validation - temporarily disabled for testing', {
      hasChannelSecret: !!process.env.LINE_CHANNEL_SECRET,
      headers: {
        'x-line-signature': req.headers['x-line-signature'],
        'user-agent': req.headers['user-agent']
      }
    });

    // Validate LINE signature if secrets are available
    // if (process.env.LINE_CHANNEL_SECRET) {
    //   try {
    //     // Use LINE SDK middleware validation
    //     await new Promise((resolve, reject) => {
    //       middleware(lineConfig)(req, res, (err) => {
    //         if (err) reject(err);
    //         else resolve();
    //       });
    //     });
    //   } catch (validationError) {
    //     logger.error('LINE webhook signature validation failed', { 
    //       error: validationError.message,
    //       headers: req.headers
    //     });
    //     return res.status(401).json({ error: 'Invalid signature' });
    //   }
    // } else {
    //   logger.warn('LINE_CHANNEL_SECRET not set - skipping signature validation');
    // }

    // Process events
    const events = req.body.events || [];
    logger.info('LINE webhook received', { eventCount: events.length });
    
    if (events.length === 0) {
      return res.status(200).json({ success: true, message: 'No events to process' });
    }

    const promises = events.map(async (event) => {
      try {
        let replyMessage = null;
        
        logger.info('Processing LINE event', { 
          type: event.type, 
          source: event.source?.type,
          groupId: event.source?.groupId 
        });
        
        switch (event.type) {
          case 'message':
            if (event.message && event.message.type === 'text') {
              replyMessage = await handleMessage(event);
            }
            break;
          case 'join':
            replyMessage = await handleJoin(event);
            break;
          default:
            logger.info('Unhandled LINE event type', { type: event.type });
            break;
        }
        
        if (replyMessage && event.replyToken) {
          logger.info('Sending reply message', { replyToken: event.replyToken });
          await lineClient.replyMessage(event.replyToken, replyMessage);
          logger.info('Reply message sent successfully');
        }
      } catch (eventError) {
        logger.error('Error processing individual event', { 
          error: eventError.message,
          eventType: event.type,
          stack: eventError.stack
        });
        // Don't fail the whole webhook for individual event errors
      }
    });
    
    await Promise.all(promises);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('LINE webhook error', { 
      error: error.message, 
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;