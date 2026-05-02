# Usamos una imagen de Node limpia y ligera
FROM node:20-slim

# Creamos la carpeta de la app
WORKDIR /app

# Solo copiamos los archivos de configuración primero (optimiza el build)
COPY package*.json ./

# Instalamos solo lo necesario (Express, Axios, Morgan)
RUN npm install --production

# Copiamos el resto del código
COPY . .

# Puerto de Railway
EXPOSE 8080

# Comando de arranque
CMD ["node", "index.js"]
