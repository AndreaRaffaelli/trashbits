# Trashbits cloud deployment

## Frontend

Questo modulo di applicazione gestirà la creazione di nuove sessioni di gioco e l'accesso a sessioni esistenti. Useremo anche un semplice sistema di routing per gestire le richieste.

### Struttura del Progetto

Ecco come potrebbe apparire la struttura del progetto:

```
game-frontend/
├── package.json
├── server.js
└── public/
    ├── index.html
    └── style.css
```

### 1. Creazione del Progetto

Inizia creando una nuova cartella per il tuo progetto e naviga al suo interno:

```bash
mkdir game-frontend
cd game-frontend
```

Inizializza un nuovo progetto Node.js:

```bash
npm init -y
```

Installa le dipendenze necessarie:

```bash
npm install express axios
```

### 2. Creazione del Server

Crea un file chiamato `server.js` e aggiungi il seguente codice:

```javascript
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware per il parsing del corpo delle richieste
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servire i file statici
app.use(express.static(path.join(__dirname, 'public')));

// Rotta per creare una nuova sessione di gioco
app.post('/api/start-game', async (req, res) => {
    try {
        // Genera un codice di sessione unico
        const sessionCode = Math.random().toString(36).substring(2, 8);

        // Invia una richiesta al backend per avviare un nuovo container di gioco
        const response = await axios.post('http://backend-service/api/create-game', { sessionCode });

        // Restituisci l'URL del container di gioco
        res.json({ sessionCode, gameUrl: response.data.gameUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Errore nella creazione della sessione di gioco' });
    }
});

// Rotta per accedere a una sessione esistente
app.post('/api/join-game', async (req, res) => {
    const { sessionCode } = req.body;

    try {
        // Verifica il codice di sessione con il backend
        const response = await axios.get(`http://backend-service/api/get-game/${sessionCode}`);

        // Restituisci l'URL del container di gioco
        res.json({ gameUrl: response.data.gameUrl });
    } catch (error) {
        console.error(error);
        res.status(404).json({ error: 'Sessione di gioco non trovata' });
    }
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
```

### 3. Creazione della Pagina HTML

Crea una cartella chiamata `public` e all'interno di essa crea un file chiamato `index.html`:

```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gioco WebApp</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Benvenuto nel Gioco!</h1>
    <div>
        <h2>Inizia una nuova partita</h2>
        <button id="start-game">Inizia Gioco</button>
        <p id="new-game-message"></p>
    </div>
    <div>
        <h2>Unisciti a una partita esistente</h2>
        <input type="text" id="session-code" placeholder="Inserisci il codice di sessione">
        <button id="join-game">Unisciti</button>
        <p id="join-game-message"></p>
    </div>

    <script>
        document.getElementById('start-game').addEventListener('click', async () => {
            const response = await fetch('/api/start-game', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                document.getElementById('new-game-message').innerText = `Partita iniziata! Codice: ${data.sessionCode}. Vai a: ${data.gameUrl}`;
            } else {
                document.getElementById('new-game-message').innerText = data.error;
            }
        });

        document.getElementById('join-game').addEventListener('click', async
```

## Backend

Questo modulo si occuperà di avviare i container di gioco utilizzando l'API di Kubernetes e di gestire le richieste dal frontend.

### Struttura del Progetto

Ecco come potrebbe apparire la struttura del progetto per il backend:

```
game-backend/
├── package.json
├── server.js
└── gameSessions.js
```

### 1. Creazione del Progetto

Inizia creando una nuova cartella per il tuo progetto backend e naviga al suo interno:

```bash
mkdir game-backend
cd game-backend
```

Inizializza un nuovo progetto Node.js:

```bash
npm init -y
```

Installa le dipendenze necessarie:

```bash
npm install express axios @kubernetes/client-node
```

### 2. Creazione del Server

Crea un file chiamato `server.js` e aggiungi il seguente codice:

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const { KubeConfig, CoreV1Api } = require('@kubernetes/client-node');
const { createGameContainer } = require('./gameSessions');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware per il parsing del corpo delle richieste
app.use(bodyParser.json());

// Configurazione di Kubernetes
const kubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();
const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

// Memoria per le sessioni di gioco
const gameSessions = {};

// Rotta per creare una nuova sessione di gioco
app.post('/api/create-game', async (req, res) => {
    const { sessionCode } = req.body;

    try {
        // Crea un nuovo container di gioco
        const gameUrl = await createGameContainer(sessionCode, k8sApi);
        
        // Salva la sessione di gioco
        gameSessions[sessionCode] = { gameUrl, status: 'active' };

        res.json({ gameUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Errore nella creazione della sessione di gioco' });
    }
});

// Rotta per ottenere informazioni su una sessione di gioco esistente
app.get('/api/get-game/:sessionCode', (req, res) => {
    const { sessionCode } = req.params;

    const session = gameSessions[sessionCode];
    if (session) {
        res.json({ gameUrl: session.gameUrl });
    } else {
        res.status(404).json({ error: 'Sessione di gioco non trovata' });
    }
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
```

### 3. Creazione della Logica per i Container di Gioco

Crea un file chiamato `gameSessions.js` e aggiungi il seguente codice:

```javascript
const { V1Pod, V1ObjectMeta, V1PodSpec, V1Container } = require('@kubernetes/client-node');

async function createGameContainer(sessionCode, k8sApi) {
    const namespace = 'default'; // Cambia il namespace se necessario
    const podName = `game-${sessionCode}`;

    const container = new V1Container();
    container.name = 'game-container';
    container.image = 'your-game-image:latest'; // Sostituisci con l'immagine del tuo gioco
    container.ports = [{ containerPort: 8080 }]; // Cambia la porta se necessario

    const podSpec = new V1PodSpec();
    podSpec.containers = [container];

    const podMetadata = new V1ObjectMeta();
    podMetadata.name = podName;

    const pod = new V1Pod();
    pod.metadata = podMetadata;
    pod.spec = podSpec;

    // Crea il pod in Kubernetes
    await k8sApi.createNamespacedPod(namespace, pod);

    // Restituisci l'URL del gioco (modifica in base alla tua configurazione)
    return `http://<kubernetes-service-ip>:8080`; // Sostituisci con l'IP del tuo servizio Kubernetes
}

module.exports = { createGameContainer };
```

### 4. Configurazione di Kubernetes

Assicurati di avere un cluster Kubernetes in esecuzione e di avere configurato `kubectl` per accedere al tuo cluster. Dovrai anche avere un'immagine Docker del tuo gioco disponibile in un registro accessibile dal cluster Kubernetes.

### 5. Avvio del Backend

Per avviare il backend, esegui il seguente comando:

```bash
node server.js
```
## Deployment Kubernetes

Alcune configurazioni fondamentali per Kubernetes: Deployment e un Service. Configurazione per il Frontend, Backend e il contenitore di gioco.

### 1. Configurazione del Deployment per il Frontend
Crea un file chiamato frontend-deployment.yaml e aggiungi il seguente codice

``` yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-frontend
spec:
  replicas: 2  # Numero di repliche
  selector:
    matchLabels:
      app: game-frontend
  template:
    metadata:
      labels:
        app: game-frontend
    spec:
      containers:
      - name: game-frontend
        image: your-frontend-image:latest  # Sostituisci con l'immagine del tuo frontend
        ports:
        - containerPort: 3000  # Porta esposta dal frontend
        env:
        - name: BACKEND_URL
          value: "http://game-backend:3000"  # URL del backend
``` 
### 2. Configurazione del Service per il Frontend

Crea un file chiamato frontend-service.yaml e aggiungi il seguente codice:

```yaml 
apiVersion: v1
kind: Service
metadata:
  name: game-frontend
spec:
  type: LoadBalancer  # Tipo di servizio per esporre il frontend
  ports:
  - port: 80  # Porta esposta
    targetPort: 3000  # Porta del container
  selector:
    app: game-frontend
```

### 3. Configurazione del Deployment per il Backend

Crea un file chiamato `backend-deployment.yaml` e aggiungi il seguente codice:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-backend
spec:
  replicas: 2  # Numero di repliche
  selector:
    matchLabels:
      app: game-backend
  template:
    metadata:
      labels:
        app: game-backend
    spec:
      containers:
      - name: game-backend
        image: your-backend-image:latest  # Sostituisci con l'immagine del tuo backend
        ports:
        - containerPort: 3000  # Porta esposta dal backend
        env:
        - name: NODE_ENV
          value: "production"
```

### 4. Configurazione del Service per il Backend

Crea un file chiamato `backend-service.yaml` e aggiungi il seguente codice:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: game-backend
spec:
  type: ClusterIP  # Tipo di servizio, può essere cambiato in LoadBalancer se necessario
  ports:
  - port: 3000
    targetPort: 3000
  selector:
    app: game-backend
```

### 5. Configurazione del Deployment per il Container di Gioco

Crea un file chiamato `game-deployment.yaml` e aggiungi il seguente codice:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-container
spec:
  replicas: 0  # Inizialmente nessuna replica, verrà creata dinamicamente
  selector:
    matchLabels:
      app: game-container
  template:
    metadata:
      labels:
        app: game-container
    spec:
      containers:
      - name: game-container
        image: your-game-image:latest  # Sostituisci con l'immagine del tuo gioco
        ports:
        - containerPort: 8080  # Porta esposta dal container di gioco
```

### 6. Configurazione del Service per il Container di Gioco

Crea un file chiamato `game-service.yaml` e aggiungi il seguente codice:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: game-service
spec:
  type: NodePort  # Tipo di servizio per esporre il container di gioco
  ports:
  - port: 8080
    targetPort: 8080
    nodePort: 30001  # Porta esposta sul nodo
  selector:
    app: game-container
```

### 7. Applicazione delle Configurazioni

Dopo aver creato i file di configurazione, puoi applicarli al tuo cluster Kubernetes utilizzando il comando `kubectl apply`. Esegui i seguenti comandi:

```bash
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f game-deployment.yaml
kubectl apply -f game-service.yaml
```

### 6. Accesso al Frontend, Backend e ai Container di Gioco

- Frontend: Se hai configurato il servizio come LoadBalancer, puoi ottenere l'IP pubblico del tuo servizio frontend utilizzando il comando:
    ```bash
    kubectl get services
    ``` 
    Cerca l'IP esterno associato al servizio game-frontend. Se stai eseguendo il tuo cluster localmente (ad esempio, con Minikube), puoi utilizzare minikube service game-frontend per ottenere l'URL.
- **Backend**: Puoi accedere al tuo backend utilizzando il servizio `game-backend`. Se stai eseguendo il tuo cluster localmente (ad esempio, con Minikube), puoi utilizzare `minikube service game-backend` per ottenere l'URL.
  
- **Container di Gioco**: I container di gioco verranno creati dinamicamente dal backend quando un utente inizia una nuova partita. Puoi accedere ai container di gioco utilizzando l'IP del nodo e la porta specificata nel servizio `game-service`.

## To Do

Trovare un meccanismo per terminare i container di gioco quando la partita è finita. Questo potrebbe essere fatto utilizzando un sistema di timeout o un'API per terminare i container. Si potrebbero riciclare i container gia' creati per nuove partite.
