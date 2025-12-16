const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     tags: [AI助手]
 *     summary: AI智能聊天
 *     description: 与AI助手进行对话，可以咨询健康问题、挂号流程等
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 example: "感冒了应该挂什么科？"
 *                 description: "用户输入的消息"
 *               conversationContext:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *                 description: "对话上下文，用于保持对话连贯性"
 *                 example: [
 *                   { "role": "user", "content": "你好" },
 *                   { "role": "assistant", "content": "你好，我是校医院AI助手，有什么可以帮助您的吗？" }
 *                 ]
 *     responses:
 *       200:
 *         description: AI回复成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 msg:
 *                   type: string
 *                   example: "成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     reply:
 *                       type: string
 *                       example: "感冒可以挂呼吸内科或全科门诊。如果伴有发热，建议挂发热门诊。"
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [navigate, book, remind]
 *                           label:
 *                             type: string
 *                           data:
 *                             type: object
 *                       example: [
 *                         { "type": "navigate", "label": "查看呼吸内科医生", "data": { "department_id": 5 } },
 *                         { "type": "book", "label": "立即挂号", "data": { "department_id": 5 } }
 *                       ]
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["发烧怎么办", "咳嗽看什么科", "挂号流程"]
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             example:
 *               code: 400
 *               msg: "消息内容不能为空"
 *       500:
 *         description: AI服务异常
 */
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

/**
 * @swagger
 * /api/ai/suggestions:
 *   get:
 *     tags: [AI助手]
 *     summary: 获取快捷建议
 *     description: 获取AI助手的常见问题快捷建议
 *     responses:
 *       200:
 *         description: 成功获取建议列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 msg:
 *                   type: string
 *                   example: "成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                             example: "常见症状"
 *                           questions:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["感冒发烧", "咳嗽咳痰", "头痛头晕"]
 *                     quickActions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                           action:
 *                             type: string
 *                           icon:
 *                             type: string
 *                       example: [
 *                         { "label": "快速挂号", "action": "book", "icon": "calendar" },
 *                         { "label": "查看科室", "action": "departments", "icon": "hospital" }
 *                       ]
 *             example:
 *               code: 200
 *               msg: "成功"
 *               data:
 *                 categories:
 *                   - title: "常见症状"
 *                     questions: ["感冒发烧", "咳嗽咳痰", "头痛头晕", "腹痛腹泻", "皮肤过敏"]
 *                   - title: "挂号咨询"
 *                     questions: ["怎么挂号", "需要带什么证件", "可以取消挂号吗", "挂号费用多少"]
 *                 quickActions:
 *                   - label: "快速挂号"
 *                     action: "book"
 *                     icon: "calendar"
 *                   - label: "查看科室"
 *                     action: "departments"
 *                     icon: "hospital"
 *                   - label: "我的预约"
 *                     action: "my_appointments"
 *                     icon: "list"
 *       500:
 *         description: 获取建议失败
 */
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