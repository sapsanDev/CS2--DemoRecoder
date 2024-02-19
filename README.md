# CS2--DemoRecoder

### Requirements
* [CounterStrikeSharp](https://github.com/roflmuffin/CounterStrikeSharp/) (version 142 or higher)

### Installation

Drag and drop from [releases](https://github.com/sapsanDev/CS2--DemoRecoder/releases) to game/csgo/addons/counterstrikesharp/plugins

### Configuration
Configure the file DemoRecorder.json generated on addons/counterstrikesharp/configs/plugins/DemoRecorder
```json
{
  "MinOnline": 4,
  "ServerId": 1,
  "DemosDir": "demos/",
  "Token": "your_web_app_token",
  "UploadUrl": "http://example.com:2053/upload"
}
```
* MinOnline - 4: Minimum online requirement to start recording a demo.
* ServerId - 1: Unique server ID.
* DemosDir - "demos/": The folder for recording the demo on the server is created along the path addons/counterstrikesharp/data/
* Token - "your_web_app_token": Your WEB token for uploading demo to the site.
* UploadUrl - "http://example.com:2053/upload": Demo download handler address.

### Commands
* css_dr_reload - Reload config DemoRecorder.json. Access @css/root

# Web-Server

### Requirements
* [NodeJS](https://nodejs.org/en) (version 17.9.0 or higher)
* [npm](https://www.npmjs.com/) (version 8.19.2 or higher)
* [pm2](https://pm2.keymetrics.io/) (version 5.1.2 or higher)

### Configuration
Configure the file Config.json
```json
{
    "ssl": false,
    "sslCert": "",
    "sslKey": "",
    "port": "2053",
    "database": {
        "host":     "localhost",
        "user":     "db_user",
        "port":     "3306",
        "database": "db_name",
        "password": "pass"
    },
    "token": "your_web_app_token",
    "demos": {
        "CleanType": "count",
        "DaysOrCount": 500,
        "TimeClear": 60,
        "UploadDir": "path_toupload_demos"
    }
}
```
* ssl - false: If you want to use ssl set true
* sslCert - "": Path to the certificate file (need if ssl set true).
* sslKey - "": Path to the certificate key file (need if ssl set true).
* port - "2053": Web server launch port.
* token - "your_web_app_token": Your WEB token for uploading demo.
* CleanType - "count/time": Type of deletion of old demo recordings. count - Removal upon reaching quantity, time - Deletion upon reaching storage time.
* DaysOrCount - 500: if CleanType = count the amount of demo storage is set, if CleanType = time the number of days for demo storage is set
* UploadDir - "root/demos": Full demo storage path

### Web Installation
Upload the Web server files to the desired folder, in the console go to the folder with the Web files, enter the command "npm i"

Launch commands
* npm start - Start web server.
* npm stop - Stop web server.
* npm restart - Restart web server.
