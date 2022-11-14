const createp2pnode = require("@swensson/p2p");
const express = require("express");
const { Server } = require("ws");
const axios = require("axios");
const os = require("os");
const ejs = require("ejs");
const fs = require("fs");

const app = express();
const addresses = [];

app.use(express.json());
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, content-type");
    res.header("Access-Control-Allow-Credentials", true);
    res.header("crossdomain", true);
    next();
});
app.use(express.static(__dirname + "/public"));

const authenicate = async (uname, pwd, port) => {
    let authInfo;
    await axios
        .post("http://127.0.0.1:60727/authenticate", {
            userName: uname,
            pwd: pwd,
            ip: addresses[0],
            port: port,
        })
        .then((res) => {
            authInfo = res.data;
        });
    return authInfo;
};

const goOffline = async (uname) => {
    let resFromServer;
    await axios
        .post("http://127.0.0.1:60727/closeSignaling", {
            uname: uname,
        })
        .then((res) => {
            resFromServer = res.data;
        });
    return resFromServer;
};

const getUserAddress = async (name, username) => {
    let resFromServer;
    await axios
        .post("http://127.0.0.1:60727/getUserAddress", {
            name: name,
            username: username,
        })
        .then((res) => {
            resFromServer = res.data;
        });
    return resFromServer;
};

const saveMessage = async (mes, username) => {
    let resFromServer;
    await axios.post("http://127.0.0.1:60727/saveMessage", {
        mes: mes,
        username: username,
    });
    return resFromServer;
};

app.get("/", (req, res) => {
    const sPORT = Math.floor(Math.random() * 65535);
    console.log(sPORT);

    const socket = new Server({ port: sPORT });
    const node = createp2pnode();

    socket.on("connection", (ws) => {
        let PORT = Math.floor(Math.random() * 65535);
        if ([80, 8080, 443, 24050, 20727].includes(PORT)) PORT *= 2;

        let username = "";

        console.log("Socket started at " + sPORT);

        node.listen(PORT, () => {
            console.log("P2P started at " + PORT);
        });
        node.on("connect", ({ nodeId }) => {
            console.log("Node", nodeId, "has connected");
            node.direct(nodeId, { name: username, text: "//WAY" });
        });
        node.on("disconnect", ({ nodeId }) => {
            console.log("Node", nodeId, "has disconnected");
        });
        node.on("direct", ({ origin, message }) => {
            console.log("Message", message, "has been directly send to us from", origin);
            ws.send(JSON.stringify({ connectionAdded: message.name }));
        });

        ws.on("message", async (event) => {
            const data = JSON.parse(event.toString());
            console.log(data);

            if (Object.keys(data).includes("uname") && Object.keys(data).includes("pwd")) {
                const authInfo = await authenicate(data.uname, data.pwd, PORT);
                if (authInfo.auth !== 0) username = data.uname;
                ws.send(JSON.stringify(authInfo));
            }

            if (Object.keys(data).includes("demandDestination")) {
                const userAddress = await getUserAddress(data.demandDestination, username);
                console.log(userAddress);

                if (userAddress.status === "online") {
                    node.connect(userAddress.ipAddress, userAddress.port, () => {
                        console.log(`Connected to ${userAddress.ipAddress}:${userAddress.port}`);
                    });
                }

                ws.send(JSON.stringify({ username: userAddress.username, userChatlog: userAddress.chatLog }));
            }

            if (
                Object.keys(data).includes("destination") &&
                Object.keys(data).includes("message") &&
                Object.keys(data).includes("image")
            ) {
                saveMessage(data, username);
            }
        });

        ws.on("close", async () => {
            console.log("Client disconnected!");
            node.close(() => {
                console.log("Node is down");
            });

            if (username !== "") await goOffline(username);
        });
    });

    fs.readFile(__dirname + "/index.html", "utf-8", (err, html) => {
        // console.log(html.toString());
        res.send(ejs.render(html, { sPORT: sPORT }));
    });
});

app.listen(7270, async () => {
    const interfaces = os.networkInterfaces();
    for (const k in interfaces) {
        for (const k2 in interfaces[k]) {
            const address = interfaces[k][k2];
            if (address.family === "IPv4" && !address.internal) {
                addresses.push(address.address);
            }
        }
    }

    console.log("Client started at " + 7270);
    // console.log("Working at " + 80);
});
