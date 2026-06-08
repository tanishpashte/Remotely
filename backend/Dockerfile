FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the websocket port
EXPOSE 8080

# Run the worker script
CMD ["npm", "start"]
