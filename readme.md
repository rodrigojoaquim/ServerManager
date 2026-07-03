# Instructions on how to use

1 - Install Node.Js
2 - run commands:

    npm init
    npm install express
    npm install path
    npm install socket.io

3 - Edit /public/JS/config.example.js with your information

5 - Change name config.example.js to config.js

6 - open ports on your router if needed

7- Run the Server

## For a Better Use

the scripts executed in bash if meant only to be executed once should include an error message like this:

echo "A sessão" $0 "já está a correr" >&2

if you want to translante, change in server.js too


## add as a systemctl for linux like ubunto

sudo nano /etc/systemd/system/NAME_DESIRED.service

    [Unit]
    Description=DESCRIPTION
    After=network.target
    
    [Service]
    Type=simple
    User= USER WITCH THIS SERVICE WILL EXECUTE
    WorkingDirectory=LOCATION OF THE DERECTORY
    ExecStart=/usr/bin/node (LOCATION OF SERVER.JS)
    Restart=on-failure
    AmbientCapabilities=CAP_NET_BIND_SERVICE
    
    [Install]
    WantedBy=multi-user.target

-------------------------------------------------------------------------
Everything in caps needs to be changes exept for the CAP_NET_BIND_SERVICE
