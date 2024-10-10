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
    // Ottieni i dettagli del servizio
    const service = await k8sApi.readNamespacedService(serviceName, namespace);
    const serviceIP = service.body.spec.clusterIP;

    // Restituisci l'URL del gioco
    return `http://${serviceIP}:8080`; // Usa l'IP del servizio Kubernetes}
}

module.exports = { createGameContainer };

