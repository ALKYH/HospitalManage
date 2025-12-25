const { expect, sinon, restoreStubs } = require('../../setup');
const aiService = require('../../../services/aiService');
const axios = require('axios');
const config = require('../../../config/default');

describe('aiService', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('validateApiKey', () => {
    it('should throw if apiKey is missing or default', () => {
      const originalKey = aiService.apiKey;
      
      aiService.apiKey = null;
      expect(() => aiService.validateApiKey()).to.throw('DeepSeek API key not configured');

      aiService.apiKey = 'YOUR_DEEPSEEK_API_KEY';
      expect(() => aiService.validateApiKey()).to.throw('DeepSeek API key not configured');

      aiService.apiKey = originalKey; // 恢复原始的 apiKey 配置
    });

    it('should not throw if apiKey is valid', () => {
      const originalKey = aiService.apiKey;
      aiService.apiKey = 'valid-key';
      expect(() => aiService.validateApiKey()).to.not.throw();
      aiService.apiKey = originalKey;
    });
  });

  describe('parseActions', () => {
    it('should parse navigate actions', () => {
      const text = 'Please go to [Register]{action: "navigate", url: "/pages/reg", label: "Register Page"}';
      const actions = aiService.parseActions(text);
      expect(actions).to.have.length(1);
      expect(actions[0]).to.deep.include({
        type: 'navigate',
        label: 'Register',
        url: '/pages/reg',
        pageName: 'Register Page'
      });
    });

    it('should parse fillForm actions', () => {
      const text = 'Here is the form {action: "fillForm", formData: {"name": "John"}}';
      const actions = aiService.parseActions(text);
      expect(actions).to.have.length(1);
      expect(actions[0]).to.deep.include({
        type: 'fillForm',
        formData: { name: 'John' }
      });
    });

    it('should ignore malformed fillForm JSON without throwing', () => {
      const text = 'Bad form {action: "fillForm", formData: {name: "John" }'; // 缺少右大括号
      const actions = aiService.parseActions(text);
      // 解析失败时不会抛异常，只是不添加 fillForm 操作
      expect(actions).to.be.an('array').that.is.empty;
    });
  });

  describe('cleanReplyText', () => {
    it('should remove action markers', () => {
      const text = 'Go to [Link]{action: "navigate", url: "u", label: "l"} and fill {action: "fillForm", formData: {"a": 1}}';
      const cleaned = aiService.cleanReplyText(text);
      expect(cleaned).to.equal('Go to Link and fill');
    });
  });

  describe('callDeepSeekAPI', () => {
    it('should call axios with correct parameters', async () => {
      const originalKey = aiService.apiKey;
      aiService.apiKey = 'test-key';

      const postStub = sinon.stub(axios, 'post').resolves({
        data: {
          choices: [{ message: { content: 'AI Reply' } }]
        }
      });
      stubs.push(postStub);

      const reply = await aiService.callDeepSeekAPI([{ role: 'user', content: 'hi' }]);
      
      expect(reply).to.equal('AI Reply');
      expect(postStub.calledOnce).to.be.true;
      expect(postStub.firstCall.args[0]).to.equal(aiService.apiUrl);
      expect(postStub.firstCall.args[1]).to.have.property('model');
      expect(postStub.firstCall.args[2].headers).to.have.property('Authorization', 'Bearer test-key');

      aiService.apiKey = originalKey;
    });

    it('should handle API errors', async () => {
      const originalKey = aiService.apiKey;
      aiService.apiKey = 'test-key';

      const postStub = sinon.stub(axios, 'post').rejects(new Error('API Error'));
      stubs.push(postStub);

      try {
        await aiService.callDeepSeekAPI([]);
        throw new Error('Expected to throw');
      } catch (e) {
        expect(e.message).to.equal('API Error');
      }

      aiService.apiKey = originalKey;
    });
  });
});
