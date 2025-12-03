# --- Build Stage ---
FROM node:22-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install tailwindcss @tailwindcss/vite

COPY . .
RUN npm run build

# --- Production Stage ---
FROM nginx:alpine

# 1. 建立資料夾 (確保路徑存在)
RUN mkdir -p /usr/share/nginx/html/RAG-UI

# 2. 複製檔案到 "RAG-UI" 資料夾內
# ⚠️ 請注意：這裡是把 dist 裡面的內容，丟進 RAG-UI 資料夾
COPY --from=builder /app/dist /usr/share/nginx/html/RAG-UI

# 3. 複製 Nginx 設定
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]