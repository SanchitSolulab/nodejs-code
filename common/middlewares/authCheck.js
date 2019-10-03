const jwt = require('jsonwebtoken');
const { appSecret } = require('../../config/config');
const { handleError } = require('../middlewares/requestHandlers');
const { get } = require('../../dbServices/user');

const appURI = '/v1';
const skipUrls = [
  '/country',
  '/users/verify-otp',
  '/users/resend-otp',
  '/users/change-password',
  '/users/login',
  '/users/register',
  '/users/fbLogin',
  '/users/generate-code',
  '/users/forgot-password',
];

exports.isAuthenticated = async function isAuthenticated(req, res, next) {
  const url = req.url.replace(appURI, '').split('?')[0];
  const token = req.headers.authorization;
  if (skipUrls.indexOf(url) !== -1) return next();
  try {
    const user = await jwt.verify(token, appSecret);
    req.user = await get(user._id, '_id');
    if (!req.user) throw 'Invalid token,No user exists';
    if (req.user.token !== token) {
      throw 'Invalid token';
    }
    if (user.isDeleted === true) {
      throw 'User is deleted';
    }
    if (user.isBlocked === true) {
      throw 'User is blocked';
    }
    return next();
  } catch (err) {
    return handleError({ res, err, statusCode: 401 });
  }
};
