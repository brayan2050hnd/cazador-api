FROM mcr.microsoft.com/playwright:v1.59.1-focal
WORKDIR /app
COPY . .
RUN npm install
# Forzamos la instalación de las dependencias del navegador
RUN npx playwright install-deps chromium
RUN npx playwright install chromium
CMD ["node", "index.js"]
