FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build
EXPOSE 6452
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "6452"]
