let swaggerJsdoc;
let swaggerUi;
try {
  swaggerJsdoc = require('swagger-jsdoc');
  swaggerUi = require('swagger-ui-express');
} catch (err) {
  // 如果依赖未安装，降级为 noop 中间件，避免整个服务启动失败
  console.warn('swagger dependencies missing, swagger UI disabled:', err && err.message);
  swaggerJsdoc = null;
  swaggerUi = null;
}
const options = require('./swagger.config');

// 生成 Swagger 规范（如果可用）
const specs = swaggerJsdoc ? swaggerJsdoc(options) : {};

// 自定义 Swagger UI 配置
const swaggerOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
    .swagger-ui .scheme-container { margin: 20px 0 }
    .swagger-ui .opblock-tag { font-size: 16px; font-weight: bold; }
    .swagger-ui .opblock { border-radius: 8px; margin-bottom: 10px; }
    .authorization__btn { display: none }
  `,
  customSiteTitle: '校医院挂号管理系统 API 文档',
  swaggerOptions: {
    persistAuthorization: true, // 保持授权状态
    displayRequestDuration: true, // 显示请求耗时
    defaultModelsExpandDepth: 2, // 模型展开深度
    defaultModelExpandDepth: 2,
    docExpansion: 'list', // 文档展开方式
    filter: true, // 显示过滤器
    showExtensions: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      theme: 'monokai'
    },
    tryItOutEnabled: true, // 启用"Try it out"功能
    validatorUrl: null // 禁用在线验证
  },
  customJs: `
    // 自定义 JavaScript 逻辑
    window.onload = function() {
      // 自动设置服务器地址为当前主机
      const currentHost = window.location.host;
      const select = document.querySelector('.schemes select');
      if (select) {
        Array.from(select.options).forEach(option => {
          if (option.text.includes('localhost')) {
            option.text = option.text.replace('localhost:3000', currentHost);
            option.value = option.value.replace('localhost:3000', currentHost);
          }
        });
      }
      
      // 添加自定义标题
      const title = document.createElement('div');
      title.innerHTML = '<h1 style="color: #1890ff; text-align: center; margin: 20px 0;">🏥 校医院挂号管理系统 API</h1>';
      document.querySelector('.swagger-ui').prepend(title);
    }
  `
};

// Swagger 中间件（如果未安装相关依赖，提供降级 no-op 实现）
let swaggerServe;
let swaggerSetup;
if (swaggerUi) {
  swaggerServe = swaggerUi.serve;
  swaggerSetup = swaggerUi.setup(specs, swaggerOptions);
} else {
  swaggerServe = (req, res, next) => next();
  swaggerSetup = (req, res, next) => (req, res, next)();
}

// 导出 Swagger JSON（可用于其他工具）
const getSwaggerSpec = () => specs;

module.exports = {
  swaggerServe,
  swaggerSetup,
  getSwaggerSpec
};