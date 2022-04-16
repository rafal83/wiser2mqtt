FROM node:14-stretch
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
CMD [ "node", "./main.js"]
