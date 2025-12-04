// routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const authMiddleware = require('../middlewares/authMiddleware');

// AI 聊天接口 - 支持未登录用户
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationContext = [] } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        code: 400, 
        msg: '消息内容不能为空' 
      });
    }

    // 调用 AI 服务
    const response = await aiService.chat(message, conversationContext);

    res.json({
      code: 200,
      msg: '成功',
      data: {
        reply: response.reply,
        actions: response.actions,
        suggestions: response.suggestions
      }
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      code: 500,
      msg: error.message || '聊天服务异常，请稍后重试'
    });
  }
});

// AI 获取建议（快捷操作）
router.get('/suggestions', (req, res) => {
  try {
    const suggestions = aiService.getSuggestions();
    res.json({
      code: 200,
      msg: '成功',
      data: suggestions
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      msg: '获取建议失败'
    });
  }
});

module.exports = router;
