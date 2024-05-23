import { readFile } from "node:fs/promises";
import { createServer } from "node:https";
import { Server as SocketIOServer } from "socket.io";
import { Http3Server } from "@fails-components/webtransport";


/* SERVER SETUP */

const key = await readFile("./key.pem");
const cert = await readFile("./cert.pem");

const httpsServer = createServer({
    key,
    cert
  }, async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      const content = await readFile("./client/index.html");
      res.writeHead(200, {
        "content-type": "text/html"
      });
      res.write(content);
      res.end();
    } else {
      res.writeHead(404).end();
    }
});

const port = process.env.PORT || 3000;
httpsServer.listen(port, () => {
    console.log('HTTPS server listening on port 3000');
});

const h3Server = new Http3Server({
    port,
    host: "0.0.0.0",
    secret: "changeit",
    cert,
    privKey: key,
  });
  
  h3Server.startServer();
  
  (async () => {
    
    try {
      const stream = await h3Server.sessionStream("/socket.io/");
      const sessionReader = stream.getReader();

      while (true) {
          const { done, value } = await sessionReader.read();
          if (done) {
              break;
          }
          io.engine.onWebTransportSession(value);
      }
  } catch (error) {
      console.error("Error in WebTransport session stream:", error);
  }
  
})();

const io = new SocketIOServer(httpsServer, {
    transports: ["polling", "websocket", "webtransport"]
});

var SOCKET_LIST = {};

io.on("connection", (socket) => {

    socket.id = Math.floor(Math.random() * 100) + 1;
    socket.x = 0;
    socket.y = 0;

    SOCKET_LIST[socket.id] = socket;

    console.log("user " + socket.id + " connected with transport " + socket.conn.transport.name);

    socket.emit("init", { id: socket.id, sockets: Object.values(SOCKET_LIST).map(s => ({ id: s.id, x: s.x, y: s.y })) });

    socket.conn.on("upgrade", (transport) => {
        console.log("upgraded to " + transport.name);
    });

    socket.on("move", (data) => {
      switch (data.direction) {
          case "left":
              socket.x -= 5;
              break;
          case "up":
              socket.y -= 5;
              break;
          case "right":
              socket.x += 5;
              break;
          case "down":
              socket.y += 5;
              break;
      }

      io.emit("update", { id: socket.id, x: socket.x, y: socket.y });
    });

    socket.on("disconnect", (reason) => {
        delete SOCKET_LIST[socket.id];
        io.emit("remove", socket.id);
        console.log("user " + socket.id + "disconnected due to " + reason);
    });
});

// handle webtransport session errors
io.engine.on('webtransport-error', (error) => {
  console.error("WebTransport Error:", error);
});

/* ----------------- */




