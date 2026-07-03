const express = require('express')
const path = require('path')
const si = require('systeminformation');
const { exec } = require('child_process');
const fs = require('fs').promises;
const Config = require('./public/JS/config.js');
const io = require('socket.io')(Config.Servidor.portacom,{
  cors: {
    origin: "*"
  }
})
const port = Config.Servidor.portasocket
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

app.get("/programas",(req,res)=>{
    res.sendFile(path.join(__dirname,"public","html/Program.html"))
})

async function obterEstatisticas() {
    try {
        const cpu = await si.currentLoad();

        const ram = await si.mem();
        const ramUsadaGB = ram.active / (1024 ** 3);
        const ramTotalGB = ram.total / (1024 ** 3);

        const discos = await si.fsSize();
        const discosDesejados = Config.Discos;
        const discosFiltrados = discos.filter(disco => discosDesejados.includes(disco.mount));
        const discoPrincipal = discosFiltrados[0];

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

async function procurarScriptsRunning() {
    try {
        const sessionsRaw = await fs.readdir('/run/screen/S-' + Config.Sistema.utilizadorAdmin);

        const sessions = sessionsRaw.map((name) => {
            const posicao = name.indexOf(".");
            
            return name.slice(posicao + 1);
        });

        return sessions; 

    } catch (erro) {
        console.error("Erro ao ler a pasta do utilizador:", erro);
        return [];
    }
}

async function procurarScripts() {
    try {
        const todosOsFicheiros = await fs.readdir(Config.Sistema.pastaScripts);

        const scripts = todosOsFicheiros.filter(ficheiro => ficheiro.endsWith('.sh'));

        return scripts; 

    } catch (erro) {
        console.error("Erro ao ler a pasta do utilizador:", erro);
        return [];
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

    socket.on("request_program", (data) => {
        procurarScripts().then((data) => {
            socket.emit("send_program", data);
        });
    })

    socket.on("request_program_running", (data) => {
        procurarScriptsRunning().then((data) => {
            socket.emit("send_program_running", data);
        });
    })

    socket.on("comando_programa", async (nomeDoPrograma) => {
        console.log(`Pedido para correr: ${nomeDoPrograma}`);

        const scriptsPermitidos = await procurarScripts(); 
        
        if (!scriptsPermitidos.includes(nomeDoPrograma)) {
            console.error(`Tentativa de execução bloqueada: ${nomeDoPrograma}`);
            socket.emit("alerta_sistema", `Tentativa de execução bloqueada: ${nomeDoPrograma}`);
            return;
        }

        const caminhoCompleto = `${Config.Sistema.pastaScripts}/${nomeDoPrograma}`;

        exec(`bash ${caminhoCompleto}`, (erro, stdout, stderr) => {
            
            if (erro) {
                console.error(`Erro ao executar ${nomeDoPrograma}:`, erro.message);
                socket.emit("alerta_sistema", `Erro ao executar ${nomeDoPrograma}: ${erro.message}`);
                return;
            }

            if (stderr == "A sessão ./${nomeDoPrograma} já está a correr") {
                console.log(`Aviso do ${nomeDoPrograma}:`, stderr);
                socket.emit("alerta_sistema", `Aviso do ${nomeDoPrograma}`);
            }

            if (stderr) {
                console.log(`Aviso do ${nomeDoPrograma}:`, stderr);
                socket.emit("alerta_sistema", `Aviso do ${nomeDoPrograma}: ${stderr}`);
            }

            socket.emit("alerta_sistema", `${nomeDoPrograma} Iniciado com sucesso.`);

        });

        setTimeout(() => {
            procurarScriptsRunning().then((data) => {
                socket.emit("send_program_running", data);
            });
        }, 500);
    });

    socket.on("end_program", (nomeDoPrograma) => {
        console.log(`Pedido para terminar: ${nomeDoPrograma}`);
    
        exec(`screen -S ${nomeDoPrograma} -p 0 -X stuff "^C"`, (erro, stdout, stderr) => {
            if (erro) {
                console.error(`Erro ao terminar ${nomeDoPrograma}`);
                socket.emit("alerta_sistema", `Erro ao terminar ${nomeDoPrograma}`);
                return;
            }
            procurarScriptsRunning().then((data) => {
                socket.emit("send_program_running", data);
            });
        });

        setTimeout(() => {
            procurarScriptsRunning().then((data) => {
                socket.emit("send_program_running", data);
            });
        }, 500);

    });

    socket.on("shutdown", (data) => {
        console.log("Pedido de DESLIGAR recebido do administrador.");
        exec("sudo /sbin/shutdown -h now", (erro, stdout, stderr) => {
            if (erro) {
                console.error(`Erro ao desligar: ${erro.message}`);
                socket.emit("alerta_sistema", `Erro ao desligar: ${erro.message}`);
                return;
            }
        });
    });

    socket.on("restart", (data) => {
        console.log("Pedido de REINÍCIO recebido do administrador.");
        
        exec("sudo /sbin/reboot", (erro, stdout, stderr) => {
            if (erro) {
                console.error(`Erro ao reiniciar: ${erro.message}`);
                socket.emit("alerta_sistema", `Erro ao reiniciar: ${erro.message}`);
                return;
            }
        });
    });

    socket.on("disconnect", () => {
        console.log(`Cliente ${socket.id} fechou a página.`);

        clearInterval(meuLoop); 
        
    });

});


