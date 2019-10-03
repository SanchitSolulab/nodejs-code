const { handleError } = require("../middlewares/requestHandlers");
const {
  userSettings: { roles }
} = require("../../config/config");

exports.isAdmin = async function isAdmin({ user: { role } }, res, next) {
  if (role === roles.ADMIN) return next();
  return handleError({
    res,
    err: "Only Admin Allowed to access",
    statusCode: "401"
  });
};
