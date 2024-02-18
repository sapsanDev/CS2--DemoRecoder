'use strict';

const FS = require('fs');
const Express = require('express');
const App = Express();
const Exphbs = require('express-handlebars');
const FORM = require('formidable');
const Path = require('path');
const RAR = require('archiver');

const MYSQL = require('mysql2');

const TMPDir = './tmp/';

let CFG = {};

console.log = (log) =>
{
    let LogFile = FS.createWriteStream(`./demo_handler.log`, {flags : 'a+'});
    let date = new Date();
    LogFile.write(`[${date.toLocaleString('ru-RU')}]: ${log}\n`);
}

FS.readFile('./Config.json', {encoding:'utf8', flag:'r'}, async (err, data) =>
{
    if (err)
    {
        console.log(err);
        return;
    };

    CFG = JSON.parse(data);

    if(CFG.ssl)
    {
        if(!CFG.sslCert.length)
        {
            console.log(`Specify the full path to the SSL certificate in the Config.json`);
            return;
        }
        else if(!CFG.sslKey.length)
        {
            console.log(`Specify the full path to the SSL certificate key in the Config.json`);
            return;
        }
    }
    else if(!CFG.port.length)
    {
        CFG.port = 8080;
        console.log(`Server port not specified set to default 8080`);
    }
    else if(!CFG.database.host.length)
    {
        console.log(`Specify MySQL server host address in Config.json`);
        return;
    }
    else if(!CFG.database.user.length)
    {
        console.log(`Specify MySQL server user in Config.json`);
        return;
    }
    else if(!CFG.database.password.length)
    {
        console.log(`Specify password for MySQL server user in Config.json`);
        return;
    }
    else if(!CFG.database.database.length)
    {
        console.log(`Specify the name of the MySQL server database in Config.json`);
        return;
    }
    else if(!CFG.database.port.length)
    {
        CFG.database.port = 3306;
        console.log(`MySQL server port not specified set to default port 3306`);
    }

    /*Pool MySQL*/
    CFG.database.connectionLimit = 100;
    const POOL = MYSQL.createPool(CFG.database);
    let dbP = POOL.promise();

    process.on('SIGINT', function() 
    {
        dbP.end(function(err) 
        {
            if (err) 
            {
                console.log(`SIGINT ${err}`);
            }
            else
            {
                console.log("Connect to database closed!");
                process.exit();
            }
        });
    });

    let db_created = false;

    await dbP.query('CREATE TABLE IF NOT EXISTS `dr_demos` ( \
                `id`            int             NOT NULL AUTO_INCREMENT, \
                `file`          varchar(256)    NOT NULL, \
                `server_id`     int             NOT NULL, \
                `server_name`   varchar(256)    NOT NULL, \
                `map`           varchar(256)    NOT NULL, \
                `date`          varchar(256)    NOT NULL, \
                PRIMARY KEY (`id`) \
            ) ENGINE = InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;')
    .then(  async () => 
    {
        db_created = true;
    }).catch((error)=>{
        console.log(`CREATE TABLE \`dr_demos\`: ${error}`);
        return;
    });

    if(db_created)
    {
        /*Delete old Demos*/
        setInterval(() => 
        {
            console.log(`Start clear demos files.`)
            FS.readdir(CFG.demos.UploadDir, (err, files) => 
            {
                if (err) 
                {
                    console.log(`Clear Demos: ${err}`);
                    return;
                }

                let DemosDeleted = [];

               switch(CFG.demos.CleanType)
                {
                    case "time":
                    {
                        files.forEach(file => 
                        {
                            let filePath = `${CFG.demos.UploadDir}/${file}`;

                            FS.stat(filePath, (err, stats) =>
                            {
                                if (err) 
                                {
                                    console.log(`Clear Demos (${file}): ${err}`);
                                }
                                else
                                {
                                    if (Math.round((new Date().getTime() - stats.mtimeMs) / 1000) > Math.round(CFG.demos.DaysOrCount * 86400)) 
                                    {
                                        DemosDeleted.push(file);
                                        FS.unlink(filePath, () => {console.log(`Demo ${file} deleted!`)});
                                    }
                                }
                            });
                        });
                    }
                    break;

                    case "count":
                    {
                        files = files.sort(function(a, b) {return FS.statSync(`${CFG.demos.UploadDir}/${a}`).mtimeMs - FS.statSync(`${CFG.demos.UploadDir}/${b}`).mtimeMs});

                        if(files.length > CFG.demos.DaysOrCount)
                        {
                            for(let i = 0; i <= (files.length - Number(CFG.demos.DaysOrCount)); i++)
                            {
                                let filePath = `${CFG.demos.UploadDir}/${files[i]}`;
                                DemosDeleted.push(files[i]);
                                FS.unlink(filePath, () => {console.log(`Demo ${files[i]} deleted!`)})
                            }
                        }
                    }
                    break;

                    default:
                    {
                        console.log('There are two types for clearing demo files (time or count), set the type you need');
                    }
                    break;
                }

                if(DemosDeleted.length)
                {
                    dbP.query('DELETE FROM `dr_demos` WHERE `file` IN (?)', [ DemosDeleted ]).then(()=>
                    {
                        console.log(`Demo files in the amount of ${DemosDeleted.length} pcs. removed from the database`);

                    }).catch((error)=> {console.log(`Clear Demos (DB): ${error}`)});
                }
            });
        }, (CFG.demos.TimeClear * 60) * 1000);

        var hbs = Exphbs.create({
            layoutsDir: Path.join(__dirname, "views/layouts"),
            defaultLayout: 'default',
            partialsDir: Path.join(__dirname, "views/partials"),
            extname: '.html'
        });
        
        App.engine('.html', hbs.engine)
            .set('view engine', '.html')
            .set('views', Path.join(__dirname, "views/pages"))
            .use(Express.static(Path.join(__dirname, "assets")))
            .use((req, res, next) =>
            {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Headers', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
                res.setHeader('Access-Control-Allow-Credentials', true);
                next();
            });

        App.get('/', async (req, res) =>
        {
            const [Demos] = await dbP.query("SELECT * FROM `dr_demos` ORDER BY `id` DESC");

            Demos.map((e, i)=>
            {
                if(FS.existsSync(Path.join(__dirname, `assets/maps/${e.map}.jpg`)))
                    Demos[i].mapImg = `/maps/${e.map}.jpg`;
                else Demos[i].mapImg = `/maps/nomap.jpg`;
            })

            res.render("index.html", {Demos: Demos});
        });

        App.get(/\/download\/([^\/\\]+.dem.zip)/, (req, res) =>
        {
            try 
            {
                if (FS.existsSync(`${CFG.demos.UploadDir}/${req.params[0]}`)) 
                {
                    res.download(`${CFG.demos.UploadDir}/${req.params[0]}`);
                }
            } 
            catch(err)
            {
                console.log(`Download demo file ${req.params[0]} error: ${err}`);
                res.status(404).end();
            }
        });

        App.put('/upload', (req, res) =>
        {
            if (checkAuth(req, res)) 
            {
                let form = new FORM.IncomingForm();

                form.parse(req, function (err, fields, files) 
                {
                    const DemoName = req.header('Demo-Name'),
                        SID = req.header('Demo-ServerId'),
                        ServerName = req.header('Server-Name'),
                        MapName = req.header('Map-Name'),
                        DateString = req.header('Demo-Time');

                    console.log(`Try demo (${DemoName}) upload. SID: ${SID}, Time: ${DateString}`);

                    if (!DemoName || DemoName.slice(-4) != '.dem' || !SID || !DateString) 
                    {
                        res.status(400).end();
                        console.log(`Error (${DemoName}) upload. SID: ${SID}, Time: ${DateString}`);
                        return;
                    }

                    let TMPPath = TMPDir + DemoName;
                    try 
                    {
                        FS.rename(files.file[0].filepath, TMPPath, async (err) => 
                        {
                            if (err) 
                            {
                                console.log(`ERROR (PUT /upload): ${err}`);
                            }
                            else
                            {
                                console.log(`File demo (${DemoName}) uploaded to ${TMPPath}`);

                                await saveDemosData(dbP, DemoName, SID, MapName, ServerName, DateString);
                                const ZIPFile = await archiveFile(TMPPath, DemoName);

                                let UploadZIPFile = ZIPFile.slice(TMPDir.length);

                                UploadZIPFile =`${CFG.demos.UploadDir}/${UploadZIPFile}`;

                                FS.rename(ZIPFile, UploadZIPFile, (err) => 
                                {
                                    if (err) 
                                    {
                                        throw err;
                                    }

                                    console.log(`File demo (${ZIPFile}) moved to ${UploadZIPFile}`);
                                });

                                FS.unlink(TMPPath, () => { console.log(`Original file demo (${DemoName}) deleted!`)});
                                res.send(true);
                                res.end();
                            }
                        });
                    } 
                    catch (err) 
                    {
                        console.log(`ERROR Upload Demo: ${err}`);
                    }
                });
            }
        });

        App.get('/*', (req, res) => res.status(404).end());
        App.post('/*', errorPage);

        if (CFG.ssl)
        {
            let options = 
            {
                cert: FS.readFileSync(CFG.sslCert),
                key: FS.readFileSync(CFG.sslKey)
            };
            require('https').createServer(options, App).listen(CFG.port);
        }
        else require('http').createServer(App).listen(CFG.port);

        console.log(`Demo server started on port ${CFG.port}`);
    }
});

/*Helps functions*/
function errorPage (req, res)
{
	res.status(404).end();
}

function checkAuth (req, res)
{
    if (req.header('Auth') != CFG.token)
    {
        res.status(401).end();
        return false;
    }

    return true;
}

/*Demo functions*/
async function saveDemosData(dbP, File, ServerId, MapName, ServerName, DateString)
{
    return new Promise( (resolve, reject) => 
    {
        dbP.query('INSERT INTO `dr_demos` ( \
            `file`, `server_id`, `server_name`, `map`, `date` \
        ) VALUES ( ?, ?, ?, ?, ?);', [File, ServerId, ServerName, MapName, DateString])
        .then((result)=>
        {
            console.log(`Demo (${File}) data saved to database. ID: ${result[0].insertId}`);
            resolve();
        })
        .catch(err => reject(err));
    });
}

// ZIP demo file
async function archiveFile (path, file)
{
    return new Promise((resolve, reject) => 
    {
        const FileName = `${path}.zip`;

        let ZIPFile = FS.createWriteStream(FileName);

        let ZipRAR = RAR('zip', { zlib: { level: 9 } });

        ZipRAR.on('error', (err) => 
        {
            console.log(`Archive file ${FileName}: ${err}`);
            reject(err);
        });

        ZIPFile.on('close', () =>
        {
            console.log(`Archive file ${FileName} success. Size: ${ZipRAR.pointer()} bytes.`);

            resolve(FileName);
        });

        ZipRAR.pipe(ZIPFile);
        ZipRAR.file(path, { name: file });
        ZipRAR.finalize();
    });
}
