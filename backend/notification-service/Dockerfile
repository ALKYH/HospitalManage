FROM node:20

WORKDIR /usr/src/app

# Install dependencies first
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
