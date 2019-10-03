const jwt = require("jsonwebtoken"); // used to create, sign, and verify tokens
const {
  appSecret,
  emailRegex,
  notificationSettings: { notificationTypes }
} = require("../../config/config");
const { handleResponse, handleError } = require("../../common/middlewares/requestHandlers");
const {
  getSearchContest,
  getSearchContestant,
  getSearchVoters,
  save,
  get,
  getUsersMainProfileData,
  update,
  getUserList,
  changeUserStatusBlock,
  deleteUserByAdmin,
  changeUserStatusReport,
  getHistoryUserData,
  getUserAvalibleTickets,
  getCountryWiseUserCount,
  getUserEnrolledContests,
  getExploreList,
  logout,
  giveUserFeedback,
  getUserBookmarkPosts,
  getContestProfileDetails,
  getUserRelatedData,
  getCityWiseContestantsCount,
  getUserLocation,
  getAllContestant,
  getContestantCount,
  getGlobalStatistic,
  getContesteeByContestName,
  getPostedVideoList,
  changePostedVideoStatus,
  featuredMediaListByContestName,
  getUserAnalytics,
  getAnalyticsByGender,
  getAnalyticsByArea,
  getUserEnrolledAsHosts,
  getHostProfile
} = require("../../dbServices/user");

const { save: saveNotification } = require("../../dbServices/notification");
// const { upload } = require('../services/awsService');
const { generateRandonCode, generateCodeExpiry } = require("../../common/utils/util");

const generateJwtToken = async user => {
  const token = await jwt.sign(user._doc || user, appSecret, {});
  return token;
};

exports.login = async ({ body: { phone, password, countryCode } }, res) => {
  try {
    if (!phone) throw "Incorrect phone number or password. Make sure it's typed correctly";
    let user = await get(phone, "phone");
    if (!user || !(await user.verifyPassword(password)) || user.countryCode !== countryCode)
      throw "Incorrect phone number or password. Make sure it's typed correctly";
    if (user.isDeleted) throw "User does not exist";
    if (user.isBlocked === true) throw "User is Blocked";
    delete user._doc.password;
    const withoutToken = { ...user._doc };
    delete withoutToken.token;
    delete withoutToken.enrolledContests;
    const newToken = await generateJwtToken(withoutToken);
    user = await update(user.id, { token: newToken });
    const updatedUserData = await getUsersMainProfileData(user._id);
    handleResponse({ res, data: updatedUserData });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.register = async ({ body }, res) => {
  try {
    let user = await save(body);
    let { countryAlpha3Code } = body;
    delete user._doc.password;
    const newToken = await generateJwtToken(user);
    const otpCode = await Math.floor(100000 + Math.random() * 900000);
    user = await update(user.id, {
      token: newToken,
      code: otpCode,
      codeExpiry: generateCodeExpiry(),
      locationInfo: { country: countryAlpha3Code }
    });
    const updatedUserData = await getUsersMainProfileData(user._id);
    const phoneNumber = (await user.countryCode) + user.phone;
    await saveNotification({
      notificationType: notificationTypes.USER_REGISTERED,
      to: phoneNumber,
      metadata: {
        subject: `Verification code for verification : ${otpCode}
                  Verification code Expiry: ${user.codeExpiry}`
      }
    });
    return handleResponse({ res, data: updatedUserData });
  } catch (err) {
    return handleError({ res, err });
  }
};

exports.socialLogin = async (req, res) => {
  try {
    // Assuming FB response always have email field.
    let user = await get(req.body.email, "email");
    let msg;
    if (user) {
      user.password = undefined;
      msg = "Logged in successfully";
    } else {
      req.body.password = "abcABC012@"; // Dummy password satisfying password regex
      user = await save(req.body);
      user.isNew = true;
      msg = "Registered successfully";
    }

    user.token = await generateJwtToken(user);

    handleResponse({ res, data: user, msg });
  } catch (error) {
    handleError({ res, err: error });
  }
};

/**
 * This function will send email link if user exist.
 */
exports.generateCode = async (req, res) => {
  const email = req.body.email && req.body.email.trim();

  if (!email || !emailRegex.test(email)) return res.status(400).send({ code: 601, msg: "Invalid request" });

  let user;
  try {
    user = await get(email, "email");

    if (user) {
      const code = generateRandonCode();
      const obj = {
        code: code.toLowerCase(),
        codeExpiry: generateCodeExpiry()
      };

      user = await update(user.id, obj);

      await saveNotification({
        notificationType: notificationTypes.GET_VERIFICATION_CODE,
        to: user.email,
        metadata: {
          subject: "Contestee Verification Code",
          ...obj
        },
        deliveryInfo: {
          email: user.email
        }
      });

      return handleResponse({
        res,
        msg: "Verification code sent successfully"
      });
    }
    throw "User account does not exist";
  } catch (err) {
    return handleError({ res, err });
  }
};

exports.forgotPassword = async (req, res) => {
  const { phone, countryCode } = req.body;
  try {
    if (!phone || !countryCode) throw "Invalid Request";
    let user = await get(phone, "phone");
    if (user) {
      if (user.countryCode !== countryCode) throw "user does not exist";
      const otpCode = await Math.floor(100000 + Math.random() * 900000);
      user = await update(user.id, {
        code: otpCode,
        codeExpiry: generateCodeExpiry()
      });

      const phoneNumber = (await user.countryCode) + user.phone;
      await saveNotification({
        notificationType: notificationTypes.USER_REGISTERED,
        to: phoneNumber,
        metadata: {
          subject: `Verification code for verification : ${otpCode}
                  Verification code Expiry: ${user.codeExpiry}`
        }
      });
      const updatedUserData = await getUsersMainProfileData(user.id);
      delete updatedUserData.password;
      delete updatedUserData.token;
      return handleResponse({ res, data: updatedUserData });
    }
    throw "user does not exist";
  } catch (error) {
    return handleError({ res, err: error });
  }
};

exports.changePassword = async ({ body: { userId, code, newPassword } }, res) => {
  try {
    if (!userId || !code || !newPassword) throw "Invalid Request";
    const user = await get(userId);
    const currentDate = new Date();
    if (!user) throw "User not exist";
    const { codeExpiry } = user;
    // if (!(await user.verifyPassword(oldPassword))) throw 'Invalid user credentials';
    if (user.code !== code) throw "Please enter valid verification code";
    if (codeExpiry < currentDate) {
      handleResponse({
        res,
        statusCode: 302,
        msg: "Verification code has been expired please tap on Resend button to get a new one"
      });
      throw "Code Expired";
    }
    const result = await update(userId, {
      password: await user.encryptPassword(newPassword),
      token: "",
      isVerify: true
    });
    const phoneNumber = (await user.countryCode) + user.phone;
    if (result) {
      await saveNotification({
        notificationType: notificationTypes.CHANGE_PASSWORD,
        to: phoneNumber,
        metadata: {
          subject: "Your password changed successfully."
        },
        deliveryModes: {
          sms: phoneNumber
        }
      });
      return handleResponse({ res, msg: "Password successfully updated" });
    }
    throw "Request Failed";
  } catch (err) {
    return handleError({ res, err });
  }
};

exports.update = async ({ user: { _id: userId }, body }, res) => {
  try {
    const data = await update(userId, body);
    handleResponse({ res, data });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getUser = async ({ user: { _id }, params: { userId } }, res) => {
  try {
    const user = await getUsersMainProfileData(userId || _id);
    handleResponse({ res, data: user });
  } catch (err) {
    handleError({ res, err });
  }
};

/** Admin panel get user listing apis */
exports.getUserListing = async ({ query: { userType, skip, limit } }, res) => {
  try {
    const userList = await getUserList(userType, +skip || 0, +limit || 10);
    handleResponse({ res, data: userList });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.changeUserStatusBlock = async ({ params: { userId }, query: { type } }, res) => {
  try {
    await changeUserStatusBlock(userId, type);
    handleResponse({ res, data: "User blocked successfully" });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.deleteUserByAdmin = async ({ params: { userId } }, res) => {
  try {
    await deleteUserByAdmin(userId);
    handleResponse({ res, data: "User deleted successfully" });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.changeUserStatusReport = async ({ params: { userId }, query: { type } }, res) => {
  try {
    const reportUserResult = await changeUserStatusReport(userId, type);
    handleResponse({ res, data: reportUserResult });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.verifyOtp = async ({ query: { otp, userId } }, res) => {
  try {
    const user = await get(userId, "_id");
    if (user === null) throw "User not found";
    if (user.code !== otp) throw "Incorrect Verification code";
    const dt = new Date();
    if (dt > user.codeExpiry) {
      handleResponse({
        res,
        statusCode: 302,
        msg: "Verification code has been expired please tap on Resend button to get a new one"
      });
      // throw 'Verification code has been expired please tap on Resend button to get a new one';
    } else {
      const userUpdated = await update(user.id, { isVerify: true });
      const updatedUserData = await getUsersMainProfileData(user.id);
      handleResponse({
        res,
        msg: "Verification code verified successfully",
        data: updatedUserData
      });
    }
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getSearchList = async ({ query: { searchType, keyword } }, res) => {
  try {
    let searchResult;
    if (searchType === "contest") {
      searchResult = await getSearchContest(keyword);
    }
    if (searchType === "contestant") {
      searchResult = await getSearchContestant(keyword);
    }
    if (searchType === "voters") {
      searchResult = await getSearchVoters(keyword);
    }
    handleResponse({ res, data: searchResult });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.dashboardUserHistory = async ({ query: { filter, start, end } }, res) => {
  try {
    const getDashboardUserhistory = await getHistoryUserData(filter, start, end);
    handleResponse({ res, data: getDashboardUserhistory });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getUserTickets = async ({ user: { _id } }, res) => {
  try {
    const userTicketsResult = await getUserAvalibleTickets(_id);
    handleResponse({ res, data: userTicketsResult });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getCountryWiseUserCount = async (req, res) => {
  try {
    const contryUserCount = await getCountryWiseUserCount();
    handleResponse({ res, data: contryUserCount });
  } catch (err) {
    handleError({ res, err });
  }
};
exports.resendOtp = async ({ query: { phone, countryCode } }, res) => {
  try {
    let user = await get(phone, "phone");
    if (!user || user.countryCode !== countryCode) throw "Invalid user credentials";
    const otpCode = await Math.floor(100000 + Math.random() * 900000);
    user = await update(user.id, {
      code: otpCode,
      codeExpiry: generateCodeExpiry()
    });
    const phoneNumber = (await user.countryCode) + user.phone;
    await saveNotification({
      notificationType: notificationTypes.OTP_SEND,
      to: phoneNumber,
      metadata: {
        subject: `Verification code for verification : ${otpCode}
                  Verification code Expiry: ${user.codeExpiry}`
      }
    });
    handleResponse({ res, data: "Verification code send succussfully" });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getExploreList = async ({ query, user: { userId } }, res) => {
  try {
    const { skip, limit } = query;
    const exploreList = await getExploreList(userId, +skip || 0, +limit || 10);
    handleResponse({ res, data: exploreList });
  } catch (err) {
    handleError({ res, err });
  }
};
exports.getUserEnrolledContests = async ({ user: { _id } }, res) => {
  try {
    const contestList = await getUserEnrolledContests(_id);
    handleResponse({ res, data: contestList });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.logout = async ({ user: { _id } }, res) => {
  try {
    await logout(_id);
    handleResponse({ res, msg: "logout successfully" });
  } catch (err) {
    handleError({ res, err });
  }
};
exports.giveFeedback = async ({ user: { _id }, body }, res) => {
  try {
    const feedbackResult = await giveUserFeedback(_id, body);
    handleResponse({ res, data: feedbackResult });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getUserBookmarkPosts = async ({ user: { _id } }, res) => {
  try {
    const postsList = await getUserBookmarkPosts(_id);
    handleResponse({ res, data: postsList });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getContestProfileDetails = async ({ user: { _id }, params: { contestName } }, res) => {
  try {
    const details = await getContestProfileDetails(_id, contestName);
    handleResponse({ res, data: details });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.adminDashboard = async ({ query: { startDate, endDate } }, res) => {
  try {
    const countryWiseContestantsCount = await getCityWiseContestantsCount(startDate, endDate);
    const userLocation = await getUserLocation(startDate, endDate);
    const resObj = {
      userLocation: userLocation,
      cityWiseUser: countryWiseContestantsCount
    };
    handleResponse({ res, data: resObj });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getAllContestant = async (req, res) => {
  try {
    const allContestant = await getAllContestant();
    handleResponse({ res, data: allContestant });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getContestantCount = async (req, res) => {
  try {
    const contestantCount = await getContestantCount();
    handleResponse({ res, data: contestantCount });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getContesteeByContestName = async ({ query: { contestName } }, res) => {
  try {
    const countryStatistic = await getContesteeByContestName(contestName);
    handleResponse({ res, data: countryStatistic });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.postedVideoList = async ({ query: { mediaStatus } }, res) => {
  try {
    const postedVideoList = await getPostedVideoList(mediaStatus);
    handleResponse({ res, data: postedVideoList });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.changePostedVideoStatus = async ({ body: { userId, contestName, mediaId, mediaStatus } }, res) => {
  try {
    const postedVideoStatus = await changePostedVideoStatus(userId, contestName, mediaId, mediaStatus);
    handleResponse({ res, data: postedVideoStatus });
  } catch (err) {
    handleError(err);
  }
};

exports.featuredMediaListByContestName = async ({ query: { contestName } }, res) => {
  try {
    const featureList = await featuredMediaListByContestName(contestName);
    handleResponse({ res, data: featureList });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.usersAnalytics = async ({ query: { month, year } }, res) => {
  try {
    const usersAnalytics = await getUserAnalytics(month, year);
    const countMale = await getAnalyticsByGender(month, year, "male");
    const countFemale = await getAnalyticsByGender(month, year, "female");
    const analyticsByCountry = await getAnalyticsByArea(month, year, "country");
    const analyticsByCity = await getAnalyticsByArea(month, year, "city");

    const resObj = {
      everyDayUsers: usersAnalytics,
      numberOfMale: countMale,
      numberOfFemale: countFemale,
      numberOfCountry: analyticsByCountry,
      numberOfCity: analyticsByCity
    };

    handleResponse({ res, data: resObj });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getUserEnrolledAsHosts = async ({ user: { _id } }, res) => {
  try {
    const hostList = await getUserEnrolledAsHosts(_id);
    handleResponse({ res, data: hostList });
  } catch (err) {
    handleError({ res, err });
  }
};

exports.getHostProfile = async ({ user: { _id },query: { userId }, params: { contestName } }, res) => {
  try {
    const details = await getHostProfile(userId || _id, contestName);    
    handleResponse({ res, data: details });
  } catch (err) {
    handleError({ res, err });
  }
};