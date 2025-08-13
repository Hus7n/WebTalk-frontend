import { WebSocketServer, WebSocket } from "ws";
const wss = new WebSocketServer({ port: 8080 });
let allSockets = [];
function broadcastUserCount(roomId) {
    const count = allSockets.filter(u => u.room == roomId).length;
    allSockets
        .filter(u => u.room == roomId)
        .forEach(u => {
        u.socket.send(JSON.stringify({
            type: "userCount",
            payload: {
                count
            }
        }));
    });
}
wss.on("connection", (socket) => {
    socket.on("message", (message) => {
        const parsedMessage = JSON.parse(message.toString());
        if (parsedMessage.type == 'join') {
            console.log("user joined room" + parsedMessage.payload.roomId);
            const userId = Math.random().toString(36).substring(2, 10);
            allSockets.push({
                socket,
                room: parsedMessage.payload.roomId,
                id: userId
            });
            socket.send(JSON.stringify({
                type: "id",
                payload: {
                    senderId: userId
                }
            }));
            broadcastUserCount(parsedMessage.payload.roomId);
        }
        if (parsedMessage.type == 'chat') {
            console.log("user wants to chat");
            let currentUserRoom = null;
            let senderId = null;
            for (let i = 0; i < allSockets.length; i++) {
                if (allSockets[i]?.socket == socket) {
                    currentUserRoom = allSockets[i]?.room;
                    senderId = allSockets[i]?.id;
                }
            }
            for (let i = 0; i < allSockets.length; i++) {
                if (allSockets[i]?.room == currentUserRoom) {
                    allSockets[i]?.socket.send(JSON.stringify({
                        type: "chat",
                        payload: {
                            senderId,
                            message: parsedMessage.payload.message
                        }
                    }));
                }
            }
        }
        // VOICE CALL SIGNALING
        if (parsedMessage.type == "voice-offer") {
            const sender = allSockets.find(u => u.socket == socket);
            if (sender) {
                allSockets
                    .filter(u => u.room == sender.room && u.id !== sender.id)
                    .forEach(u => {
                    u.socket.send(JSON.stringify({
                        type: "voice-offer",
                        offer: parsedMessage.offer,
                        from: sender.id
                    }));
                });
            }
        }
        if (parsedMessage.type === "voice-answer") {
            // Send answer back to original caller
            const target = allSockets.find(u => u.id === parsedMessage.to);
            if (target) {
                target.socket.send(JSON.stringify({
                    type: "voice-answer",
                    answer: parsedMessage.answer,
                    from: parsedMessage.from
                }));
            }
        }
        if (parsedMessage.type === "voice-candidate") {
            // Send ICE candidates to the right peer
            const target = allSockets.find(u => u.id === parsedMessage.to);
            if (target) {
                target.socket.send(JSON.stringify({
                    type: "voice-candidate",
                    candidate: parsedMessage.candidate,
                    from: parsedMessage.from
                }));
            }
        }
    });
    socket.on("close", () => {
        const user = allSockets.find(u => u.socket == socket);
        if (user) {
            const roomId = user.room;
            allSockets = allSockets.filter(u => u.socket !== socket);
            broadcastUserCount(roomId);
        }
    });
});
console.log("server running on ws://localhost:8080");
//# sourceMappingURL=index.js.map