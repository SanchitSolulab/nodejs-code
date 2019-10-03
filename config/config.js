const moment = require('moment');

module.exports = {
  db: {
    str: 'mongodb://123123:123123@123123.mongodb.net:27017/123123',
    options: {
      auto_reconnect: true,
      reconnectTries: Number.MAX_SAFE_INTEGER,
      poolSize: 200,
      useNewUrlParser: true,
      readPreference: "primaryPreferred"
    }
  },
  webAppBaseUrl: "",
  appSecret: "",
  fbCredentials: {
    userDetailsUrl: ""
  },
  emailSettings: {
    apiKey: "",
    domain: "",
    admin: {
      email: "",
      sms: "",
      whatsapp: ""
    },
    from: ""
  },
  notificationSettings: {
    deliveryModes: {
      email: "email",
      sms: "sms",
      whatsapp: "whatsapp",
      push: "push"
    },
    notificationTypes: {
      REMINDER: "REMINDER",
      USER_REGISTERED: "USER_REGISTERED",
      JOB_ERROR: "JOB_ERROR",
      GET_VERIFICATION_CODE: "GET_VERIFICATION_CODE",
      FORGOT_PASSWORD: "FORGOT_PASSWORD",
      CHANGE_PASSWORD: "CHANGE_PASSWORD",
      OTP_SEND: "OTP_SEND",
      ENROLL_HOST: "ENROLL_HOST"
    },
    deliveryModesForNotificationTypes: {
      JOB_ERROR: ["email"],
      USER_REGISTERED: ["sms"],
      REMINDER: ["email", "sms", "whatsapp"],
      GET_VERIFICATION_CODE: ["email"],
      FORGOT_PASSWORD: ["email"],
      CHANGE_PASSWORD: ["sms"],
      JOB_ERROR_RESOLVED: ["email", "sms", "whatsapp"],
      OTP_SEND: ["sms"],
      ENROLL_HOST: ["email"]
    }
  },
  userSettings: {
    roles: {
      ADMIN: "ADMIN",
      USER: "USER"
    }
  },
  emailRegex: /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i,
  verificationCodeValidity: 10,
  ticketSettings: {
    defaultTickets: 10,
    rewards: {
      ticketType: "regular",
      count: 3
    },
    expiredIn: 30, // in days
    ticketTypes: {
      regular: "regular",
      gold: "gold",
      platinum: "platinum"
    },
    ticketWeightes: {
      regular: 1,
      gold: 3,
      platinum: 5
    },
    ticketImages: {
      regular: "tickets/regular",
      gold: "tickets/gold",
      platinum: "tickets/platinum"
    },
    ticketDescriptions: {
      regular: "Regular ticket description",
      gold: "Gold ticket description",
      platinum: "Platinum ticket description"
    }
  },
  jwplayer: {
    api_format: "json",
    api_key: "",
    api_nonce: () => Math.floor(Math.random() * 100000000),
    shared_secret: ""
  },
  twilio: {
    accountSid: "",
    authToken: "",
    fromNumber: ""
  },
  dateTimeSettings: {
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  }
};
