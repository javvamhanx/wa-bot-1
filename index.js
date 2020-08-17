const fs = require('fs');
const { Client, Location } = require('whatsapp-web.js');
const moment = require('moment');
const helpers = require('./lib/helpers');
const tmpData = require('./tools-test/tmpData.json');
const MongoClient = require('mongodb').MongoClient;


const options = {
    poolSize: 50,
    keepAlive: 15000,
    socketTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    useNewUrlParser: true,
    useUnifiedTopology: true
};

const url = "";

let db;

const getUsers = (db, author) =>
    new Promise((resolve, reject) => {
        const allRecords = db
            .collection('corona')
            .find({'from':author})
            .toArray();
        if (!allRecords) {
            reject("Error Mongo", allRecords);
        }

        resolve(allRecords);
    });

const insertUser = (db, document) =>
    new Promise((resolve, reject) => {
        const allRecords = db
            .collection('corona')
            .insertOne(document)
        if (!allRecords) {
            reject("Error Mongo", allRecords);
        }

        resolve(allRecords);
    });

const SESSION_FILE_PATH = "./session.json";
// file is included here
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}
client = new Client({	  
    
	     puppeteer: {
        executablePath: '/usr/bin/chromium',
        headless: true,
		args: [
      "--log-level=3", // fatal only
   
      "--no-default-browser-check",
      "--disable-infobars",
      "--disable-web-security",
      "--disable-site-isolation-trials",
      "--no-experiments",
      "--ignore-gpu-blacklist",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
    
      "--disable-extensions",
      "--disable-default-apps",
      "--enable-features=NetworkService",
      "--disable-setuid-sandbox",
      "--no-sandbox",
    
      "--no-first-run",
      "--no-zygote"
    ]
		
    },	      
    session: sessionCfg
});
// You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.

client.initialize();

client.on('qr', (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    console.log('QR RECEIVED', qr);
});

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    sessionCfg=session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessfull
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', async () => {
    try{
        const client = await MongoClient.connect(url, options);
        db = await client.db();
        console.log('READY!!!!');
    }catch(e){
        console.log('ADA PROBLEM', e)
    }
});

client.on('message', async msg => {
    console.log('MESSAGE RECEIVED', msg);
        const dataUser = await getUsers(db, msg.from);
        console.log(dataUser, 'info user')
        if(msg.body && dataUser.length < 1){
            dataUser.push(msg.from);
            await insertUser(db, msg);
        }

        if (msg.body == '/help') {
            let chat = await msg.getChat();
            if(!chat.isGroup) {
                const message = 
                `Command/Perintah :\n\nKetikan perintah perintah ini agar bisa memunculkan menu\n\n1. !corona _untuk melihat seluruh kasus corona_\n2. !corona *nama negara* _misal *!corona indonesia* memunculkan kasus corona berdasarkan negara_\n\n
                `;
                client.sendMessage(msg.from, message);
            }
          
        }

        if (/\s/.test(msg.body)) {
            const newBody = msg.body.split(' ')[1].toLowerCase();
            const coronaData = await helpers.getAllCorona();
            const findData = coronaData.find((data) => data.Location == newBody);
            if (findData) {
                let chat = await msg.getChat();
                if(!chat.isGroup) {
                    const message = 
                    `
                    *Corona Detail ${newBody}*\n\nTerkonfirmasi: ${findData['Confirmed cases']} 😧\nSembuh: ${findData.Recovered} 😍\nMeninggal: ${findData.Deaths} 😢
                    \n\nKetik */help*\n\nAyo Cegah corona dengan *#DirumahAja*
                    `;
                    msg.reply(message);
                }
            }else{
                let chat = await msg.getChat();
                if(!chat.isGroup) {
                    const message = 
                    `
                    *OOps Nama Negara tidak ditemukan :'(*\n\nKetik */help*\n\nAyo Cegah corona dengan *#DirumahAja*
                    `;
                    msg.reply(message);
                }
            }
        }

        if (msg.body == '!corona') {
            // Send a new message as a reply to the current one
            const dataCorona = await helpers.getCoronaIndonesia();
            const coronaData = await helpers.getAllCorona();
            let chat = await msg.getChat();
            if(!chat.isGroup) {
                const message = 
                `
                *Corona Detail*\n\n*Update Terakhir : ${moment(dataCorona.metadata.lastUpdatedAt).format('DD/MM/YY hh:mm:ss')}*\n\n*Indonesia :*\n\nTerkonfirmasi: ${dataCorona.confirmed.value} 😧\nDalam Perawatan: ${dataCorona.activeCare.value} 👩‍⚕\nSembuh: ${dataCorona.recovered.value} 😍\nMeninggal: ${dataCorona.deaths.value} 😢
                \n\n*Dunia :*\n\nTerkonfirmasi: ${coronaData[0]['Confirmed cases']} 😧\nSembuh: ${coronaData[0].Recovered} 😍\nMeninggal: ${coronaData[0].Deaths} 😢\n\nKetik */help*\n\nAyo Cegah corona dengan *#DirumahAja*
                `;
                msg.reply(message);
            }
        }
   
    
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

