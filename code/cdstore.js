

var mongoose = require("mongoose");
var redisClient = require('redis').createClient;
//REPLACE WITH YOUR REDIS CLUSTER INSTANCE DNS
var redis = redisClient(6379, '<myredis-instance-dns>');
var express = require('express'),
    MongoClient = require('mongodb').MongoClient,
    app = express(),
    //REPLACE WITH YOUR DOCUMENTDB CLUSTER DNS
    mongoUrl = 'mongodb://docdbadmin:docdbadmin@<documentdb-cluster-dns>:27017/?ssl=true&ssl_ca_certs=rds-combined-ca-bundle.pem&replicaSet=rs0';
var db;
MongoClient.connect(mongoUrl, { useNewUrlParser: true }, function (err, client) {
    if (err) throw 'Error connecting to database - ' + err;
 db = client.db('cd')
});

var cache = require('./cache.js');
var cdSchema = new mongoose.Schema({
  title: String,
  singer: String,
  text: String
});

var Song = mongoose.model("Song", cdSchema);
var bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

 app.post('/cd', function (req, res) {
        if (!req.body.title || !req.body.singer) res.status(400).send("Please send a title and an singer of the song”);
        else if (!req.body.text) res.status(400).send("Please send some text lyrics of the song”);
        else {
            cache.SaveSong(db, req.body.title, req.body.singer, req.body.text, function (err) {
                if (err) res.status(500).send("Server error");
                else res.status(201).send("Saved");
            });
        }
    });

app.get('/cd/:title', function (req, res) {
    if (!req.params.title) res.status(400).send("Please send a proper song title");
    else {
        cache.SearchSongByTitle(db, redis, req.params.title, function (cd) {
            if (!req.params.title) res.status(500).send("Server error");
            else res.status(200).send(cd);
        });
    }
});
    app.listen(8082, function () {
        console.log('Listening on port 8082');
    }); 