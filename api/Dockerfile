FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=6453
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /usr/src/app/build ./build
RUN mkdir -p uploads
EXPOSE 6453
CMD ["node", "build/index.js"]
