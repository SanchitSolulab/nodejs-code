
const mongoose = require('mongoose');
const db = require('../connections/dbMaster');
const { notificationSettings: { deliveryModes, notificationTypes } } = require('../config/config');

const NotificationSchema = new mongoose.Schema({
  to: mongoose.Schema.Types.Mixed,
  from: mongoose.Schema.Types.Mixed,
  deliveryModes: [{ type: String, enum: Object.keys(deliveryModes), required: true }],
  deliveryInfo: {
    email: String,
    sms: String,
    whatsapp: String,
    push: String,
  },
  notificationType: { type: String, required: true, enum: Object.keys(notificationTypes) },
  created: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  metadata: {},
});

NotificationSchema.index({ to: 1, notificationType: 1 }, { background: true });

module.exports = db.model('Notification', NotificationSchema);
