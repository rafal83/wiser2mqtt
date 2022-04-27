FROM node:14-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm install
COPY ./main.js ./mains.js
CMD [ "node", "./main.js"]
