const twilio = require('twilio');
const { accountSid, authToken, fromNumber } = require('../../config/config').twilio;

const client = twilio(accountSid, authToken);


module.exports = async ({
  metadata, to,
}) => {
  await client.messages
    .create({
      body: metadata.subject,
      from: fromNumber,
      to,
    })
    .then(message => message);
};
