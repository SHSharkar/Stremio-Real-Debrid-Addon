FROM node:22

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 62316

ENV PORT=62316

CMD ["npm", "start"]
