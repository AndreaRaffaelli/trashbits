import { readFile } from "node:fs/promises";
import { createServer } from "node:https";
import { Server as SocketIOServer } from "socket.io";
import { Http3Server } from "@fails-components/webtransport";

import express from "express";
import fs from "fs";


/* SERVER SETUP */

// using express to serve static files
// and HTTP/3 server to handle WebTransport sessions with Socket.IO

const app = express();
app.use(express.static('client'));

// required for HTTP/3
const key = fs.readFileSync('./key.pem', 'utf8');
const cert = fs.readFileSync('./cert.pem', 'utf8');

app.get('/', async (req, res) => {
  try {
      const content = await readFile("./client/index.html", "utf8");
      res.send(content);
  } catch (error) {
      res.status(500).send('Error reading index.html');
  }
});

const httpsServer = createServer( {key, cert}, app);

const port = process.env.PORT || 8080;
httpsServer.listen(port, () => {
    console.log('HTTPS server listening on port 8080');
});

const h3Server = new Http3Server({
    port,
    host: "0.0.0.0",
    secret: "provaprova",
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
    transports: ["polling", "webtransport", "websocket"],
    // pingInterval: 5000, // 5 seconds
    // pingTimeout: 5000, // timeout for inactive users
});

/* BUSINESS LOGIC */

const serverPlayers = {};
let numPlayers = 0;

const serverBullets = {};
let bulletId = 0;

const serverEnemy = {
    x: 0,
    y: 0,
    health: 100,
    width: 200,
    height: 160,
};

const enemyBullets = {};
let enemyBulletId = 0;

let canvasWidth = 0;
let canvasHeight = 0;

/* ----------------- */

io.on("connection", (socket) => {

    numPlayers++;

    serverPlayers[socket.id] = {
        x: 500 * Math.random(),
        y: 500 * Math.random(),
        sequenceNumber: 0,
        width: 60,
        height: 60,
        health: 100
    };

    console.log("user " + socket.id + " connected with transport " + socket.conn.transport.name);

    io.emit("updatePlayers", serverPlayers);
    io.emit("numPlayers", numPlayers);

    /* ----------------- */

    // handle transport upgrades (e.g., from polling to websocket)
    socket.conn.on("upgrade", (transport) => {
        console.log("transport upgraded to " + transport.name);
    });

    /* ----------------- */

    // handle canvas size initialization and enemy creation

    socket.on("initCanvas", ({ width, height }) => {

        // displays the enemy in the center of the canvas

        serverEnemy.x = (width - serverEnemy.width) / 2;
        serverEnemy.y = (height - serverEnemy.height) / 2;

        canvasWidth = width;
        canvasHeight = height;

        io.emit("createEnemy", serverEnemy);
    });


    /* ----------------- */

    // player movement handler -> given to ticker function

    const SPEED = 4;

    socket.on("move", ({ direction, sequenceNumber}) => {

        if(!serverPlayers[socket.id]) return;
        
        serverPlayers[socket.id].sequenceNumber = sequenceNumber;
 
        switch (direction) {
            case "left":
                serverPlayers[socket.id].x -= SPEED;
                break;
            case "up":
                serverPlayers[socket.id].y -= SPEED;
                break;
            case "right":
                serverPlayers[socket.id].x += SPEED;
                break;
            case "down":
                serverPlayers[socket.id].y += SPEED;
                break;
        }
    });


    /* ----------------- */

    // handle player shooting

    socket.on("shoot", ({ x, y, angle }) => {

        bulletId++;

        const velocity = {
            x: Math.cos(angle) * 5,
            y: Math.sin(angle) * 5
        }; 

        serverBullets[bulletId] = {
            x,
            y,
            width: 10,
            height: 10,
            type: "player",
            velocity,
            playerId: socket.id
        };

    });



    /* ----------------- */

    socket.on("disconnect", (reason) => {

      console.log("user " + socket.id + " disconnected due to " + reason);
      
      delete serverPlayers[socket.id];
        
      io.emit("updatePlayers", serverPlayers);

      numPlayers--;
      io.emit("numPlayers", numPlayers);
    });

});

/* ----------------- */

// ticker function to update player positions & bullets
// and emit the updated player positions to all clients
// this prevents clogging the network with too many messages

setInterval(() => {

    const bulletsToRemove = [];

    // update bullets
    for (const id in serverBullets) {
        serverBullets[id].x += serverBullets[id].velocity.x;
        serverBullets[id].y += serverBullets[id].velocity.y;

        // check for collisions with the enemy

        if (checkCollision(serverBullets[id], serverEnemy)) {

            console.log("collision detected");

            bulletsToRemove.push(id);
            
            serverEnemy.health -= 5;

            if (serverEnemy.health <= 0) {
                
                console.log("enemy died");

                serverEnemy.health = 0;
                io.emit("enemyDied");

            }

            io.emit("updateEnemy", serverEnemy);
        }

    }

    // remove bullets that have collided with the enemy
    for (const id of bulletsToRemove) {
        delete serverBullets[id];
    }

    io.emit("updateBullets", serverBullets);
    io.emit("updatePlayers", serverPlayers);
    
}, 15 ); // 15ms is recommended for 60fps
        // increasing this -> delay in player movement


/* ----------------- */

// ENEMY BULLET EMITTING

let numBullets = 0;


setInterval(() => {

    if (serverEnemy.health <= 0) return;
    
    if (numBullets <= 50)
        numBullets++;
    
    const angleIncrement = (2 * Math.PI) / numBullets; // radius emission

    const centerX = (canvasWidth - serverEnemy.width) / 2 + serverEnemy.width / 2;
    const centerY = (canvasHeight - serverEnemy.height) / 2 + serverEnemy.height / 2;


    const bulletDim = 5;

    for (let i = 0; i < numBullets; i++) {

        enemyBulletId++;
        const angle = angleIncrement * i;

        const velocity = {
            x: Math.cos(angle) * 5,
            y: Math.sin(angle) * 5
        };

        enemyBullets[enemyBulletId] = {
            x: centerX,
            y: centerY,
            type: "enemy",
            width: bulletDim,
            height: bulletDim,
            velocity
        };
    }

    io.emit("updateEnemyBullets", enemyBullets);

}, 2000); // Enemy shoots every 2 seconds


setInterval(() => {

    let damage = 10;

    const enemyBulletsToRemove = [];

    // Update enemy bullets
    for (const id in enemyBullets) {
        enemyBullets[id].x += enemyBullets[id].velocity.x;
        enemyBullets[id].y += enemyBullets[id].velocity.y;

        // Check for collisions with players
        for (const playerId in serverPlayers) {
            if (checkCollision(enemyBullets[id], serverPlayers[playerId])) {
                console.log("Player hit by enemy bullet");

                // Mark bullet for removal
                enemyBulletsToRemove.push(id);

                // Damage player
                serverPlayers[playerId].health -= damage;

                if (serverPlayers[playerId].health <= 0) {
                    console.log("Player died");
                    delete serverPlayers[playerId];
                    io.emit("updatePlayers", serverPlayers);
                }

                io.emit("updatePlayer", serverPlayers[playerId]);
            }
        }
    }

    // Remove bullets that have collided with players
    for (const id of enemyBulletsToRemove) {
        delete enemyBullets[id];
    }

    io.emit("updateEnemyBullets", enemyBullets);
}, 15); // Update at 60 FPS




/* ----------------- */
 

function checkCollision(bullet, enemy) {
    // Check if the bullet is within the enemy's bounding box
    return bullet.x < enemy.x + enemy.width &&
            bullet.x + bullet.width > enemy.x &&
            bullet.y < enemy.y + enemy.height &&
            bullet.y + bullet.height > enemy.y;
}        

/* ----------------- */

// handle webtransport session errors
io.engine.on('webtransport-error', (error) => {
  console.error("WebTransport Error:", error);
});

/* ----------------- */





