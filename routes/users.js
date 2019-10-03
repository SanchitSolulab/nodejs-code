const express = require('express');

const router = express.Router();
const { verifySocialLogin } = require('../common/middlewares/socialLogin');
const {
  UserManagement: {
    login,
    register,
    socialLogin,
    generateCode,
    forgotPassword,
    changePassword,
    getUser,
    update,
    verifyOtp,
    getUserListing,
    changeUserStatusBlock,
    deleteUserByAdmin,
    changeUserStatusReport,
    getSearchList,
    dashboardUserHistory,
    getUserTickets,
    getCountryWiseUserCount,
    resendOtp,
    getExploreList,
    getUserEnrolledContests,
    getUserEnrolledAsHosts,
    logout,
    giveFeedback,
    getUserBookmarkPosts,
    getContestProfileDetails,
    getHostProfile
  },
  ContestManagement: {
    enroll,
    enrollHost,
    unEnroll,
    addMedia,
    removeMedia,
    getContestProfile,
    getContestMedia,
    getHostMedia,
    getLikeShareBookMarks,
    likeShareBookmarkMedia,
    removeShareBookmarkMedia,
    getContestForEnroll,
    reportMedia,
    reportMediaRemove,
  },
  FilterManagement: { updateFilters },
  TicketManagement: { purchase, dailyRewardsOnLogin },
  UserMediaManagement: { getFeaturedVideos },
} = require('../controllers/user');

// USER management routes goes here ;

router.post('/login', login);
router.post('/register', register);
router.post('/fbLogin', verifySocialLogin, socialLogin);
router.post('/generate-code', generateCode); // to send verification code to user email
router.post('/forgot-password', forgotPassword);
router.post('/change-password', changePassword);
router.put('/', update);
router.get('/', getUser);
router.get('/verify-otp', verifyOtp);
router.get('/resend-otp', resendOtp);
router.get('/search', getSearchList);
router.get('/explore', getExploreList);
router.put('/logout', logout);
router.post('/give-feedback', giveFeedback);
router.get('/feature-video', getFeaturedVideos);
router.get('/user-profile-data/:userId', getUser);

// contest managemnet routes goes here like enrollment and unenrollment
router.get('/contest/:contestName/:userId?', getContestProfile);
router.get('/contest/:contestName/get-all-media/:userId', getContestMedia);
router.post('/contest/:contestName/enroll', enroll);
router.post('/contest/:contestName/enrollHost', enrollHost);
router.delete('/contest/:contestName/unenroll', unEnroll);
router.post('/contest/:contestName/media', addMedia);
router.delete('/contest/:contestName/media/:mediaId', removeMedia);
router.post('/contest/:contestName/media/:mediaId', likeShareBookmarkMedia);
router.delete('/contest/media-remove-like-bookmark/:mediaId/:interactionType', removeShareBookmarkMedia);
router.get('/contest/:contestName/media/like-share-bookmarks', getLikeShareBookMarks);
router.post('/contest/media/report', reportMedia);
router.delete('/contest/media/report', reportMediaRemove);

router.get('/contestsList-for-enroll', getContestForEnroll);
router.get('/user-enrolled-contests', getUserEnrolledContests);
router.get('/user-enrolled-hosts', getUserEnrolledAsHosts);

// filter management routes goes here
router.put('/filters', updateFilters);

// ticket management routes goes here
router.put('/tickets', purchase);
router.put('/tickets/daily-reward', dailyRewardsOnLogin);
router.put('/change-user-status-report/:userId', changeUserStatusReport);
router.get('/get-user-tickets', getUserTickets);


/** Admin panel back-end apis */
router.get('/dashboard-user-history', dashboardUserHistory);
router.get('/get-user-listing', getUserListing);
router.put('/change-user-status-block/:userId', changeUserStatusBlock);
router.put('/delete-user-by-admin/:userId', deleteUserByAdmin);
router.get('/dashboard-country-wise-users-count', getCountryWiseUserCount);

// profile
router.get('/user-bookmark-post', getUserBookmarkPosts);
router.get('/contest-profile/:contestName', getContestProfileDetails);
router.get('/host-profile/:contestName/:userId?', getHostProfile);
router.get('/host-media/:contestName/get-all-media/:userId', getHostMedia);
module.exports = router;
