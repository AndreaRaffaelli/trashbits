# trash.bits

A small multiplayer game where robots try to defeat a trash monster. 

Built in Javascript, Node.js and Socket.io, this prototype was necessary for my thesis to observe and compare the performances of the new WebTransport protocol with the traditional WebSocket one. 

## Cyberandrea's Fork

This fork aim to add session management to the game, so that players can join a game session and play together.

### How to run

```
docker run -p 8080:8080 \
  -v /path/to/key.pem:/usr/src/app/key.pem \
  -v /path/to/cert.pem:/usr/src/app/cert.pem \
  trashbits
```