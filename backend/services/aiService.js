// services/aiService.js
const axios = require('axios');
const config = require('../config/default');

class AIService {
  constructor() {
    this.maxTokens = 500;
    this.model = config.deepseek.model;
    this.apiKey = config.deepseek.apiKey;
    this.apiUrl = config.deepseek.apiUrl;
  }

  // 检查 API 密钥是否配置
  validateApiKey() {
    if (!this.apiKey || this.apiKey.includes('YOUR_DEEPSEEK_API_KEY')) {
      throw new Error('DeepSeek API key not configured. Please set DEEPSEEK_API_KEY environment variable.');
    }
  }

  // 构建系统提示
  buildSystemPrompt() {
    return `你是一个医院挂号系统的智能助手。你的职责是：
1. 帮助患者了解挂号流程、科室信息、医生排班
2. 根据患者的需求推荐相关功能和页面
3. 帮助患者填写挂号表单，提供必要的信息建议
4. 提供医疗咨询建议（简单的健康知识普及）

可用的功能页面包括：
- 挂号预约 (/pages/register/register) - 进行挂号预约
- 医生查询 (/pages/docProfile/docProfile) - 查看医生信息
- 预约查询 (/pages/appointment/appointment) - 查看已有预约
- 订单查询 (/pages/orders/orders) - 查看订单费用
- 支付 (/pages/payment/payment) - 进行支付
- 个人信息 (/pages/info/info) - 管理个人资料

在回复中，如果需要引导用户进行操作，可以在消息中包含以下格式的链接：
[链接文本]{action: "navigate", url: "/pages/xxx/xxx", label: "页面名称"}

在帮助填写表单时，可以提供结构化的建议：
{action: "fillForm", formData: {field1: "value1", field2: "value2"}}

请用友好、专业的语气与用户交互，每条回复保持在100-200字之间。`;
  }

  // 解析 AI 回复中的操作
  parseActions(text) {
    const actions = [];
    
    // 查找导航链接 [text]{action: "navigate", url: "xxx"}
    const navPattern = /\[([^\]]+)\]\{action:\s*"navigate",\s*url:\s*"([^"]+)",\s*label:\s*"([^"]+)"\}/g;
    let match;
    while ((match = navPattern.exec(text)) !== null) {
      actions.push({
        type: 'navigate',
        label: match[1],
        url: match[2],
        pageName: match[3]
      });
    }

    // 查找表单填充 {action: "fillForm", formData: {...}}
    const formPattern = /\{action:\s*"fillForm",\s*formData:\s*({[^}]+})\}/g;
    while ((match = formPattern.exec(text)) !== null) {
      try {
        actions.push({
          type: 'fillForm',
          formData: JSON.parse(match[1])
        });
      } catch (e) {
        console.error('Failed to parse form data:', e);
      }
    }

    return actions;
  }

  // 清理回复文本中的操作格式
  cleanReplyText(text) {
    // 移除操作格式，保留用户可读的文本
    return text
      .replace(/\[([^\]]+)\]\{action:[^}]+\}/g, '$1')
      .replace(/\{action:\s*"fillForm",\s*formData:\s*\{[^}]*\}\s*\}/g, '')
      .trim();
  }

  // 调用 DeepSeek API
  async callDeepSeekAPI(messages) {
    try {
      this.validateApiKey();

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: messages,
          max_tokens: this.maxTokens,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      }

      throw new Error('Invalid response format from DeepSeek API');
    } catch (error) {
      if (error.response) {
        console.error('DeepSeek API error:', error.response.status, error.response.data);
        throw new Error(`AI service error: ${error.response.data?.error?.message || 'Unknown error'}`);
      }
      throw error;
    }
  }

  // 主聊天方法
  async chat(userMessage, conversationContext = []) {
    try {
      // 构建消息历史
      const messages = [
        {
          role: 'system',
          content: this.buildSystemPrompt()
        },
        ...conversationContext.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: userMessage
        }
      ];

      // 调用 DeepSeek API
      const aiResponse = await this.callDeepSeekAPI(messages);

      // 解析操作
      const actions = this.parseActions(aiResponse);
      
      // 清理回复文本
      const cleanReply = this.cleanReplyText(aiResponse);

      return {
        reply: cleanReply,
        actions: actions,
        suggestions: this.getSuggestions()
      };
    } catch (error) {
      console.error('Chat error:', error);
      
      // 返回降级响应
      return {
        reply: error.message.includes('not configured') 
          ? '抱歉，AI 服务暂未配置。请联系管理员配置 DeepSeek API。'
          : '抱歉，我遇到了一些问题。请重试或选择下方的快捷功能。',
        actions: [],
        suggestions: this.getSuggestions()
      };
    }
  }

  // 获取快捷建议
  getSuggestions() {
    return [
      {
        label: '我要挂号',
        icon: '📋',
        message: '我想进行挂号预约'
      },
      {
        label: '查看医生',
        icon: '👨‍⚕️',
        message: '我想查看医生信息和排班'
      },
      {
        label: '查看预约',
        icon: '📅',
        message: '我想查看我的预约记录'
      },
      {
        label: '支付费用',
        icon: '💳',
        message: '我需要支付挂号费用'
      },
      {
        label: '体检建议',
        icon: '🏥',
        message: '请提供一些健康体检建议'
      }
    ];
  }
}

module.exports = new AIService();
