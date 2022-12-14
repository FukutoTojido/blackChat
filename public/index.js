window.addEventListener(
    "dragover",
    function (e) {
        e = e || event;
        e.preventDefault();
    },
    false,
);

window.addEventListener(
    "drop",
    function (e) {
        e = e || event;
        e.preventDefault();
    },
    false,
);

console.log(sPORT);

const socket = new ReconnectingWebSocket(`ws://localhost:${sPORT}/ws`);
let username = "";

timeout = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

socket.onopen = () => {
    console.log("Connection Open!");
};

socket.onclose = () => {
    console.log("Connection Closed!");
    window.location.reload();
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);

    if (data.type === "auth") {
        if (data.auth !== 0) {
            username = data.username;
            startUp(data);
        } else {
            if (document.querySelector("#warning") == null) {
                const warning = document.createElement("div");
                warning.id = "warning";
                warning.innerHTML = "EITHER YOUR USERNAME OR PASSWORD IS WRONG";

                loginDialog.appendChild(warning);

                setTimeout(() => {
                    loginDialog.removeChild(warning);
                }, 2000);
            }
        }
    }

    if (data.type === "chatLoad") {
        const friendsList = [...document.querySelectorAll(".user")].map((u) => {
            if (u.innerHTML !== "=== HOME ===") return u.innerHTML;
        });

        if (!friendsList.includes(data.username)) {
            const newUser = createUsersOnList(data.username);
            usersList.appendChild(newUser);
        }

        [...document.querySelectorAll(".user")].forEach((u) => {
            if (u.innerHTML === data.username) {
                u.classList.add("selected");
            } else {
                u.classList.remove("selected");
            }
        });

        inputSection.placeholder = data.status === "online" ? "start chatting now..." : "user has gone offline";
        inputSection.disabled = !(data.status === "online");
        inputSection.value = "";

        chat.innerHTML = "";

        data.userChatlog.forEach((c) => {
            try {
                const rawMes = JSON.parse(decodeURIComponent(c.message));
                const mes = createDownload(rawMes.fileName, rawMes.fileContent, c.sender === username);
                chat.appendChild(mes);
                chat.scrollTop = chat.scrollHeight;
            } catch (e) {
                // console.log("Bleh");
                const mes = createMessage(c.message, c.sender === username);
                chat.appendChild(mes);
                chat.scrollTop = chat.scrollHeight;
            }
        });
    }

    if (data.type === "mes") {
        const selected = document.querySelector(".user.selected");
        const selectedUser = selected.innerHTML;

        if (data.name === selectedUser) {
            try {
                const rawMes = JSON.parse(decodeURIComponent(data.text));
                const mes = createDownload(rawMes.fileName, rawMes.fileContent, false);
                chat.appendChild(mes);
                chat.scrollTop = chat.scrollHeight;
            } catch (e) {
                // console.log("Bleh");
                const mes = createMessage(data.text, false);
                chat.appendChild(mes);
                chat.scrollTop = chat.scrollHeight;
            }
        }
    }

    if (data.type === "connection") {
        const selected = document.querySelector(".user.selected");
        const selectedUser = selected.innerHTML;

        if (selectedUser === data.connectionAdded) {
            inputSection.disabled = false;
            inputSection.value = "";
            inputSection.placeholder = "start chatting now...";
        }
    }

    if (data.type === "disconnection") {
        const selected = document.querySelector(".user.selected");
        const selectedUser = selected.innerHTML;

        if (selectedUser === data.connectionBroke) {
            inputSection.disabled = true;
            inputSection.placeholder = "user has gone offline";
            inputSection.value = "";
        }
    }

    if (data.type === "notAvailable") {
        const selected = document.querySelector(".user.selected");
        const selectedUser = selected.innerHTML;

        if (selectedUser === data.connectionBroke) {
            inputSection.disabled = true;
            inputSection.value = "";
            inputSection.placeholder = "user has gone offline";
        }
    }
};

const createMessage = (message, isUser) => {
    const container = document.createElement("div");
    container.classList = "messageContainer";

    const mes = document.createElement("div");
    mes.classList = "message";
    if (isUser) mes.classList.add("user");

    mes.innerHTML = message;

    container.appendChild(mes);

    return container;
};

const createDownload = (fileName, content, isUser) => {
    const fileNameContainer = document.createElement("div");
    fileNameContainer.innerHTML = fileName;

    const downloadButton = document.createElement("a");
    downloadButton.href = content;
    downloadButton.download = fileName;

    const downloadContainer = document.createElement("div");
    downloadContainer.appendChild(fileNameContainer);
    downloadContainer.appendChild(downloadButton);

    const mesContainer = createMessage(downloadContainer.innerHTML, isUser);

    return mesContainer;
};

const test = (e) => {
    const data = e.dataTransfer.files;
    console.log(data);

    if ([...data].filter((d) => d.size > 40000).length !== 0) {
        return;
    }

    [...data].forEach((d) => {
        const reader = new FileReader();
        let rawData = new ArrayBuffer();

        reader.readAsDataURL(d);

        reader.onload = (e) => {
            const currentDestination = document.querySelector(".user.selected").innerHTML;
            rawData = e.target.result;

            socket.send(
                JSON.stringify({
                    type: "file/mes",
                    destination: currentDestination,
                    fileName: d.name,
                    fileContent: rawData,
                }),
            );

            const mes = createDownload(d.name, e.target.result, true);
            console.log(mes);
            chat.appendChild(mes);

            chat.scrollTop = chat.scrollHeight;
        };
    });
};

const createChat = () => {
    const chat = document.createElement("div");
    chat.id = "chat";

    chat.addEventListener("dragleave", () => {
        chat.style.opacity = 1;
    });

    chat.addEventListener("dragover", (e) => {
        e.preventDefault();

        const currentDestination = document.querySelector(".user.selected").innerHTML;

        if (currentDestination !== "=== HOME ===") chat.style.opacity = 0.3;
    });

    chat.addEventListener("drop", (e) => {
        const currentDestination = document.querySelector(".user.selected").innerHTML;
        if (currentDestination !== "=== HOME ===" && inputSection.disabled !== true) {
            test(e);
        }

        chat.style.opacity = 1;
    });

    chat.innerHTML = `
    <div class="introduction">
        Welcome to blackChat! <br> 
        <span>To start using, choose a user to connect.</span> <br> 
        <span>Upon choosing user, all your previous chat will be deleted.</span>
    </div>`;

    return chat;
};

const createUsersOnList = (name) => {
    const user = document.createElement("div");
    user.classList = "user";
    user.innerHTML = name;

    user.onclick = () => {
        if (!user.classList.value.includes("selected"))
            socket.send(JSON.stringify({ type: "openConnection", demandDestination: name }));
        [...document.querySelectorAll(".user")].forEach((u) => {
            u.classList = "user";
        });

        user.classList = "user selected";
        inputSection.value = "";

        if (name !== "=== HOME ===") {
            chat.innerHTML = "";
        } else {
            chat.innerHTML = `
            <div class="introduction">
                Welcome to blackChat! <br> 
                <span>To start using, choose a user to connect.</span> <br> 
                <span>Upon choosing user, all your previous chat will be deleted.</span>
            </div>`;
            inputSection.placeholder = "use /query <username> to start a conversation with your friend";
            inputSection.disabled = false;
        }
    };

    return user;
};

const createUsersListContainer = () => {
    const usersList = document.createElement("div");
    usersList.id = "usersList";
    return usersList;
};

const createInputBar = () => {
    const input = document.createElement("input");
    input.id = "inputSection";
    input.placeholder = "use /query <username> to start a conversation with your friend";
    input.onkeydown = (e) => {
        if (e.key === "Enter") {
            if (input.value.trim() !== "") {
                const currentDestination = document.querySelector(".user.selected").innerHTML;

                if (currentDestination !== "=== HOME ===") {
                    const mes = createMessage(input.value, true);
                    chat.appendChild(mes);
                    chat.scrollTop = chat.scrollHeight;
                }

                socket.send(
                    JSON.stringify({
                        type: "text/mes",
                        destination: currentDestination,
                        message: input.value.trim(),
                    }),
                );

                input.value = "";
            }
        }
    };

    return input;
};

const checkInput = (e) => {
    if (e.key === "Enter") {
        if (uname.value.trim() !== "" && pwd.value.trim() !== "") sendAuthenticate();
    }
};

const sendAuthenticate = () => {
    if (uname.value.trim() !== "" && pwd.value.trim() !== "")
        socket.send(
            JSON.stringify({
                type: "auth",
                uname: uname.value.trim(),
                pwd: pwd.value.trim(),
            }),
        );
};

startUp = (data) => {
    const App = document.querySelector(".App");
    const chatSection = createChat();
    const usersList = createUsersListContainer();
    const input = createInputBar();

    const home = createUsersOnList("=== HOME ===");
    usersList.appendChild(home);
    home.classList = "user selected";

    data.friendsList.forEach((f) => {
        const user = createUsersOnList(f);
        usersList.appendChild(user);
    });

    App.innerHTML = "";
    App.appendChild(chatSection);
    App.appendChild(usersList);
    App.appendChild(input);
};
