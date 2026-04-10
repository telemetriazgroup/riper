FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/uploads/avatars

ENV NODE_ENV=production
ENV UPLOAD_DIR=uploads
EXPOSE 4000

CMD ["node", "src/index.js"]
