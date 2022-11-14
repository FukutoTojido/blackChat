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
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);

    if (Object.keys(data).includes("auth")) {
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

    if (Object.keys(data).includes("userChatlog")) {
        chat.innerHTML = "";

        data.userChatlog.forEach((c) => {
            const mes = createMessage(c.message, c.sender === username);
            chat.appendChild(mes);
        });
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

const createChat = () => {
    const chat = document.createElement("div");
    chat.id = "chat";

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
        if (!user.classList.value.includes("selected")) socket.send(JSON.stringify({ demandDestination: name }));
        [...document.querySelectorAll(".user")].forEach((u) => {
            u.classList = "user";
        });

        user.classList = "user selected";
        chat.innerHTML = "";
        inputSection.disabled = false;
        inputSection.value = "";
        inputSection.placeholder = "start chatting here";
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
    input.disabled = true;
    input.placeholder = "you shall not pass";
    input.onkeydown = (e) => {
        if (e.key === "Enter") {
            if (input.value.trim() !== "") {
                const currentDestination = document.querySelector(".user.selected").innerHTML;
                socket.send(
                    JSON.stringify({
                        destination: currentDestination,
                        message: input.value.trim(),
                        image: "",
                    }),
                );
                const mes = createMessage(input.value, true);
                chat.appendChild(mes);

                chat.scrollTop = chat.scrollHeight;

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

    data.friendsList.forEach((f) => {
        const user = createUsersOnList(f);
        usersList.appendChild(user);
    });

    App.innerHTML = "";
    App.appendChild(chatSection);
    App.appendChild(usersList);
    App.appendChild(input);
};
