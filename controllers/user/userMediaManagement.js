
const { handleResponse, handleError } = require('../../common/middlewares/requestHandlers');
const { getFeaturedVideos } = require('./../../dbServices/user');


exports.getFeaturedVideos = async ({ query: { skip, limit }, user: { userId } }, res) => {
  try {
    const data = await getFeaturedVideos(userId, +skip || 0, +limit || 10);
    handleResponse({ res, data });
  } catch (err) {
    handleError({ res, err });
  }
};
