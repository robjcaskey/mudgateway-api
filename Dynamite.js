var AWS = require('aws-sdk');
var docClient = new AWS.DynamoDB.DocumentClient();
var TABLE_PREFIX = process.env.TABLE_PREFIX;
var Promise = require('bluebird');

function prefixed(tableName) {
  return TABLE_PREFIX+tableName;
}

function define(tableName, fields, options) {
  var Model = function() {}
  Model.tableName = tableName;
  Model.primaryPartitionKey = options.primaryPartitionKey;
  Model.primarySortKey = options.primarySortKey;

  Model.scan = function() {
    var params = {
      TableName:prefixed(tableName)
    }
    return new Promise((resolve, reject) => {
      return docClient.scan(params, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(Promise.map(data.Items, item => {
            return Model.build(item);
          }));
        }
      });
    });
  }
  Model.build = function(data) {
    var instance = new Model();
    instance.model = Model;
    for(var key in data) {
      instance[key] = data[key];
    }
    if(typeof(Model.afterBuild) !== 'undefined') {
      return Model.afterBuild(instance);
    }
    else {
      return Promise.resolve(instance);
    }
  }
  Model.prototype.save = function() {
    var params = {
      TableName:prefixed(tableName),
      Item:this.getSubmissionData()
    }

    return new Promise((resolve, reject) => {
      return docClient.put(params, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }
  Model.prototype.delete = function() {
    var params = {
      TableName:prefixed(tableName),
      key:this.getKey()
    }
    return new Promise((resolve, reject) => {
      return docClient.delete(params, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }
  Model.prototype.update = function(data) {
    for(var key in data) {
      this[key] = data[key];
    }
    return this.save();
  }
  Model.prototype.getSubmissionData = function() {
    var obj = {};
    Object.keys(fields).forEach(key => {
      obj[key] = this[key];
    });
    return obj;
  }
  Model.prototype.getKey = function() {
    var ppKey = Model.primaryPartitionKey;
    var ppVal = this[ppKey];
    var psKey = Model.primarySortKey;
    var key = {}
    key[ppKey] = ppVal;
    if(psKey) {
      var psVal = this[psKey];
      key[psKey] = psVal;
    }
    return key;
  }
  return Model; 
}

module.exports = {
  define:define
}
