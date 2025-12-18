# 使用官方 Node 镜像
FROM node:20

# 安装构建依赖，保证 bcrypt 原生模块可编译
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /usr/src/app

# 拷贝 package.json 并安装依赖
COPY package*.json ./

# 安装依赖
RUN npm install

# 拷贝项目文件
COPY . .

# 构建前端静态资源 (新增)
RUN cd admin-vite && npm install && npm run build

# 开发环境建议安装 nodemon 热更新
RUN npm install -g nodemon

# 暴露端口
EXPOSE 3000

# 使用 nodemon 启动（开发环境）或者 node 启动（生产环境可改回 node server.js）
CMD ["nodemon", "server.js"]
