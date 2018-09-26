const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express(); 
const fs = require('fs')
const http = require('http').Server(app);;
const dataFile = './data.json';
const formidable = require('formidable');
const io = require('socket.io')(http);
const dataFormat = 'utf8';
// Mongo DataBase
const MongoClient = require('mongodb').MongoClient;
const dbURL = 'mongodb://localhost:27017/students';
const verbose = false;
// CORS
// We are enabling CORS so that our 'ng serve' Angular server can still access
// our Node server. 
const cors = require('cors');
var corsOptions = {
  origin: 'http://localhost:4200',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204 
};

require('./listen.js')(http);
require('./socket.js')(app, io);
//require('./uploads.js')(app, formidable);

app.use(cors(corsOptions))
// Body-Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Basic Routes
app.use(express.static(path.join(__dirname, '../dist/chat-app')));
app.use(express.static(path.join(__dirname, './images')));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname,'../dist/chat-app/index.html'))
});
app.get('/home', function(req,res){
    res.sendFile(path.join(__dirname,'../dist/chat-app/index.html'))
});
// Login Module
const login = require('./login.js')();
const groups = require('./groups.js')();
//Mongo Databease 
app.get('/db/install', function(req, res){
	 console.log('Setting up initial db state');
     MongoClient.connect(dbURL, function(err, db){
         if(err){
			throw err;
		 }
         console.log('SUCCESS: connected to db');
         var dbo = db.db('users');

         // Drop collection
         dbo.collection('users').drop(function(err, delOk){
             if(err){
                 console.log('ERROR: failed drop collection users');
                 if(verbose) console.log(err)
             };
             if(delOk){
				 console.log('SUCCESS: dropped collection users');
			 }
         });
		 
		 var data = [
             { username: 'James', password: 'pass'},
             { username: 'John', password: 'pass'},
             { username: 'Jane', password: 'pass'},
             { username: 'Mary', password: 'pass'}
         ];
         dbo.collection('users').insertMany(data, function(err, res){
             if(err){
				 throw err;
			 }
             console.log('Inserted ' + res.insertedCount + ' documents to users');
         });
		 
		 dbo.collection('users').find({}).toArray(function(err, result) {
             if(err){
				 throw err;
			 }
             console.log(result);
             db.close();
         });
         db.close();
	 });
});

app.get('/api/users', function (req, res){
     var reader = require('./read.js')(MongoClient, dbURL);
     reader.getUsers(res);
});

app.post('/api/user', function (req, res) {
     var writer = require('./add.js')(MongoClient, dbURL);
     var newUser = {
         'username': req.body.username,
         'password': req.body.password
     }
     writer.addUser(newUser, res);
});

app.put('/api/user/:id', function (req, res) {
     console.log('update user');
     var updater = require('./update.js')(MongoClient, dbURL);
     updater.updateUser(req.body, res);
});

app.delete('/api/user/:id', function (req, res){
     console.log('delete user: ' + req.params.id);
     var deleter = require('./remove.js')(MongoClient, dbURL);
     deleter.removeUser(req.params.id, res);
});

// Login
app.post('/api/login', function(req, res){
     fs.readFile(dataFile, dataFormat, function(err, data){
         data = JSON.parse(data);
         var username = req.body.username;
         var password = req.body.password;		 
         login.data = data;
         var match = login.findUser(username, password); 
         // Check to see if we have a match, get groups if true
         if(match !== false){
             groups.data = data;
             match.groups = groups.getGroups(username, match.permissions);
         }
         //console.log(match.groups[0].channels[0])
         res.send(match);
     });
});
// Group APIs
app.post('/api/groups', function(req,res){
    // We want to authenticate again -- usually you'd use a token
     fs.readFile(dataFile, dataFormat, function(err, data){
         data = JSON.parse(data);
         var username = req.body.username; 
         login.data = data;
         var match = login.findUser(username);    
         // Check to see if we got a match, get groups if true
         if(match !== false){
             groups.data = data;
             match.groups = groups.getGroups(username, match.permissions);
         }
         res.send(match);
     });
});

app.delete('/api/group/delete/:groupname', function(req, res){
     var groupName = req.params.groupname;
     // Read the JSON file to get the current data
     fs.readFile(dataFile, dataFormat, function(err, data){
         var readData = JSON.parse(data);
         groups.data = readData.groups;
         readData.groups = groups.deleteGroup(groupName);
         console.log(readData);
         var json = JSON.stringify(readData);
         // Write the updated data to JSON
         fs.writeFile(dataFile, json, dataFormat, function(err, d){
             res.send(true);
             console.log('Deleted group: ' + groupName);
         });
     });
});

app.post('/api/group/create', function(req, res){
     var groupName = req.body.newGroupName
     if(groupName == '' || groupName == 'undefined' || groupName == null){
         res.send(false);
     } else {
        // Read the JSON file to get an updated list of groups
        fs.readFile(dataFile, dataFormat, function(err, data){
             var readData = JSON.parse(data);
             var g = readData.groups;    
             var newGroup = {
                 'name': req.body.newGroupName,
                 'admins':[],
                 'members':[]
             }
             g.push(newGroup)
             readData.groups = g;
             var json = JSON.stringify(readData);      
             // Write the updated data to the JSON file.
             fs.writeFile(dataFile, json, dataFormat, function(err, data){
                 res.send(true);
                 console.log('Created new group: ' + req.body.newGroupName);
             });
         });
     }
})
 