FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
RUN mkdir -p data
EXPOSE 5000
CMD ["node", "index.js"]
