
const { schedule } = require('node-cron');
const logger = require('../common/middlewares/logger');

schedule('0 0 1 * *', async () => {
  logger.info('I am going to run every month start');
  // TODO-> query through all contests then find max votes received by a person in previous month
  // add them in winner table as monthly winners
  // make isMonthlyWiner flag true and add date in user table
  // transfer them money
  return true;
});
