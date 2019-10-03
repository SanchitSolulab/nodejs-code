const moment = require("moment");
const Model = require("../models/contestsModel");
const WinnerModel = require("../models/winnerModel");
const UserModel = require("../models/userModel");
const VoteModel = require("../models/voteModel");
const { ObjectId } = require("mongoose").Types;
const { checkLastDayOfMonth } = require("../config/config");

const { getRank } = require("../dbServices/vote");
const { getCheckUserEnrolledContests } = require("./../dbServices/user");
exports.save = data => new Model(data).save();

exports.getFilters = async () => {
  try {
    const result = await Model.aggregate([
      {
        $group: {
          _id: "$category",
          contests: { $push: "$contestName" }
        }
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          contests: 1
        }
      }
    ]);
    return result;
  } catch (error) {
    throw error;
  }
};

exports.getAllContests = async (category, country, filters) => {
  try {
    let query = {
      ...(category && { category: ObjectId(category) }),
      ...(country && { "locationInfo.country": country })
    };
    if (filters && filters.length) {
      query = { $or: filters.map(({ names, category: cat }) => ({ category: cat, name: { $in: names } })) };
    }

    const result = await Model.aggregate([
      {
        $match: query
      },
      {
        $sort: {
          created: -1
        }
      },
      {
        $lookup: {
          from: "categories",
          as: "categoryName",
          localField: "category",
          foreignField: "_id"
        }
      },
      {
        $unwind: "$categoryName"
      },
      {
        $addFields: {
          voters: { $size: { $ifNull: ["$voters", []] } }
        }
      },
      {
        $group: {
          _id: "$categoryName.name",
          contests: { $push: "$$ROOT" }
        }
      },
      {
        $project: {
          "contests.categoryName": 0
        }
      }
    ]);

    return result;
  } catch (error) {
    throw error;
  }
};

exports.updateVotesAndVoters = async (voterId, name, weight = 1) => {
  try {
    const { nModified } = await Model.update({ name }, { $inc: { votes: 1, weight }, $addToSet: { voters: voterId } }, { runValidators: true });
    return !!nModified;
  } catch (error) {
    throw error;
  }
};

exports.updateTalents = async (name, count = 1) => {
  try {
    const { nModified } = await Model.update({ name }, { $inc: { talents: count } }, { runValidators: true });
    return !!nModified;
  } catch (error) {
    throw error;
  }
};

exports.previousWinners = async (contestName, winnerType, gender, skip = 0, limit = 10) => {
  try {
    const query = {
      ...(contestName && { contestName }),
      ...(winnerType && { winnerType }),
      // ...(gender && gender !== 'all' && { 'User.gender': gender }),
      "userInfo.isDeleted": false,
      "userInfo.isBlocked": false
    };
    let dateQuery = {};
    if (winnerType === "monthly") {
      dateQuery = {
        $group: {
          _id: { month: { $month: "$created" }, year: { $year: "$created" } },
          winnersInfo: { $addToSet: "$$ROOT" }
        }
      };
    } else if (winnerType === "yearly") {
      dateQuery = {
        $group: {
          _id: { year: { $year: "$created" } },
          winnersInfo: { $addToSet: "$$ROOT" }
        }
      };
    } else if (winnerType === "daily") {
      dateQuery = {
        $group: {
          _id: { day: { $dayOfMonth: "$created" }, month: { $month: "$created" }, year: { $year: "$created" } },
          winnersInfo: { $addToSet: "$$ROOT" }
        }
      };
    }
    const winnerList = await WinnerModel.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      {
        $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true }
      },
      {
        $match: query
      },
      dateQuery,

      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $unwind: { path: "$winnersInfo", preserveNullAndEmptyArrays: true }
      },
      {
        $sort: {
          "winnersInfo.created": -1
        }
      },
      {
        $project: {
          data: {
            firstName: "$winnersInfo.userInfo.firstName",
            lastName: "$winnersInfo.userInfo.lastName",
            profilePic: { $ifNull: ["$winnersInfo.userInfo.profilePic", ""] },
            location: { $ifNull: ["$winnersInfo.userInfo.locationInfo", ""] },
            votes: { $ifNull: ["$winnersInfo.votes", ""] }
          }
        }
      }
    ]);
    return winnerList;
  } catch (error) {
    throw error;
  }
};

exports.getContestDetails = async (contestName, userId) => {
  try {
    let data = await Model.aggregate([
      {
        $match: {
          name: contestName
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "Category"
        }
      },
      {
        $unwind: "$Category"
      },
      {
        $addFields: {
          votersCount: {
            $size: { $ifNull: ["$voters", []] }
          },
          judgesCount: {
            $size: { $ifNull: ["$judges", []] }
          },
          currentMonthContest: moment().format("MMM, Y")
        }
      },
      {
        $lookup: {
          from: "countries",
          let: {
            parentCountryCode: "$locationInfo.country"
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$alpha3Code", "$$parentCountryCode"] }
              }
            },
            {
              $project: {
                _id: "$_id",
                name: 1,
                flag: 1,
                alpha3Code: 1
              }
            }
          ],
          as: "countryData"
        }
      },
      {
        $unwind: "$countryData"
      },
      {
        $addFields: {
          "locationInfo.countryName": "$countryData.name",
          "locationInfo.countryFlag": "$countryData.flag"
        }
      },
      {
        $addFields: {
          lastDayOfMonth: checkLastDayOfMonth()
        }
      },
      {
        $project: {
          countryData: 0
        }
      }
    ]);
    if (data.length > 0) {
      data = data[0];

      let userEnrolled = await UserModel.aggregate([
        {
          $match: {
            _id: ObjectId(userId),
            enrolledContests: {
              $elemMatch: {
                contestName
              }
            }
          }
        }
      ]);

      let userVotingTicket = await UserModel.aggregate([
        {
          $match: {
            _id: ObjectId(userId)
          }
        }
      ]);

      if (userVotingTicket) {
        userVotingTicket = userVotingTicket[0];
      }
      let ticketsCounts = 0;
      if (userVotingTicket.tickets) {
        let usersTickets = userVotingTicket.tickets;
        Object.keys(usersTickets).forEach(function(key) {
          ticketsCounts = ticketsCounts + +usersTickets[key];
        });
      }
      data.flagUserEnrolled = userEnrolled.length > 0 ? true : false;
      data.ticketsCounts = ticketsCounts;
    }

    return data;
  } catch (error) {
    throw error;
  }
};

exports.getJudgesCommitteeForContest = async (contestName, skip, limit) => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          name: contestName
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $unwind: "$judges"
      },
      {
        $lookup: {
          from: "users",
          localField: "judges",
          foreignField: "_id",
          as: "judgesInfo"
        }
      },
      {
        $project: {
          _id: 0,
          judgesInfo: 1
        }
      },
      {
        $unwind: "$judgesInfo"
      },
      {
        $replaceRoot: {
          newRoot: "$judgesInfo"
        }
      },
      {
        $project: {
          enrolledContests: 0,
          tickets: 0,
          password: 0,
          token: 0,
          isBlocked: 0,
          isReported: 0
        }
      }
    ]);
    return data;
  } catch (err) {
    throw err;
  }
};
exports.getUserContestRank = async (contestName, givenTo) => {
  const data = await getRank(contestName, givenTo);
  return data;
};

exports.getContestRankList = async (contestName, skip, limit) => {
  const data = await VoteModel.aggregate([
    {
      $match: {
        contestName
      }
    },
    {
      $group: {
        _id: "$givenTo"
        //  info:{$addToSet:'$$ROOT'}
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "User"
      }
    },
    {
      $unwind: "$User"
    },
    {
      $unwind: "$User.enrolledContests"
    },
    {
      $match: { "User.enrolledContests.contestName": contestName }
    },
    {
      $skip: skip
    },
    {
      $limit: limit
    },
    {
      $project: {
        _id: 1,
        "User.enrolledContests.metadata.profilePic": 1,
        "User.enrolledContests.metadata.firstName": 1,
        "User.enrolledContests.metadata.lastName": 1,
        "User.enrolledContests.votes": 1,
        "User.gender": 1
      }
    }
  ]);

  for (let i = 0; i < data.length; i++) {
    data[i].rank = await getRank(contestName, data[i]._id);
  }

  return data;
};

exports.getAllContestDailyWinner = async (skip, limit, gender) => {
  try {
    const pastStartDate = moment()
      .subtract(1, "day")
      .format("YYYY-MM-DD");

    let genderFilter = {
      $match: {
        gender: {
          $in: ["male", "female"]
        }
      }
    };
    if (gender !== "") {
      genderFilter = {
        $match: {
          gender: `${gender}`
        }
      };
    }

    const winnerList = await WinnerModel.aggregate([
      {
        $addFields: {
          createdForamted: {
            $dateToString: {
              date: "$created",
              format: "%Y-%m-%d",
              timezone: "+00:00",
              onNull: null
            }
          }
        }
      },
      {
        $match: {
          createdForamted: pastStartDate
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      {
        $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true }
      },
      {
        $match: {
          "userInfo.isDeleted": false,
          "userInfo.isBlocked": false,
          winnerType: "daily"
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $sort: {
          created: -1
        }
      },
      {
        $project: {
          firstName: "$userInfo.firstName",
          lastName: "$userInfo.lastName",
          profilePic: { $ifNull: ["$userInfo.profilePic", ""] },
          location: { $ifNull: ["$userInfo.locationInfo", ""] },
          votes: { $ifNull: ["$votes", ""] },
          contestName: "$contestName",
          createdForamted: 1,
          gender: "$userInfo.gender"
        }
      },
      genderFilter,
      {
        $lookup: {
          from: "countries",
          let: {
            parentCountryCode: "$location.country"
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$alpha3Code", "$$parentCountryCode"] }
              }
            },
            {
              $project: {
                _id: "$_id",
                name: 1,
                flag: 1,
                alpha3Code: 1
              }
            }
          ],
          as: "countryData"
        }
      },
      {
        $unwind: "$countryData"
      },
      {
        $addFields: {
          "location.countryName": "$countryData.name",
          "location.countryFlag": "$countryData.flag"
        }
      },
      {
        $project: {
          countryData: 0
        }
      }
    ]);
    return winnerList;
  } catch (error) {
    throw error;
  }
};

exports.getGlobalStatistic = async () => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          flagGlobal: true
        }
      },
      {
        $lookup: {
          from: "users",
          let: {
            contestName: "$name"
          },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$$contestName", "$enrolledContests.contestName"] }
              }
            },
            {
              $count: "totalCount"
            }
          ],
          as: "users"
        }
      },
      {
        $unwind: "$users"
      },
      {
        $addFields: {
          userCounts: "$users.totalCount"
        }
      },
      {
        $unwind: "$userCounts"
      },
      {
        $project: {
          _id: 0,
          name: 1,
          userCounts: 1
        }
      },
      {
        $sort: { userCounts: -1 }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getCountryStatistics = async countryName => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          "locationInfo.country": countryName
        }
      },
      {
        $lookup: {
          from: "users",
          let: {
            countryName: "$locationInfo.country",
            contestName: "$name"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $in: ["$$contestName", "$enrolledContests.contestName"]
                    },
                    {
                      $in: ["$$countryName", "$enrolledContests.metadata.locationInfo.country"]
                    }
                  ]
                }
              }
            },
            {
              $count: "totalCount"
            }
          ],
          as: "users"
        }
      },
      {
        $unwind: "$users"
      },
      {
        $addFields: {
          userCounts: "$users.totalCount"
        }
      },
      {
        $unwind: "$userCounts"
      },
      {
        $project: {
          _id: 0,
          name: 1,
          userCounts: 1
        }
      },
      {
        $sort: { userCounts: -1 }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getGlobalContestFilter = async () => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          flagGlobal: true
        }
      },
      {
        $project: {
          _id: 0,
          name: 1
        }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getCountryContestFilter = async () => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          flagGlobal: false
        }
      },
      {
        $group: {
          _id: {
            country: "$locationInfo.country",
            contestName: "$name"
          }
        }
      },
      {
        $group: {
          _id: "$_id.country",
          contest: {
            $push: {
              name: "$_id.contestName"
            }
          }
        }
      },
      {
        $lookup: {
          from: "countries",
          as: "countryName",
          localField: "_id",
          foreignField: "alpha3Code"
        }
      },
      {
        $project: {
          _id: 1,
          "countryName.name": 1,
          contest: 1
        }
      },
      {
        $unwind: "$countryName"
      },
      {
        $addFields: {
          countryName: "$countryName.name"
        }
      },
      {
        $project: {
          _id: 1,
          countryName: 1,
          contest: 1
        }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};
