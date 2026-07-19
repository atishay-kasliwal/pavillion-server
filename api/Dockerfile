FROM node:20-alpine
WORKDIR /app

# unzip: needed by scripts/import-google-takeout.js to extract Takeout exports.
RUN apk add --no-cache unzip

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY public ./public
COPY scripts ./scripts

EXPOSE 8090
CMD ["node", "src/index.js"]
