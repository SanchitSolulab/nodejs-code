
const { schedule } = require('node-cron');
const moment = require('moment');
const logger = require('../common/middlewares/logger');
const { getWinners } = require('../dbServices/vote');

schedule('55 11 * * *', async () => {
  logger.info('I am going to run every midnight');
  try {
    const winnersInEachContest = await getWinners(moment().subtract(24, 'h').toDate(), new Date());
    logger.info(winnersInEachContest);
    // add them in daily winner table
    // transfer them money
    return true;
  } catch (error) {
    throw error;
  }
});
