const express = require('express')
const path = require('path')
const si = require('systeminformation');
const io = require('socket.io')(3000,{
  cors: {
    origin: "*"
  }
})
const port = 80
const app = express()
var chat = []

app.use((express.json()))
app.use(express.static(path.join(__dirname,"public")))

const server = app.listen(port,()=>{
    console.log(`Servier is listning on port: ${port}`)
})

process.on('SIGINT', () => {
    console.log("\n[Aviso] Sinal de interrupção (Ctrl+C) recebido!");
    console.log("A preparar para desligar o servidor de forma segura...");

    io.emit("servidor_desligar", "O servidor vai ser reiniciado em breve.");

    io.disconnectSockets(true);
    console.log("Todos os clientes foram desligados com sucesso.");
    process.exit(0);
});

app.get("/",(req,res)=>{
    res.sendFile(path.join(__dirname,"public","html/index.html"))
})

async function obterEstatisticas() {
    try {
        const cpu = await si.currentLoad();
        //console.log(`Uso do CPU: ${cpu.currentLoad.toFixed(2)}%`);

        const ram = await si.mem();
        const ramUsadaGB = ram.active / (1024 ** 3);
        const ramTotalGB = ram.total / (1024 ** 3);
        //console.log(`RAM Usada: ${ramUsadaGB.toFixed(2)} GB / ${ramTotalGB.toFixed(2)} GB`);

        const discos = await si.fsSize();
        const discosDesejados = ['/', '/mnt/C', '/mnt/D'];
        const discosFiltrados = discos.filter(disco => discosDesejados.includes(disco.mount));
        const discoPrincipal = discosFiltrados[0];
        //console.log(`Disco ${discoPrincipal.fs}: ${discoPrincipal.use}% usado.`);

        data = {
            cpu: cpu.currentLoad.toFixed(2),
            ram: { total: ramTotalGB.toFixed(2), usada: ramUsadaGB.toFixed(2) },
            disco: discosFiltrados
        }

        return data;

    } catch (erro) {
        console.error("Erro a ler os dados do sistema:", erro);
    }
}

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);
    
    socket.on("ping", (data) => {
        console.log("Received ping:", data);
    });

    socket.on("send_msg", (data) => {
        chat.push(data)
        socket.broadcast.emit("send_chat", chat);
        socket.emit("send_chat", chat);
    });

    socket.on("request_msg", (data) => {
        socket.emit("send_chat", chat);
    });

    socket.on("request_status", (data) => {
        obterEstatisticas().then((data) => {
            socket.emit("send_status", data);
        });
    });

    const meuLoop = setInterval(() => {
        obterEstatisticas().then((data) => {
            socket.emit("send_status", data);
        });
    }, 5000);

    socket.on("disconnect", () => {
        console.log(`Cliente ${socket.id} fechou a página.`);

        clearInterval(meuLoop); 
        
        //console.log("Loop destruído com sucesso. CPU em repouso!");
    });

});


