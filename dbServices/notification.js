const Model = require('../models/notificationModel');

const { notificationSettings: { deliveryModesForNotificationTypes }, emailSettings } = require('../config/config');


exports.save = async ({
  notificationType, metadata, userId: from, to = 'admin', deliveryInfo,
}) => {
  try {
    const notification = {
      from: from || emailSettings.from,
      to,
      deliveryModes: deliveryModesForNotificationTypes[notificationType],
      metadata,
      notificationType,
      deliveryInfo: to === 'admin' ? { email: emailSettings.admin.email } : deliveryInfo,
    };
    await new Model(notification).save();
    return true;
  } catch (error) {
    throw error;
  }
};
