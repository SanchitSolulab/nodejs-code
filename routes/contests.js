const express = require("express");

const router = express.Router();
// const isAdmin = require('../common/middlewares/isAdmin');
const {
  getAll,
  save,
  getAllTalentsUserHasVoted,
  getAllTalents,
  groupTalentsByCountry,
  previousWinners,
  getTalentsByVotes,
  getContestDetails,
  getContestContestent,
  getUserContestRank,
  getContestRankList,
  getJudgesCommitteeForContest,
  getVotersActivity,
  getAllContestDailyWinner,
  getAllFilterContest
} = require("../controllers/contest");

// router.post('/', isAdmin, save);
router.get("/:contestName/user-contest-rank", getUserContestRank);
router.get("/:contestName/contest-rank-list", getContestRankList);
router.post("/", save);

router.get("/", getAll);

router.get("/:contestName/details", getContestDetails);
router.get("/:contestName/get-contestents", getContestContestent);

router.get("/:contestName/all-talents-voted-by-user", getAllTalentsUserHasVoted);
router.get("/:contestName/all-talent", getAllTalents);
router.get("/:contestName/group-talents-by-country", groupTalentsByCountry);
router.get("/:contestName/previous-winners", previousWinners);
router.get("/:contestName/talents-with-votes", getTalentsByVotes);

router.get("/:contestName/get-judges-committee", getJudgesCommitteeForContest);

router.get("/:contestName/get-voters-activity", getVotersActivity);

router.get("/all-contest-daily-winner", getAllContestDailyWinner);
router.get("/filter-contest-list", getAllFilterContest);
module.exports = router;
