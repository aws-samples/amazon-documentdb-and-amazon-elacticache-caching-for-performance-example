module.exports.SaveSong = function (db, title, singer, text, callback) {
    db.collection('text').insertOne({
        title: title,
        singer: singer,
        text: text
    }, callback);
};

module.exports.SearchSongByTitle = function (db, redis, title, callback) {
    redis.get(title, function (err, reply) {
        if (err) callback(null);
        else if (reply) //Song does not exist in cache
        callback(JSON.parse(reply));
        else {
            //Song doesn't exist in cache so need to query the database
            db.collection('text').findOne({
                title: title
            }, function (err, doc) {
                if (err || !doc) callback(null);
                else {//Song found in database,return to client and save to cache and return to client
                    redis.set(title, JSON.stringify(doc), function () {
                        callback(doc);
                    });
                }
            });
        }
    });
};