// index.js

const fs = require('fs');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express')
const app = express()
const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();
const uuidv4 = require('uuid/v4');


var models = require('./models');
var TABLE_PREFIX = process.env.TABLE_PREFIX;
var SECURITY_GROUP_NAME="mudconnect-proxy";
var initScriptTemplate = fs.readFileSync("init_script.sh");


// hmmm
app.use(bodyParser.json({ strict: false }));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

//var ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});
var docClient = new AWS.DynamoDB.DocumentClient();

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
    models.Ban.create({
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
    return models.Connection.create({
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
module.exports.testQuery = function(req, res) {
  var instanceUuid = "9f8bae4b-22e7-4f21-bae1-d92f50d990cd";
  return spawnPortal()
  .then(()=> {
    console.log("DONE")
  });
}
app.all('/registerGateway', (req, res) => {
  var timestamp = new Date().getTime();
  function checkAllowed() {
    return Promise.resolve(true);
  }

  var instanceUuid = req.body.MUDGATEWAY_ACCESS_KEY_ID;
  var secretKey = req.body.MUDGATEWAY_SECRET_ACCESS_KEY;

  return checkAllowed()
  .then(mud => {
    return models.Gateway.findById(instanceUuid)
    .then(instance => {
      return instance.update({
        'registered' : timestamp,
        'address': req.connection.remoteAddress
      })
    })
  })
  .then(() => {
    return res.send("OK");
  })
  .catch(e => {
    reportDynamoError(res, e);
  });
});
function getCurrentPortal() {
  return models.Gateway.scan()
  .then(items => {
    if(typeof(items) == 'undefined') {
      return;
    }
    items.sort((a,b) => a.created - b.created);
    return items[0];
  })
}

function spawnPortal() {
  var uuid = uuidv4();
  // Amazon Linux 2 AMI (HVM), SSD Volume Type
  //var AMI =  "ami-04681a1dbd79675a5"
  // Ubuntu 18.04 LTS
  var AMI = "ami-0ac019f4fcb7cb7e6";
  var INSTANCE_TYPE = "t2.nano";
  
  function runInstance(params) {
    return new Promise((resolve, reject) => {
      ec2.runInstances(params, (err, result) => {
        if(err) {
          reject(err);
        }
        else {
          resolve(result);
        }
      });
    });
  }
  var currentTimestamp = Date.now();
  return models.Gateway.create({uuid:uuid,created:currentTimestamp})
  .then(() => {
    var initScript = initScriptTemplate.toString().replace('{{uuid}}',uuid).replace('{{secret}}','dummy');
    var encoded_init_script = new Buffer(initScript).toString('base64');
    return runInstance({
      // no ssh access for production
      KeyName:'caskeyOrgMasterKeypair',
      ImageId:AMI,
      InstanceType:INSTANCE_TYPE,
      SecurityGroups: [SECURITY_GROUP_NAME],
      MinCount:1,
      MaxCount:1,
      InstanceInitiatedShutdownBehavior:'terminate',
      UserData:encoded_init_script
    });
  })
  .then(()=> {
    return uuid;
  });
}

app.all('/getPortalUrl', (req, res) => {
  return getCurrentPortal()
  .then(result => {
    if(!result) {
      return spawnPortal()
      .then(endpointUuid=> {
        return {status:"starting",endpointUuid:endpointUuid}
      }); 
    }
    else if(result.address) {
      var portalUrl = "ws://"+result.address+":"+8080+"/";
      return {
        status:"running",
        endpointUuid:result.uuid,
        portalUrl:portalUrl
      }
    }
    else {
      return {status:"starting", endpointUuid:result.uuid}
    }
  })
  .then(result => res.json(result));
});
app.all('/checkPortalUrlCurrent', function(req, res) {
  return getCurrentPortal()
/*
  .then(recentGateway => {
    var port = 8080;
    var portalUrl = "ws://"+recentGateway.address+":"+8080+"/";
    return {
      portalUrl:portalUrl
    }
  })
*/
  .then(result => res.json(result))
  .catch(e => {
    return reportDynamoDbError(res, e);
  })
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
