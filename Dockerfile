FROM node:18-alpine

WORKDIR /app

COPY . /app

RUN cd server && npm install

CMD ["node", "server/index.js"]
