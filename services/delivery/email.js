const mailgunModule = require('mailgun-js');
const {
  apiKey,
  domain,
} = require('../../config/config').emailSettings;
const templates = require('./templates');

const mailgun = mailgunModule({ apiKey, domain, retry: 10 });


module.exports = async ({
  deliveryInfo: { email }, notificationType, metadata, from, _id: notificationId,
}) => {
  try {
    if (!email || !from) return true;
    const body = await mailgun.messages().send({
      to: email,
      from,
      subject: metadata.subject || notificationType,
      html: templates[notificationType].email({ ...metadata, notificationId }),
    });
    return body;
  } catch (error) {
    throw error;
  }
};
