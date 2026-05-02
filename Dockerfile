FROM node:20
WORKDIR /app

# Instalamos las dependencias necesarias para que corra el navegador
RUN apt-get update && apt-get install -y \
    libgbm-dev \
    libnss3 \
    libasound2 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

# Instalamos el navegador Chromium y sus dependencias internas
RUN npx playwright install --with-deps chromium

COPY . .

# Railway usa el puerto 8080 por defecto
EXPOSE 8080

CMD ["node", "index.js"]
