'use strict';

var AWS = require('aws-sdk');
var models = require('./models');

module.exports.reap = async (event, context) => {
  return models.Gateway.scan("gateways")
  .map(item => {
    return item.update({dogSays:'bow'})
  })
  .then((result)=> {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Go Serverless v1.0! Your function executed successfully!',
        result:'OK',
        input: event,
      }),
    };
  });

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
