# 1. Use the official Node.js image
FROM node:20-slim

# 2. Create a folder inside the container for your code
WORKDIR /usr/src/app

# 3. Copy your package files first (this makes builds faster)
COPY package*.json ./

# 4. Install your dependencies
RUN npm install --production

# 5. Copy the rest of your app code
COPY . .

# 6. Tell the container which port your app listens on (usually 8080)
EXPOSE 8080

# 7. The command to start your app
CMD [ "node", "src/index.js" ]