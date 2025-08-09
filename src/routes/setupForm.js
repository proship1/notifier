const express = require('express');
const { validateSetupSession, completeSetup } = require('../utils/setupManager');
const logger = require('../utils/logger');

const router = express.Router();

// Setup form page
router.get('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { token } = req.query;

  if (!token) {
    return res.status(400).render('error', {
      title: 'ข้อผิดพลาด',
      message: 'ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากบอท',
      buttonText: 'กลับไปที่ LINE',
      buttonUrl: 'https://line.me'
    });
  }

  try {
    const validation = await validateSetupSession(groupId, token);
    
    if (!validation.valid) {
      let errorMessage = 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
      
      switch (validation.reason) {
        case 'session_not_found':
          errorMessage = 'ไม่พบข้อมูลการตั้งค่า กรุณาขอลิงก์ใหม่จากบอท';
          break;
        case 'invalid_token':
          errorMessage = 'ลิงก์ไม่ถูกต้อง กรุณาใช้ลิงก์ที่ได้รับจากบอท';
          break;
        case 'session_already_used':
          errorMessage = 'ลิงก์นี้ถูกใช้งานแล้ว หากต้องการตั้งค่าใหม่ กรุณาพิมพ์ "ตั้งค่า" ใหม่ในกลุ่ม';
          break;
        case 'session_expired':
          errorMessage = 'ลิงก์หมดอายุแล้ว (30 นาที) กรุณาพิมพ์ "ตั้งค่า" ใหม่ในกลุ่ม';
          break;
      }

      return res.status(400).render('error', {
        title: 'ไม่สามารถตั้งค่าได้',
        message: errorMessage,
        buttonText: 'กลับไปที่ LINE',
        buttonUrl: 'https://line.me'
      });
    }

    res.render('setup', {
      title: 'ตั้งค่าระบบแจ้งเตือน',
      groupId: groupId,
      token: token
    });

  } catch (error) {
    logger.error('Setup form error', { error: error.message, groupId, token });
    res.status(500).render('error', {
      title: 'เกิดข้อผิดพลาด',
      message: 'เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง',
      buttonText: 'ลองใหม่',
      buttonUrl: req.originalUrl
    });
  }
});

// Handle setup form submission
router.post('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { token, userId, apiKey } = req.body;

  if (!token || !userId || !apiKey) {
    return res.status(400).json({
      success: false,
      error: 'กรุณากรอกข้อมูลให้ครบถ้วน'
    });
  }

  try {
    const validation = await validateSetupSession(groupId, token);
    
    if (!validation.valid) {
      let errorMessage = 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
      
      switch (validation.reason) {
        case 'session_not_found':
          errorMessage = 'ไม่พบข้อมูลการตั้งค่า';
          break;
        case 'invalid_token':
          errorMessage = 'ลิงก์ไม่ถูกต้อง';
          break;
        case 'session_already_used':
          errorMessage = 'ลิงก์นี้ถูกใช้งานแล้ว';
          break;
        case 'session_expired':
          errorMessage = 'ลิงก์หมดอายุแล้ว';
          break;
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

    // Validate input formats
    if (!userId.startsWith('user-') || userId.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'รหัสผู้ใช้ไม่ถูกต้อง ควรขึ้นต้นด้วย "user-" และมีความยาวมากกว่า 10 ตัวอักษร'
      });
    }

    if (!apiKey.startsWith('eyJ') || apiKey.length < 50) {
      return res.status(400).json({
        success: false,
        error: 'รหัส API ไม่ถูกต้อง ควรขึ้นต้นด้วย "eyJ" และมีความยาวมากกว่า 50 ตัวอักษร'
      });
    }

    // Complete the setup
    const success = await completeSetup(groupId, userId.trim(), apiKey.trim());
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง'
      });
    }

    logger.info('Setup completed successfully', { groupId, userId });

    res.json({
      success: true,
      message: 'ตั้งค่าเสร็จสิ้น! ตอนนี้คุณจะได้รับการแจ้งเตือนในกลุ่มนี้แล้ว'
    });

  } catch (error) {
    logger.error('Setup submission error', { error: error.message, groupId, userId });
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง'
    });
  }
});

module.exports = router;