FROM mcr.microsoft.com/playwright:v1.45.0-focal
WORKDIR /app
COPY . .
RUN npm install
# Instalamos los navegadores dentro del contenedor para que no falten
RUN npx playwright install chromium --with-deps
CMD ["node", "index.js"]
