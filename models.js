var Dynamite = require('./Dynamite');

var models = {}
models.Gateway = new Dynamite.define("gateways", {
  uuid:true,
  address:true,
  created:true,
  cowSays:true,
  dogSays:true,
  obsolete:true,
},{
  primaryPartitionKey:"uuid"
});

models.Ban = new Dynamite.define("bans", {
  banned:true,
  host:true,
  host:true,
  port:true,
  adminCharacterName:true,
  srcAddress:true
},{
  primaryPartitionKey:"host",
  primarySortKey:"banned"
});

models.Connection = new Dynamite.define("connections", {
  connected:true,
  host:true,
  port:true,
  srcAddress:true
}, {
  primaryPartitionKey:"host",
  primarySortKey:"connected"
});

module.exports = models;
