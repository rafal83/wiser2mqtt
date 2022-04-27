FROM node:14-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm install
COPY ./main.js ./main.js
CMD [ "node", "./main.js"]
