const FCM = require("fcm-node");
const serverConfig = require("./../../config/dev_contestee-dev-firebase-adminsdk-szgl4-938aa3714b.json");

var fcm = new FCM(serverConfig);

module.exports = async ({ to, metadata }) => {
  try {
    const { title, body } = metadata;
    var message = {
      to: to,
      notification: {
        title: title,
        body: body
      },
      data: metadata
    };
    fcm.send(message, function(err, response) {
      if (err) {
        throw err;
      }
      return true;
    });
  } catch (error) {
    throw error;
  }
};
