# Usa un'immagine di base di Node.js
FROM node:22

# Imposta la directory di lavoro all'interno del container
WORKDIR /usr/src/app

# Copia il file package.json e package-lock.json (se presente)
COPY package*.json ./

# Installa le dipendenze
RUN npm install

# Copia il resto dell'applicazione nel container
COPY . .

# Espone la porta su cui il server ascolterà
EXPOSE 8080

# Comando per avviare l'applicazione
CMD ["node", "server.js"]
