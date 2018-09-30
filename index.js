// index.js

const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express')
const app = express()
var AWS = require('aws-sdk');
var TABLE_PREFIX = process.env.TABLE_PREFIX;

// hmmm
app.use(bodyParser.json({ strict: false }));
app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

//var ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});
var docClient = new AWS.DynamoDB.DocumentClient();

function put(tableName, item) {
  var params = {
    TableName:TABLE_PREFIX+tableName,
    Item:item
  }
  return new Promise((resolve, reject) => {
    docClient.put(params, function(err, data) {
      if (err) {
        reject(err);
      } else {
        
        resolve(data);
      }
    });
  })
}
function scan(tableName, item) {
  var params = {
    TableName:TABLE_PREFIX+tableName,
  }
  return new Promise((resolve, reject) => {
    return docClient.scan(params, function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function getMudList() {
  var fs = require('fs');
  var mudListData = fs.readFileSync("mud-list.json");
  var muds = JSON.parse(mudListData);
  return Promise.resolve(muds);
}

function getMudData(host, port) {
  return getMudList()
  .then(muds => {
    var filtered =muds.filter(mud => mud.host == host && mud.port == port);
    if(filtered.length > 0) {
      var mud = filtered.pop();
      return mud;
    }
    else {
      return new Error("no mud found in database for current connection");
    }
  });
}


app.get('/', function (req, res) {
  res.send('Hello World!')
})
app.get('/more', function (req, res) {
  res.send('Hefllo World!')
})
app.get('/dumpConnections', function (req, res) {
  return scan('connections')
  .then(result => {
    return res.json(result.Items);
  })
  .catch(e => {
    return reportDynamoDbError(res, e);
  })
})
app.get('/dumpConnections/html', function (req, res) {
  return scan('connections')
  .then(result => {
    return res.render("itemList",result.Items);
  })
  .catch(e => {
    return reportDynamoDbError(res, e);
  })
})
function reportDynamoError(res, e) {
  return res.status(500).send("db error: "+e);
}
app.post('/attemptBan', (req, res) => {
  return getMudData(req.body.host, req.body.port)
  .then(mud => {
    var adminCharacterName = req.body.adminCharacterName;
    if(typeof(mud.admins) !== 'undefined') {
      if(mud.admins.indexOf(adminCharacterName) !== -1) {
        return true;
      }
    }
    return new Error();
  })
  .then(()=> {
    var timestamp = new Date().getTime();
    return put('bans', {
      'banned' : timestamp,
      'host' : req.body.host,
      'port' : req.body.port,
      'adminCharacterName' : req.body.adminCharacterName,
      'srcAddress' : req.body.srcAddress.address,
    })
    .then(() => {
      res.send("OK");
    })
    .catch(e => {
      return reportDynamoDbError(res, e);
    });
  })
  .catch(e => {
    return res.status(500).send("not an admin on this game");
  });
});
app.post('/checkAllowed', (req, res) => {
  var timestamp = new Date().getTime();
  return getMudList()
  .then(muds => {
    var filtered =muds.filter(mud => mud.host == req.body.host && mud.port == req.body.port);
    if(filtered.length > 0) {
      var mud = filtered.pop();
      return mud;
    }
    else {
      var desc = req.body.host+":"+req.body.port;
      return res.status(500).send(desc+" is not on our list of allowed hosts");
    }
  })
  .then(mud => {
    // check and see if this ip is banned
    return Promise.resolve(mud);
  })
  .then(mud => {
    // log access
    return put('connections', {
      'connected' : timestamp,
      'host' : req.body.host,
      'port' : req.body.port,
      'srcAddress' : req.body.srcAddress.address
    })
  })
  .then(() => {
    return res.send("OK");
  })
  .catch(e => {
    reportDynamoError(res, e);
  });
});
app.all('/getPortalUrl', function(req, res) {
  res.json({
    portalUrl:"ws://54.197.28.49:8080/"
  });
});
app.get('/inquire', function (req, res) {
  function telnetConnection(host, port) {
    return new Promise((resolve, reject) => {
      var timer = setTimeout(()=> {
        client.destroy();
        resolve(output);
      },3000);
      var output = "";
      var client = new net.Socket();
      client.on('error', err => {
        clearTimeout(timer);
        client.destroy();
        reject(err);
      });
      client.connect(port, host, ()=> {
      })
      client.on('data', data => {
        output += data.toString();
      });
    });
  }
  var net = require('net');
  return getMudList()
  .then(muds => {
    return Promise.all(muds.map(mud => {
      return telnetConnection(mud.host, mud.port)
      .catch(()=> {
      })
      .then(output => {
        mud.output = output;
        return mud;
      })
    }))
  })
  .then(updatedMuds => {
    res.json(updatedMuds);
  });
})


module.exports.handler = serverless(app);
