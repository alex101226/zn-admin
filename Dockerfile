# 环境
FROM node:20
# 服务端口
EXPOSE 9090

# 设置工作目录
WORKDIR /app

# 先只拷贝 package.json，利用缓存机制
COPY package*.json ./
RUN npm install

# 再拷贝其他源码
COPY . .

# 创建并切换非 root 用户（可选但推荐）
RUN useradd -m vehicle_admin
USER vehicle_admin

CMD npm run start:prod