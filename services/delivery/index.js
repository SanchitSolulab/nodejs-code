const deliveryServices = {
  email: require("./email"),
  sms: require("./sms"),
  push: require("./pushNotification")
};

module.exports = async ({ deliveryModes = [], ...data }) => {
  try {
    const result = await Promise.all(deliveryModes.map(mode => deliveryServices[mode](data)));
    return result;
  } catch (error) {
    throw error;
  }
};
