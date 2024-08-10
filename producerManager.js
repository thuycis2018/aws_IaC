'use strict'

const AWS = require('aws-sdk');
const ses = new AWS.SES({
    region: process.env.region
});

const PRODUCER_EMAIL = process.env.producerEmail;
const ORDERING_SYSTEM_EMAIL = process.env.orderingSystemEmail;

module.exports.handlePlacedOrders = ordersPlaced => {
    var ordersPlacedPromises = [];

    for (let order of ordersPlaced) {
        const temp = notifyProducerByEmail(order);
        
        ordersPlacedPromises.push(temp);
    }

    return Promise.all(ordersPlacedPromises);
}

function notifyProducerByEmail(order) {
    const params = {
        Destination: {
            ToAddresses: [PRODUCER_EMAIL]
        },
        Message: {
            Body: {
                Text: {
                    Data: JSON.stringify(order)
                }
            },
            Subject: {
                Data: 'New order'
            }
        },
        Source: ORDERING_SYSTEM_EMAIL
    };

    return ses.sendEmail(params).promise().then((data) => {
        return data;
    });
}