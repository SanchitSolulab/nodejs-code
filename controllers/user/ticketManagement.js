const { handleResponse, handleError } = require('../../common/middlewares/requestHandlers');
// TODO:- make a ticket purchase functionality
const { dailyRewardsOnLogin } = require('../../dbServices/user');


exports.purchase = async (req, res) => {
  try {
    // let data = await updateFilters(userId,{contestFilters})
    return handleResponse({ res, data: true });
  } catch (err) {
    return handleError({ res, err });
  }
};

exports.dailyRewardsOnLogin = async ({ user: { _id: userId } }, res) => {
  try {
    const data = await dailyRewardsOnLogin(userId);
    return handleResponse({ res, data });
  } catch (err) {
    return handleError({ res, err });
  }
};
