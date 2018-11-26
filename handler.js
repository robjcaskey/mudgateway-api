'use strict';

var AWS = require('aws-sdk');
var models = require('./models');

module.exports.reap = async (event, context) => {
  var currentTimestamp = Date.now();
  return models.Gateway.scan()
  .filter(x => currentTimestamp - x.created > (24*60*60*1000))
  .map(item => {
    return item.delete();
  })
  .then((result)=> {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'removed old instances',
        result:'OK',
        input: event,
      }),
    };
  });
};
