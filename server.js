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
        const nodeIds = [];

        console.log("Socket started at " + sPORT);

        node.listen(PORT, () => {
            console.log("P2P started at " + PORT);
        });
        node.on("connect", ({ nodeId }) => {
            console.log("Node", nodeId, "has connected");
            node.direct(nodeId, { name: username, text: "//WAY" });
        });
        node.on("disconnect", ({ nodeId }) => {
            if (nodeId !== undefined) {
                console.log("Node", nodeId, "has disconnected");
                const disconnectedName = nodeIds.filter((n) => n.nodeId === nodeId)[0].name;

                nodeIds.forEach((n, idx) => {
                    if (n.nodeId === nodeId) nodeIds.splice(idx, 1);
                });

                // console.log(nodeIds);
                ws.send(
                    JSON.stringify({
                        type: "disconnection",
                        connectionBroke: disconnectedName,
                    }),
                );
            }
        });
        node.on("direct", ({ origin, message }) => {
            console.log("Message", message, "has been directly send to us from", origin);

            if (message.text === "//WAY") {
                if (nodeIds.filter((n) => n.nodeId === origin).length === 0) {
                    console.log(nodeIds);
                    ws.send(JSON.stringify({ type: "connection", connectionAdded: message.name }));
                    nodeIds.push({ name: message.name, nodeId: origin });
                }
            } else {
                ws.send(JSON.stringify({ type: "mes", ...message }));
            }
        });

        ws.on("message", async (event) => {
            const data = JSON.parse(event.toString());
            // console.log(data);

            if (data.type === "auth") {
                const authInfo = await authenicate(data.uname, data.pwd, PORT);
                if (authInfo.auth !== 0) username = data.uname;
                ws.send(JSON.stringify({ type: "auth", ...authInfo }));
            }

            if (data.type === "openConnection") {
                if (data.demandDestination !== "=== HOME ===") {
                    const userAddress = await getUserAddress(data.demandDestination, username);
                    console.log(userAddress);

                    if (userAddress.status === "online") {
                        node.connect(userAddress.ipAddress, userAddress.port, () => {
                            console.log(`Connected to ${userAddress.ipAddress}:${userAddress.port}`);
                        });
                    } else {
                        ws.send(JSON.stringify({ type: "notAvailable", connectionBroke: data.demandDestination }));
                    }

                    ws.send(
                        JSON.stringify({
                            type: "chatLoad",
                            username: userAddress.username,
                            status: userAddress.status,
                            userChatlog: userAddress.chatLog,
                        }),
                    );
                }
            }

            if (data.type === "file/mes") {
                const pseudoData = {
                    type: data.type,
                    destination: data.destination,
                    message: encodeURIComponent(
                        JSON.stringify({
                            fileName: data.fileName,
                            fileContent: data.fileContent,
                        }),
                    ),
                };

                node.direct(nodeIds.filter((n) => n.name === data.destination)[0].nodeId, {
                    name: username,
                    text: pseudoData.message,
                });

                saveMessage(pseudoData, username);
            }

            if (data.type === "text/mes") {
                // console.log(nodeIds.filter((n) => n.name === data.destination)[0].nodeId);
                if (data.message.charAt(0) !== "/") {
                    if (data.destination !== "=== HOME ===") {
                        node.direct(nodeIds.filter((n) => n.name === data.destination)[0].nodeId, {
                            name: username,
                            text: data.message,
                        });
                        saveMessage(data, username);
                    }
                } else {
                    const command = data.message.split(" ")[0].slice(1);
                    switch (command) {
                        case "query": {
                            const name = data.message.split(" ")[1];
                            const userAddress = await getUserAddress(name, username);
                            console.log(userAddress);

                            if (Object.keys(userAddress).includes("err")) {
                                ws.send(
                                    JSON.stringify({
                                        type: "err",
                                        mes: "user not found",
                                    }),
                                );
                                break;
                            }

                            if (userAddress.status === "offline") {
                                ws.send(JSON.stringify({ type: "notAvailable", connectionBroke: name }));
                            } else {
                                node.connect(userAddress.ipAddress, userAddress.port, () => {
                                    console.log(`Connected to ${userAddress.ipAddress}:${userAddress.port}`);
                                });
                            }

                            ws.send(
                                JSON.stringify({
                                    type: "chatLoad",
                                    username: userAddress.username,
                                    status: userAddress.status,
                                    userChatlog: userAddress.chatLog,
                                }),
                            );
                            break;
                        }
                        default: {
                            break;
                        }
                    }
                }
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

app.listen(7270, "0.0.0.0", async () => {
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
