var Dynamite = require('./Dynamite');

var models = {}
models.Gateway = new Dynamite.define("gateways", {
  address:true,
  created:true,
  cowSays:true,
  dogSays:true,
},{
  primaryPartitionKey:"address",
  primarySortKey:"created"
});

module.exports = models;
