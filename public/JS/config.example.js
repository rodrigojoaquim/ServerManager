const Config = {

    Servidor: {
        portacom: 3000, // port for the comunication
        portasocket: 80, // port for the web browser
        ip: "rexserver" // ip of the server
    },

    Discos: [
        "/", // mounted disk for the system to monitor
    ],

    Sistema: {
        pastaScripts: "/home/user", // path where the scripts to execute are located
        utilizadorAdmin: "user" // user that will execute the scripts
    },

    addTx: false, // set to true if you want to add the TX link in the navbar, false otherwise

};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
} else {
    window.Config = Config;
}