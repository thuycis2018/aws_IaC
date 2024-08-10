'use strict';

const AWS = require('aws-sdk');
const orderManager = require('./orderManager');
const kinesisHelper = require('./kinesisHelper');
const producerManager = require('./producerManager');
const deliveryManager = require('./deliveryManager');

// Create a CloudWatch client
const cloudwatch = new AWS.CloudWatch();

function createResponse(statusCode, message) {
  const response = {
    statusCode: statusCode,
    body: JSON.stringify(message)
  };

  return response;
}

// Function to publish metrics to CloudWatch
function publishMetric(name, value) {
  const params = {
    MetricData: [
      {
        MetricName: name,
        Unit: 'Count',
        Value: value
      },
    ],
    Namespace: 'MyService/Performance'
  };

  return cloudwatch.putMetricData(params).promise();
}

module.exports.createOrder = async (event) => {
  const body = JSON.parse(event.body);
  const order = orderManager.createOrder(body);

  return orderManager.placeNewOrder(order).then(() => {
    // Publish success metric
    publishMetric('OrdersPlaced', 1);
    return createResponse(200, order);
  }).catch(error => {
    // Publish failure metric
    publishMetric('OrderPlacementFailures', 1);
    return createResponse(400, error);
  });
};

module.exports.orderFulfillment = async (event) => {
  const body = JSON.parse(event.body);
  const orderId = body.orderId;
  const fulfillmentId = body.fulfillmentId;

  return orderManager.fulfillOrder(orderId, fulfillmentId).then(() => {
    // Publish success metric
    publishMetric('OrdersFulfilled', 1);
    return createResponse(200, `Order with orderId:${orderId} was sent to delivery`);
  }).catch(error => {
    // Publish failure metric
    publishMetric('OrderFulfillmentFailures', 1);
    return createResponse(400, error);
  });
};

module.exports.notifyExternalParties = async (event) => {
  const records = kinesisHelper.getRecords(event);

  const producerPromise = getProducerPromise(records);
  const deliveryPromise = getDeliveryPromise(records);

  return Promise.all([producerPromise, deliveryPromise]).then(() => {
    // Publish success metric
    publishMetric('ExternalNotificationsSent', 1);
    return 'everything went well';
  }).catch(error => {
    // Publish failure metric
    publishMetric('ExternalNotificationFailures', 1);
    return error;
  });
};

module.exports.notifyDeliveryCompany = async (event) => {
  // Some HTTP call!
  console.log('Lets imagine that we call the delivery company endpoint');

  // Publish metric
  publishMetric('DeliveryCompanyNotified', 1);

  return 'done';
};

module.exports.orderDelivered = async (event) => {
  const body = JSON.parse(event.body);
  const orderId = body.orderId;
  const deliveryCompanyId = body.deliveryCompanyId;
  const orderReview = body.orderReview;

  return deliveryManager.orderDelivered(orderId, deliveryCompanyId, orderReview).then(() => {
    // Publish success metric
    publishMetric('OrdersDelivered', 1);
    return createResponse(200, `Order with ${orderId} was delivered successfully by companyId ${deliveryCompanyId}`);
  }).catch(error => {
    // Publish failure metric
    publishMetric('OrderDeliveryFailures', 1);
    return createResponse(400, error);
  });
};

module.exports.notifyCustomerService = async (event) => {
  console.log('Lets imagine that we call the customer service endpoint');

  // Publish metric
  publishMetric('CustomerServiceNotified', 1);

  return 'done';
};

function getProducerPromise(records) {
  const ordersPlaced = records.filter(r => r.eventType === 'order_placed');

  if (ordersPlaced.length > 0) {
    return producerManager.handlePlacedOrders(ordersPlaced);
  } else {
    return null;
  }
}

function getDeliveryPromise(records) {
  const orderFulfilled = records.filter(r => r.eventType === 'order_fulfilled');

  if (orderFulfilled.length > 0) {
    return deliveryManager.deliveryOrder(orderFulfilled);
  } else {
    return null;
  }
}
