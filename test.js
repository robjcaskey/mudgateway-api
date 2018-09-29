
  function telnetConnection(host, port) {
    return new Promise((resolve, reject) => {
      var timer = setTimeout(()=> {
        client.destroy();
        resolve(output);
      },300);
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
  var fs = require('fs');
  var mudListData = fs.readFileSync("mud-list.json");
  var muds = JSON.parse(mudListData);
  return Promise.all(muds.map(mud => {
    return telnetConnection(mud.host, mud.port)
    .catch(()=> {
    })
    .then(output => {
      mud.output = output;
      return mud;
    })
  }))
  .then(updatedMuds => {
    console.log(updatedMuds)
    //console.log(JSON.stringify(updatedMuds));
  });
