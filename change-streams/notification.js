
const Model = require('../models/notificationModel');
const Notify = require('../services/delivery');
const logger = require('../common/middlewares/logger');

const pipeline = [
  {
    $match: {
      operationType: 'insert',
    },
  },
];
const CS = Model.watch(pipeline, { fullDocument: 'updateLookup' });


CS.on('change', async (data) => {
  try {
    const result = await Notify(data.fullDocument);
    logger.info(`${data.fullDocument._id} deliverd successfully to all provided mediums , result is ${JSON.stringify(result)}`);
  } catch (err) {
    logger.error(err);
  }
});
