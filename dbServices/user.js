const moment = require("moment");
const { ObjectId } = require("mongoose").Types;
const Model = require("../models/userModel");
const feedbackModel = require("../models/feedbackModel");
const NotificationModel = require("../models/notificationModel");
const ContestModel = require("../models/contestsModel");
const reportMediaModel = require("./../models/reportMediaModel");
const LikeShareBookmarkModel = require("../models/mediaLikeShareBookmarkModel");
const JWPlayer = require("./../services/thirdparty/jwplayer");
const { updateTalents } = require("./contest");
const {
  ticketSettings: { rewards, ticketImages, ticketDescriptions },
  getCurrentDateTime,
  checkLastDayOfMonth
} = require("../config/config");

const { upload } = require("./../services/thirdparty/jwplayer");
const { getRank } = require("./../dbServices/vote");

exports.save = data => new Model(data).save();

exports.get = (idOrEmail, fieldName = "_id") => Model.findOne({ [fieldName]: `${idOrEmail}` });

exports.isUserExists = (idOrEmail, fieldName = "_id") => Model.countDocuments({ [fieldName]: idOrEmail });

exports.update = async (
  userId,
  { firstName, lastName, password, gender, phone, profilePic, code, codeExpiry, contestFilters, token, fcmToken, isVerify, email, locationInfo }
) => {
  try {
    await Model.findByIdAndUpdate(
      userId,
      {
        $set: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(password && { password }),
          ...(phone && { phone }),
          ...(gender && { gender }),
          ...(profilePic && { profilePic }),
          ...(code && { code }),
          ...(email && { email }),
          ...(codeExpiry && { codeExpiry }),
          ...(contestFilters && { contestFilters }),
          ...(typeof token === "string" && { token }),
          ...(typeof fcmToken === "string" && { fcmToken }),
          ...(isVerify && { isVerify }),
          ...(locationInfo && { locationInfo })
        }
      },
      {
        runValidators: true,
        new: true,
        projection: { password: 0 }
      }
    );
    const data = await this.getUsersMainProfileData(userId);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getUsersMainProfileData = async userId => {
  try {
    let useraData = await Model.aggregate([
      {
        $match: {
          _id: ObjectId(userId)
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
        $project: {
          countryData: 0
        }
      },
      {
        $project: {
          enrolledContests: 0
          // code: 0
        }
      },
      {
        $lookup: {
          from: "votes",
          let: {
            userId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$givenBy", "$$userId"]
                }
              }
            }
          ],
          as: "myVotes"
        }
      },
      {
        $addFields: {
          myVotesCount: {
            $size: "$myVotes"
          }
        }
      },
      {
        $project: {
          myVotes: 0
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            userId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$by", "$$userId"]
                },
                interactionType: "B"
              }
            }
          ],
          as: "arrSavedBookmarks"
        }
      },
      {
        $addFields: {
          postBookmarkCount: {
            $size: "$arrSavedBookmarks"
          }
        }
      },
      {
        $project: {
          arrSavedBookmarks: 0
        }
      }
    ]);

    if (useraData.length > 0) {
      useraData = useraData[0];
    }
    return useraData;
  } catch (error) {
    throw error;
  }
};

exports.getContestProfile = async (userId, contestName) => {
  try {
    if (!ObjectId.isValid(userId)) throw "Inavlid user Id found";
    const [profile] = await Model.aggregate([
      {
        $match: {
          _id: ObjectId(userId),
          "enrolledContests.contestName": contestName,
          isDeleted: false,
          isBlocked: false,
          role: "USER"
        }
      },
      {
        $unwind: "$enrolledContests"
      },
      {
        $match: { "enrolledContests.contestName": contestName }
      },
      {
        $lookup: {
          from: "votes",
          let: {
            userId: "$_id"
          },
          pipeline: [
            {
              $match: {
                givenTo: "$$userId",
                created: {
                  $gte: moment(moment().format("YYYY-MM-DD 00:00:00")).toDate(),
                  $lte: moment(moment().format("YYYY-MM-DD 23:59:59")).toDate()
                }
              }
            }
          ],
          as: "enrolledContests.votesByMe"
        }
      },
      {
        $addFields: {
          "enrolledContests.todaysVotes": {
            $size: "$enrolledContests.votesByMe"
          }
        }
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledContests"
        }
      },
      {
        $lookup: {
          from: "countries",
          let: {
            parentCountryCode: "$metadata.locationInfo.country"
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
          "metadata.locationInfo.countryName": "$countryData.name",
          "metadata.locationInfo.countryFlag": "$countryData.flag"
        }
      },
      {
        $project: {
          countryData: 0
        }
      }
    ]);
    let userRank = await getRank(contestName, profile._id);
    profile.rank = userRank.rank;
    return profile;
  } catch (error) {
    throw error;
  }
};

exports.uploadIntroVideos = async arrIntroVideoS3URL => {
  try {
    if (arrIntroVideoS3URL.length > 0) {
      let jwKeys = [];
      for (intI = 0; intI < arrIntroVideoS3URL.length; intI++) {
        const jwPlayerData = await upload({
          title: "Intro Video",
          s3Url: arrIntroVideoS3URL[intI]
        });
        jwKeys.push(jwPlayerData.video.key);
      }
      return jwKeys;
    } else {
      return [];
    }
  } catch (error) {
    throw error;
  }
};

exports.enrollInContest = async (userId, { contestName, ...data }) => {
  try {
    let { introductionVideo } = data;
    if (!introductionVideo) introductionVideo = [];
    const introductionVideoJwPlayer = await this.uploadIntroVideos(introductionVideo);
    data.introductionVideo = introductionVideoJwPlayer;
    const { nModified } = await Model.update(
      {
        _id: userId,
        enrolledContests: {
          $not: {
            $elemMatch: {
              contestName
            }
          }
        }
      },
      {
        $push: {
          enrolledContests: {
            contestName,
            ...data
          }
        }
      },
      {
        runValidators: true
      }
    );
    if (nModified) await updateTalents(contestName);
    return !!nModified;
  } catch (error) {
    throw error;
  }
};

exports.unEnrollInContest = async (userId, contestName) => {
  try {
    const { nModified } = await Model.update(
      {
        _id: userId,
        "enrolledContests.contestName": contestName
      },
      {
        $pull: {
          enrolledContests: {
            contestName
          }
        }
      },
      {
        runValidators: true
      }
    );
    if (nModified) await updateTalents(contestName, -1);
    return !!nModified;
  } catch (error) {
    throw error;
  }
};

exports.addMediaInContest = async (userId, contestName, url, mediaType, description, arrContestName) => {
  try {
    const mediaPublicId = await this.processMedia(url, mediaType, description);
    for (intI = 0; intI < arrContestName.length; intI++) {
      await Model.update(
        { _id: userId, "enrolledContests.contestName": arrContestName[intI] },
        {
          $push: {
            "enrolledContests.$.metadata.medias": {
              url: mediaPublicId,
              mediaType,
              description
            }
          },
          $set: {
            "enrolledContests.$.lastMediaUploadDate": getCurrentDateTime()
          }
        },
        { runValidators: true }
      );
    }
    return true;
  } catch (error) {
    throw error;
  }
};

exports.processMedia = async (url, mediaType, description) => {
  try {
    if (mediaType === "video") {
      const data = await JWPlayer.upload({
        title: `${description}`,
        s3Url: url
      });
      return data.video.key;
    } else {
      return url;
    }
  } catch (error) {
    throw error;
  }
};

exports.removeMediaInContest = async (userId, contestName, mediaId) => {
  try {
    const { nModified } = await Model.update(
      { _id: userId, "enrolledContests.contestName": contestName },
      { $pull: { "enrolledContests.$.metadata.medias": { _id: mediaId } } },
      { runValidators: true }
    );
    return !!nModified;
  } catch (error) {
    throw error;
  }
};

exports.updateVotesInEnrolledContest = async (userId, contestName, weight = 1) => {
  try {
    const { nModified } = await Model.update(
      { _id: userId, "enrolledContests.contestName": contestName },
      {
        $inc: {
          "enrolledContests.$.votes": 1,
          "enrolledContests.$.weight": weight
        }
      },
      { runValidators: true }
    );
    return !!nModified;
  } catch (error) {
    throw error;
  }
};

exports.getAllTalents = async (contestName, { gender, country, fetchNew = false, sponsored = false, ids }, skip = 0, limit = 10) => {
  try {
    const users = await Model.aggregate([
      {
        $match: {
          ...(Array.isArray(ids) && ids.length > 0 && { _id: { $in: ids } }),
          isDeleted: false,
          isBlocked: false,
          role: "USER",
          enrolledContests: {
            $elemMatch: {
              contestName,
              isMonthlyWinner: false,
              ...(country && { "metadata.locationInfo.country": country }),
              ...(gender && { "metadata.gender": gender }),
              ...(fetchNew === "true" && { votes: { $lte: 10 } }),
              ...(sponsored === "true" && {
                sponsoredTillDate: { $gte: new Date() }
              })
            }
          }
        }
      },
      {
        $sort: {
          "enrolledContests.enrolledDate": -1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $addFields: {
          enrolledContest: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$enrolledContests",
                  as: "ec",
                  cond: { $eq: ["$$ec.contestName", contestName] }
                }
              },
              0
            ]
          }
        }
      },
      {
        $project: {
          enrolledContests: 0,
          password: 0
        }
      }
    ]);
    return users;
  } catch (error) {
    throw error;
  }
};

exports.groupTalentsByCountry = async contestName => {
  try {
    const result = await Model.aggregate([
      {
        $match: {
          "enrolledContests.contestName": contestName,
          isDeleted: false,
          isBlocked: false,
          role: "USER"
        }
      },
      {
        $project: {
          country: {
            $let: {
              vars: {
                contest: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$enrolledContests",
                        as: "ec",
                        cond: { $eq: ["$$ec.contestName", contestName] }
                      }
                    },
                    0
                  ]
                }
              },
              in: "$$contest.locationInfo.country"
            }
          }
        }
      },
      {
        $group: {
          _id: "$country",
          count: { $sum: 1 }
        }
      }
    ]);
    return result;
  } catch (error) {
    throw error;
  }
};

exports.dailyRewardsOnLogin = async userId => {
  try {
    const { nModified } = await Model.update(
      {
        _id: userId,
        lastDateToReceiveDailyReward: {
          $lte: moment()
            .subtract(24, "h")
            .toDate()
        },
        isDeleted: false,
        role: "USER",
        isBlocked: false
      },
      {
        $inc: {
          [`tickets.${rewards.ticketType}`]: rewards.count
        },
        $set: {
          lastDateToReceiveDailyReward: moment().toDate()
        }
      },
      {
        runValidators: true
      }
    );
    return !!nModified;
  } catch (error) {
    throw error;
  }
};

exports.getFeaturedVideos = async (userId, skip = 0, limit = 10) => {
  try {
    const data = await Model.aggregate([
      {
        $unwind: {
          path: "$enrolledContests"
        }
      },
      {
        $unwind: "$enrolledContests.metadata.medias"
      },
      {
        $match: {
          "enrolledContests.metadata.medias.mediaType": "video",
          "enrolledContests.metadata.medias.isFeatured": {
            $exists: true,
            $ne: null
          }
        }
      },
      {
        $sort: {
          "enrolledContests.metadata.medias.isFeatured": -1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: "countries",
          let: {
            parentCountryCode: "$enrolledContests.metadata.locationInfo.country"
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
          "enrolledContests.metadata.locationInfo.countryName": "$countryData.name",
          "enrolledContests.metadata.locationInfo.countryFlag": "$countryData.flag"
        }
      },
      {
        $project: {
          countryData: 0
        }
      },
      {
        $lookup: {
          from: "votes",
          let: {
            contestName: "$enrolledContests.contestName",
            givenBy: ObjectId(userId),
            givenTo: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$givenBy", "$$givenBy"] },
                $expr: { $eq: ["$contestName", "$$contestName"] },
                $expr: { $eq: ["$givenTo", "$$givenTo"] }
              }
            }
          ],
          as: "votesByMe"
        }
      },
      {
        $addFields: {
          "enrolledContests.votesByMe": {
            $size: "$votesByMe"
          },
          "enrolledContests.totalVotes": "$enrolledContests.votes",
          "enrolledContests.userId": "$_id"
        }
      },
      {
        $lookup: {
          from: "votes",
          let: {
            userId: "$_id",
            contestName: "$enrolledContests.contestName"
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$givenTo", "$$userId"] },
                $expr: { $eq: ["$contestName", "$$contestName"] },
                created: {
                  $gte: moment(moment().format("YYYY-MM-DD 00:00:00")).toDate(),
                  $lte: moment(moment().format("YYYY-MM-DD 23:59:59")).toDate()
                }
              }
            }
          ],
          as: "enrolledContests.todaysVotes"
        }
      },
      {
        $addFields: {
          "enrolledContests.todaysVotes": {
            $size: "$enrolledContests.todaysVotes"
          }
        }
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledContests"
        }
      }
    ]);
    for (let i = 0; i < data.length; i++) {
      let userRank = await getRank(data[i].FcontestName, data[i]._id);
      data[i].rank = userRank.rank;
    }
    return data;
  } catch (error) {
    throw error;
  }
};
/** admin panel getUserListing apis */
exports.getUserList = async (userType, skip, limit) => {
  try {
    let query = {};
    if (userType === "all") {
      query = {
        isDeleted: false,
        isBlocked: false,
        isReported: false,
        role: "USER"
      };
    } else if (userType === "deleted") {
      query = {
        role: "USER",
        isDeleted: true
      };
    } else if (userType === "blocked") {
      query = {
        role: "USER",
        isBlocked: true
      };
    } else if (userType === "reported") {
      query = {
        role: "USER",
        isReported: true
      };
    }
    const userList = await Model.find(query, { password: 0, token: 0 })
      .skip(skip)
      .limit(limit)
      .sort("asc");
    return userList;
  } catch (error) {
    throw error;
  }
};
exports.changeUserStatusBlock = async (userId, type) => {
  try {
    const query = type === "true" ? { isBlocked: true } : { isBlocked: false };

    const blockedUser = await Model.update({ _id: userId }, { $set: query, token: "" });

    return blockedUser;
  } catch (error) {
    throw error;
  }
};
exports.deleteUserByAdmin = async userId => {
  try {
    const deletedUser = await Model.findByIdAndUpdate({ _id: userId }, { $set: { isDeleted: true, token: "" } });
    await NotificationModel.update({ to: { $eq: deletedUser.email }, isDeleted: false }, { $set: { isDeleted: true } });
    return deletedUser;
  } catch (error) {
    throw error;
  }
};
exports.changeUserStatusReport = async (userId, type) => {
  try {
    const query = type === "true" ? { isReported: true } : { isReported: false };
    const reportUnreportUserList = await Model.findByIdAndUpdate({ _id: userId }, { $set: query }, { new: true });
    delete reportUnreportUserList._doc.password;
    delete reportUnreportUserList._doc.token;
    return reportUnreportUserList;
  } catch (error) {
    throw error;
  }
};

exports.getContestContestent = async (contestName, userId, skip, limit) => {
  try {
    const result = await Model.aggregate([
      {
        $match: {
          "enrolledContests.contestName": contestName
        }
      },
      {
        $unwind: {
          path: "$enrolledContests"
        }
      },
      {
        $match: {
          "enrolledContests.contestName": contestName
        }
      },
      {
        $lookup: {
          from: "votes",
          let: {
            givenBy: ObjectId(userId),
            contestNameParam: "$enrolledContests.contestName",
            givenTo: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$givenBy", "$$givenBy"],
                  $eq: ["$contestName", "$$contestName"],
                  $eq: ["$givenTo", "$$givenTo"]
                }
              }
            }
          ],
          as: "votesByMe"
        }
      },
      {
        $lookup: {
          from: "votes",
          let: {
            userId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$givenTo", "$$userId"]
                },
                created: {
                  $gte: moment(moment().format("YYYY-MM-DD 00:00:00")).toDate(),
                  $lte: moment(moment().format("YYYY-MM-DD 23:59:59")).toDate()
                }
              }
            }
          ],
          as: "todaysVotes"
        }
      },
      {
        $addFields: {
          enrolledContestMedia: "$enrolledContests.metadata.medias",
          enrolledContestMediaCount: {
            $size: "$enrolledContests.metadata.medias"
          },
          totalVotes: "$enrolledContests.votes",
          profilePic: "$enrolledContests.metadata.profilePic",
          firstName: "$enrolledContests.metadata.firstName",
          lastName: "$enrolledContests.metadata.lastName",
          fullName: {
            $concat: ["$enrolledContests.metadata.firstName", "$enrolledContests.metadata.lastName"]
          },
          email: "$enrolledContests.metadata.email",
          todaysVotes: {
            $size: "$todaysVotes"
          },
          myVotesCount: {
            $size: "$votesByMe"
          },
          contestCategory: "$enrolledContests.contestCategory",
          lastMediaUploadDate: "$enrolledContests.lastMediaUploadDate"
        }
      },
      {
        $sort: { lastMediaUploadDate: -1 }
      },
      {
        $addFields: {
          "enrolledContestMedia.flagtoDisplay": {
            $cond: {
              if: { $eq: ["enrolledContestMedia.mediaType", "video"] },
              then: {
                $cond: [
                  {
                    $gt: [
                      {
                        $subtract: [moment().toDate(), "$enrolledContestMedia.uploaded"]
                      },
                      1000 * 60 * 60 * 24 * 7
                    ]
                  },
                  true,
                  false
                ]
              },
              else: "234"
            }
          }
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
        $project: {
          countryData: 0
        }
      },
      {
        $project: {
          _id: 1,
          gender: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          locationInfo: 1,
          enrolledContestMedia: 1,
          enrolledContestMediaCount: 1,
          totalVotes: 1,
          profilePic: 1,
          todaysVotes: 1,
          myVotesCount: 1,
          contestCategory: 1
        }
      },
      {
        $match: {
          enrolledContestMediaCount: { $gt: 0 }
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      }
    ]);

    for (let i = 0; i < result.length; i++) {
      let userRank = await getRank(contestName, result[i]._id);
      result[i].rank = userRank.rank;
    }

    return result;
  } catch (error) {
    throw error;
  }
};

exports.getSearchContest = async keyword => {
  try {
    if (keyword === undefined || keyword.length <= 0) {
      const contestData = await ContestModel.aggregate([
        {
          $project: {
            talents: 1,
            name: 1,
            votes: 1,
            locationInfo: 1,
            defaultPic: 1,
            voters: { $size: { $ifNull: ["$voters", []] } },
            category: 1
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
          $project: {
            countryData: 0
          }
        }
      ]);
      return contestData;
    }
    const re = new RegExp(`^${keyword}`, "i");
    const contestData = await ContestModel.aggregate([
      { $match: { name: { $regex: re } } },
      {
        $project: {
          talents: 1,
          name: 1,
          votes: 1,
          locationInfo: 1,
          defaultPic: 1,
          voters: { $size: "$voters" },
          category: 1
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
        $project: {
          countryData: 0
        }
      }
    ]);
    return contestData;
  } catch (error) {
    throw error;
  }
};

exports.getSearchContestant = async keyword => {
  try {
    if (keyword === undefined || keyword.length <= 0) {
      const contestantData = Model.aggregate([
        {
          $unwind: "$enrolledContests"
        },
        {
          $unwind: "$enrolledContests.metadata"
        },
        {
          $project: {
            "enrolledContests.metadata.firstName": 1,
            "enrolledContests.metadata.lastName": 1,
            "enrolledContests.contestName": 1,
            "enrolledContests.votes": 1,
            "enrolledContests.metadata.locationInfo": 1,
            "enrolledContests.metadata.profilePic": 1
          }
        },
        {
          $lookup: {
            from: "countries",
            let: {
              parentCountryCode: "$enrolledContests.metadata.locationInfo.country"
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
            "enrolledContests.metadata.locationInfo.countryName": "$countryData.name",
            "enrolledContests.metadata.locationInfo.countryFlag": "$countryData.flag"
          }
        },
        {
          $project: {
            countryData: 0
          }
        }
      ]);
      return contestantData;
    }
    const re = new RegExp(`^${keyword}`, "i");
    const contestantData = Model.aggregate([
      {
        $unwind: "$enrolledContests"
      },
      {
        $unwind: "$enrolledContests.metadata"
      },
      {
        $match: {
          $or: [{ "enrolledContests.metadata.firstName": { $regex: re } }, { "enrolledContests.metadata.lastName": { $regex: re } }]
        }
      },

      {
        $project: {
          "enrolledContests.metadata.firstName": 1,
          "enrolledContests.metadata.lastName": 1,
          "enrolledContests.contestName": 1,
          "enrolledContests.votes": 1,
          "enrolledContests.metadata.locationInfo": 1,
          "enrolledContests.metadata.profilePic": 1
        }
      },
      {
        $lookup: {
          from: "countries",
          let: {
            parentCountryCode: "$enrolledContests.metadata.locationInfo.country"
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
          "enrolledContests.metadata.locationInfo.countryName": "$countryData.name",
          "enrolledContests.metadata.locationInfo.countryFlag": "$countryData.flag"
        }
      },
      {
        $project: {
          countryData: 0
        }
      }
    ]);
    return contestantData;
  } catch (error) {
    throw error;
  }
};

exports.getSearchVoters = async keyword => {
  try {
    if (keyword === undefined || keyword.length <= 0) {
      const userData = Model.aggregate([
        {
          $lookup: {
            from: "votes",
            localField: "_id",
            foreignField: "givenBy",
            as: "Votes"
          }
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            locationInfo: 1,
            profilePic: 1,
            Votes: { $size: "$Votes" }
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
          $project: {
            countryData: 0
          }
        }
      ]);

      return userData;
    }
    const re = new RegExp(`^${keyword}`, "i");
    const userData = Model.aggregate([
      { $match: { firstName: { $regex: re } } },
      {
        $lookup: {
          from: "votes",
          localField: "_id",
          foreignField: "givenBy",
          as: "Votes"
        }
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          locationInfo: 1,
          profilePic: 1,
          Votes: { $size: "$Votes" }
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
        $project: {
          countryData: 0
        }
      }
    ]);

    return userData;
  } catch (error) {
    throw error;
  }
};
function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

exports.getHistoryUserData = async (idOrEmail = "today", start, end) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let query = {};
    let groupQuery = {};
    if (idOrEmail === "week") {
      const first = today.getDate() - today.getDay();
      const firstDayWeek = new Date(today.setDate(first));
      const lastDayWeek = new Date(today.setDate(first + 6));
      query = {
        $match: {
          created: { $gte: new Date(firstDayWeek), $lte: new Date(lastDayWeek) }
        }
      };
      groupQuery = {
        $group: {
          _id: { result: { $week: "$created" } },
          count: { $sum: 1 }
        }
      };
    } else if (idOrEmail === "month") {
      const firstDayOfMonth = start === undefined ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(parseInt(start, 10));
      const lastDayOfMonth =
        end === undefined
          ? new Date(today.getFullYear(), today.getMonth(), daysInMonth(today.getMonth() + 1, today.getFullYear()))
          : new Date(parseInt(end, 10));
      query = {
        $match: {
          created: {
            $gte: new Date(firstDayOfMonth),
            $lte: new Date(lastDayOfMonth)
          }
        }
      };
      groupQuery = {
        $group: {
          _id: { result: { $month: "$created" } },
          count: { $sum: 1 }
        }
      };
    } else if (idOrEmail === "year") {
      const firstDayOfYear = start === undefined ? new Date(today.getFullYear(), 0, 2) : new Date(parseInt(start, 10));
      const lastDayOfYear = end === undefined ? new Date(today.getFullYear() + 1, 0, 1) : new Date(parseInt(end, 10));
      query = {
        $match: {
          created: {
            $gte: new Date(firstDayOfYear),
            $lte: new Date(lastDayOfYear)
          }
        }
      };
      groupQuery = {
        $group: {
          _id: { result: { $year: "$created" } },
          count: { $sum: 1 }
        }
      };
    } else {
      query = {
        $match: {
          created: {
            $gte: new Date()
          }
        }
      };
      groupQuery = {
        $group: {
          _id: { result: { $dayOfMonth: "$created" } },
          count: { $sum: 1 }
        }
      };
    }
    const result = await Model.aggregate([
      query,
      groupQuery,
      {
        $project: { [idOrEmail]: "$_id.result", count: 1, _id: 0 }
      }
    ]);
    return result;
  } catch (error) {
    throw error;
  }
};

exports.getUserAvalibleTickets = async userId => {
  try {
    const userTickets = await Model.aggregate([
      {
        $match: {
          _id: userId
        }
      },
      {
        $addFields: {
          ticketsInformation: {
            $objectToArray: "$tickets"
          }
        }
      },
      {
        $project: {
          _id: 0,
          ticketsInformation: 1
        }
      }
    ]);

    userTicketsData = {};
    if (userTickets.length > 0) {
      userTicketsData = userTickets[0].ticketsInformation.map(eachTicketData => {
        var tmpTicket = eachTicketData;
        tmpTicket.image = ticketImages[eachTicketData.k];
        tmpTicket.description = ticketDescriptions[eachTicketData.k];
        return tmpTicket;
      });
    }

    return userTicketsData;
  } catch (error) {
    throw error;
  }
};

exports.getCountryWiseUserCount = async () => {
  try {
    const userCount = await Model.aggregate([
      {
        $group: {
          _id: "$locationInfo.country",
          count: { $sum: 1 }
        }
      },
      {
        $project: { country: "$_id", count: "$count", _id: 0 }
      }
    ]);
    return userCount;
  } catch (error) {
    throw error;
  }
};

exports.getExploreList = async (userId, skip, limit) => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          role: "USER"
        }
      },
      {
        $addFields: {
          enrolledContestCount: {
            $size: { $ifNull: ["$enrolledContests", []] }
          }
        }
      },
      {
        $match: { enrolledContestCount: { $gt: 0 } }
      },
      {
        $unwind: "$enrolledContests"
      },
      {
        $addFields: {
          mediaCount: {
            $size: { $ifNull: ["$enrolledContests.metadata.medias", []] }
          }
        }
      },
      {
        $match: { mediaCount: { $gt: 0 } }
      },
      {
        $sort: {
          "enrolledContests.enrolledDate": -1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: "votes",
          let: {
            contestName: "$enrolledContests.contestName",
            givenBy: ObjectId(userId),
            givenTo: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$givenBy", "$$givenBy"] },
                $expr: { $eq: ["$contestName", "$$contestName"] },
                $expr: { $eq: ["$givenTo", "$$givenTo"] }
              }
            }
          ],
          as: "votesByMe"
        }
      },
      {
        $addFields: {
          "enrolledContests.votesByMe": {
            $size: "$votesByMe"
          },
          "enrolledContests.totalVotes": "$enrolledContests.votes",
          "enrolledContests.userId": "$_id"
        }
      },
      {
        $lookup: {
          from: "votes",
          let: {
            userId: "$_id",
            contestName: "$enrolledContests.contestName"
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$givenTo", "$$userId"] },
                $expr: { $eq: ["$contestName", "$$contestName"] },
                created: {
                  $gte: moment(moment().format("YYYY-MM-DD 00:00:00")).toDate(),
                  $lte: moment(moment().format("YYYY-MM-DD 23:59:59")).toDate()
                }
              }
            }
          ],
          as: "enrolledContests.todaysVotes"
        }
      },
      {
        $addFields: {
          "enrolledContests.todaysVotes": {
            $size: "$enrolledContests.todaysVotes"
          }
        }
      },
      {
        $sort: {
          "enrolledContests.lastMediaUploadDate": -1
        }
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledContests"
        }
      }
    ]);

    for (let i = 0; i < data.length; i++) {
      let userRank = await getRank(data[i].contestName, data[i].userId);
      data[i].rank = userRank.rank;
    }

    return data;
  } catch (error) {
    throw error;
  }
};

exports.getContestForEnroll = async userId => {
  try {
    const userData = Model.aggregate([
      {
        $match: { _id: userId }
      },
      {
        $lookup: {
          from: "contests",
          localField: "name",
          foreignField: "enrolledContests.contestName",
          as: "ContestsList"
        }
      },
      {
        $addFields: {
          enrolledContest: "$enrolledContests.contestName",
          enrolledHost: "$enrolledHosts.contestName",
          allContests: "$ContestsList.name"
        }
      },
      {
        $project: {
          contestList: {
            $setDifference: ["$ContestsList.name", "$enrolledContests.contestName"]
          },
          // contestId: { $setDifference: ["$ContestsList.category", "$enrolledContests.contestCategory"] },
          enrolledHost: 1,
          _id: 0
        }
      },
      {
        $project: {
          contestList: {
            $setDifference: ["$contestList", "$enrolledHost"]
          }
        }
      },
      {
        $unwind: "$contestList"
      },
      {
        $lookup: {
          from: "contests",
          localField: "contestList",
          foreignField: "name",
          as: "unEnrollList"
        }
      },
      {
        $unwind: "$unEnrollList"
      },
      {
        $project: {
          name: "$unEnrollList.name",
          category: "$unEnrollList.category"
        }
      }
    ]);
    return userData;
  } catch (err) {
    throw err;
  }
};

exports.getUserEnrolledContests = async userId => {
  try {
    const userData = await Model.aggregate([
      {
        $match: { _id: userId }
      },
      {
        $unwind: "$enrolledContests"
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledContests"
        }
      },
      {
        $addFields: {
          lastDayOfMonth: checkLastDayOfMonth()
        }
      },
      {
        $project: {
          contestName: 1,
          enrolledDate: 1,
          "metadata.profilePic": 1,
          _id: 0,
          lastDayOfMonth: 1
        }
      }
    ]);
    return userData;
  } catch (err) {
    throw err;
  }
};

exports.reportMedia = async (reportedBy, mediaUserId, mediaId, reasonId) => {
  try {
    const data = new reportMediaModel({
      reportedBy,
      mediaUserId,
      mediaId,
      reasonId
    }).save();
    return data;
  } catch (error) {
    throw error;
  }
};

exports.reportMediaRemove = async mediaId => {
  try {
    const { deletedCount } = await reportMediaModel.deleteMany({
      mediaId
    });
    return deletedCount;
  } catch (error) {
    throw error;
  }
};

exports.logout = async id => {
  try {
    const logout = Model.findByIdAndUpdate({ _id: id }, { $set: { token: "", fcmToken: "" } }, { new: true });
    return logout;
  } catch (err) {
    throw err;
  }
};

exports.giveUserFeedback = async (givenBy, { firstName, lastName, countryCode, phone, email, message }) => {
  try {
    const addFeedback = await feedbackModel({
      givenBy,
      firstName,
      lastName,
      countryCode,
      phone,
      email,
      message
    }).save();
    return addFeedback;
  } catch (err) {
    throw err;
  }
};

exports.getUserBookmarkPosts = async userId => {
  try {
    const data = LikeShareBookmarkModel.aggregate([
      {
        $match: {
          interactionType: "B",
          by: userId
        }
      },
      {
        $sort: { created: -1 }
      },
      {
        $lookup: {
          from: "users",
          localField: "mediaId",
          foreignField: "enrolledContests.metadata.medias._id",
          as: "mediaList"
        }
      },
      {
        $unwind: "$mediaList"
      },
      {
        $unwind: "$mediaList.enrolledContests"
      },
      {
        $unwind: "$mediaList.enrolledContests.metadata.medias"
      },
      {
        $match: {
          $expr: {
            $eq: ["$mediaList.enrolledContests.metadata.medias._id", "$mediaId"]
          }
        }
      },
      {
        $project: {
          _id: "$mediaList.enrolledContests.metadata.medias._id",
          mediaType: "$mediaList.enrolledContests.metadata.medias.mediaType",
          isFeatured: "$mediaList.enrolledContests.metadata.medias.isFeatured",
          url: "$mediaList.enrolledContests.metadata.medias.url",
          uploaded: "$mediaList.enrolledContests.metadata.medias.uploaded",
          firstName: "$mediaList.enrolledContests.metadata.firstName",
          lastName: "$mediaList.enrolledContests.metadata.lastName",
          profilePic: "$mediaList.enrolledContests.metadata.profilePic",
          contestName: "$mediaList.enrolledContests.contestName"
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "L"
              }
            }
          ],
          as: "arrTotalLikes"
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "B"
              }
            }
          ],
          as: "arrTotalBookmarks"
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "S"
              }
            }
          ],
          as: "arrTotalShares"
        }
      },
      {
        $addFields: {
          totalLikes: {
            $size: "$arrTotalLikes"
          },
          totalBookmarks: {
            $size: "$arrTotalBookmarks"
          },
          totalShares: {
            $size: "$arrTotalShares"
          }
        }
      },
      {
        $project: {
          arrTotalLikes: 0,
          arrTotalBookmarks: 0,
          arrTotalShares: 0
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "L",
                by: ObjectId(userId)
              }
            }
          ],
          as: "arrLikedByMe"
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "B",
                by: ObjectId(userId)
              }
            }
          ],
          as: "arrBookmarkedByMe"
        }
      },
      {
        $addFields: {
          flagLikedByMe: {
            $size: "$arrLikedByMe"
          },
          flagBookmarkedByMe: {
            $size: "$arrBookmarkedByMe"
          }
        }
      },
      {
        $project: {
          arrLikedByMe: 0,
          arrBookmarkedByMe: 0
        }
      },
      {
        $addFields: {
          flagLikedByMe: {
            $gt: ["$flagLikedByMe", 0]
          },
          flagBookmarkedByMe: {
            $gt: ["$flagBookmarkedByMe", 0]
          }
        }
      }
    ]);
    return data;
  } catch (err) {
    throw err;
  }
};

exports.getContestProfileDetails = async (userId, contestName) => {
  try {
    const data = Model.aggregate([
      {
        $match: {
          _id: userId
        }
      },
      {
        $unwind: "$enrolledContests"
      },
      {
        $match: {
          "enrolledContests.contestName": contestName
        }
      },
      {
        $lookup: {
          from: "contests",
          localField: "enrolledContests.contestName",
          foreignField: "name",
          as: "contestsData"
        }
      },
      {
        $unwind: "$contestsData"
      },
      {
        $addFields: {
          myVotes: "$enrolledContests.votes",
          totalVotes: "$contestsData.votes"
        }
      },
      {
        $project: {
          totalVotes: 1,
          myVotes: 1,
          enrolledContests: 1
        }
      }
    ]);
    return data;
  } catch (err) {
    throw err;
  }
};

exports.getUserRelatedData = async userId => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          _id: userId
        }
      },
      {
        $lookup: {
          from: "countries",
          localField: "locationInfo.country",
          foreignField: "alpha3Code",
          as: "profileCountryInfo"
        }
      },
      {
        $addFields: {
          countryName: "$profileCountryInfo.name"
        }
      },
      {
        $project: {
          profileCountryInfo: 0,
          password: 0
        }
      },
      {
        $unwind: "$countryName"
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getContestMedia = async (contestName, userId, loggedInUserId, skip, limit) => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          _id: ObjectId(userId),
          "enrolledContests.contestName": contestName,
          isDeleted: false,
          isBlocked: false,
          role: "USER"
        }
      },
      {
        $unwind: "$enrolledContests"
      },
      {
        $match: { "enrolledContests.contestName": contestName }
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledContests.metadata"
        }
      },
      {
        $unwind: "$medias"
      },
      {
        $replaceRoot: {
          newRoot: "$medias"
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $sort: { uploaded: -1 }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "L"
              }
            }
          ],
          as: "arrTotalLikes"
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "B"
              }
            }
          ],
          as: "arrTotalBookmarks"
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "S"
              }
            }
          ],
          as: "arrTotalShares"
        }
      },
      {
        $addFields: {
          totalLikes: {
            $size: "$arrTotalLikes"
          },
          totalBookmarks: {
            $size: "$arrTotalBookmarks"
          },
          totalShares: {
            $size: "$arrTotalShares"
          }
        }
      },
      {
        $project: {
          arrTotalLikes: 0,
          arrTotalBookmarks: 0,
          arrTotalShares: 0
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "L",
                by: ObjectId(loggedInUserId)
              }
            }
          ],
          as: "arrLikedByMe"
        }
      },
      {
        $lookup: {
          from: "likesharebookmarks",
          let: {
            mediaId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$mediaId", "$$mediaId"]
                },
                interactionType: "B",
                by: ObjectId(loggedInUserId)
              }
            }
          ],
          as: "arrBookmarkedByMe"
        }
      },
      {
        $addFields: {
          flagLikedByMe: {
            $size: "$arrLikedByMe"
          },
          flagBookmarkedByMe: {
            $size: "$arrBookmarkedByMe"
          }
        }
      },
      {
        $project: {
          arrLikedByMe: 0,
          arrBookmarkedByMe: 0
        }
      },
      {
        $addFields: {
          flagLikedByMe: {
            $gt: ["$flagLikedByMe", 0]
          },
          flagBookmarkedByMe: {
            $gt: ["$flagBookmarkedByMe", 0]
          }
        }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getCityWiseContestantsCount = async (startDate, endDate) => {
  try {
    let data = await Model.aggregate([
      {
        $match: {
          enrolledContests: { $exists: true, $ne: [] },
          created: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $unwind: "$enrolledContests"
      },
      {
        $group: {
          _id: "$enrolledContests.metadata.locationInfo.city",
          count: { $sum: 1 }
        }
      }
    ]);
    return data;
  } catch (err) {
    throw err;
  }
};

exports.getUserLocation = async (startDate, endDate) => {
  try {
    let data = await Model.aggregate([
      {
        $match: {
          locationInfo: { $gt: {} },
          created: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $replaceRoot: { newRoot: "$locationInfo" }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getAllContestant = async () => {
  try {
    let data = await Model.aggregate([
      {
        $match: {
          enrolledContests: {
            $exists: true,
            $ne: []
          }
        }
      },
      {
        $project: {
          _id: 0,
          locationInfo: 1
        }
      },
      {
        $replaceRoot: { newRoot: "$locationInfo" }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getContestantCount = async () => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          enrolledContests: {
            $exists: true,
            $ne: []
          }
        }
      },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          _id: -1
        }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getPostedVideoList = async mediaStatus => {
  try {
    let data = await Model.aggregate([
      {
        $unwind: {
          path: "$enrolledContests"
        }
      },
      {
        $unwind: "$enrolledContests.metadata.medias"
      },
      {
        $match: {
          "enrolledContests.metadata.medias.mediaType": "video",
          "enrolledContests.metadata.medias.mediaStatus": mediaStatus
        }
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledContests"
        }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.changePostedVideoStatus = async (userId, contestName, mediaId, mediaStatus) => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          _id: ObjectId(userId),
          "enrolledContests.contestName": contestName,
          "enrolledContests.metadata.medias._id": ObjectId(mediaId)
        }
      }
    ]);

    let enrolledContest = data[0].enrolledContests;
    let contestNameArr = enrolledContest.filter(arrDAta => {
      return arrDAta.contestName === contestName;
    });

    let contestId = contestNameArr[0].metadata.medias;
    index = await contestId.findIndex(x => x._id == mediaId);

    const { nModified } = await Model.update(
      { _id: ObjectId(userId), "enrolledContests.contestName": contestName, "enrolledContests.metadata.medias._id": ObjectId(mediaId) },
      {
        $set: {
          ["enrolledContests.$.metadata.medias." + index + ".mediaStatus"]: mediaStatus
        }
      },
      { runValidators: true }
    );
    return nModified;
  } catch (error) {
    throw error;
  }
};

exports.getContesteeByContestName = async contestName => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          "enrolledContests.contestName": contestName
        }
      },
      {
        $unwind: {
          path: "$enrolledContests"
        }
      },
      {
        $match: {
          "enrolledContests.contestName": contestName
        }
      },
      {
        $addFields: {
          location: "$enrolledContests.metadata.locationInfo",
          phone: "$enrolledContests.metadata.phone",
          votes: "$enrolledContests.votes",
          post: {
            $size: "$enrolledContests.metadata.medias"
          }
        }
      },
      {
        $project: {
          _id: 0,
          contestName: contestName,
          phone: 1,
          votes: 1,
          location: 1,
          profilePic: 1,
          lastName: 1,
          firstName: 1,
          created: 1,
          email: 1,
          post: 1
        }
      },
      {
        $sort: { votes: -1 }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.featuredMediaListByContestName = async contestName => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          "enrolledContests.contestName": contestName
        }
      },
      {
        $unwind: {
          path: "$enrolledContests"
        }
      },
      {
        $match: {
          "enrolledContests.contestName": contestName
        }
      },
      {
        $addFields: {
          video: "$enrolledContests.metadata.medias"
        }
      },
      {
        $addFields: {
          "video.contestName": contestName
        }
      },
      {
        $project: {
          _id: 0,
          contestName: 1,
          video: 1
        }
      },
      {
        $unwind: "$video"
      },
      {
        $replaceRoot: { newRoot: "$video" }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getUserAnalytics = async (month, year) => {
  try {
    let data = await Model.aggregate([
      {
        $project: {
          _id: 1,
          month: { $month: "$created" },
          year: { $year: "$created" },
          day: { $dayOfMonth: "$created" }
        }
      },
      {
        $match: {
          month: parseInt(month),
          year: parseInt(year)
        }
      },
      {
        $group: {
          _id: {
            month: "$month",
            year: "$year",
            day: "$day"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          "_id.day": 1
        }
      }
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};

exports.getAnalyticsByGender = async (month, year, gender) => {
  try {
    let data = await Model.aggregate([
      {
        $project: {
          gender: 1,
          month: { $month: "$created" },
          year: { $year: "$created" }
        }
      },
      {
        $match: {
          month: parseInt(month),
          year: parseInt(year),
          gender: gender
        }
      }
    ]);

    return data.length;
  } catch (error) {
    throw error;
  }
};

exports.getAnalyticsByArea = async (month, year, area) => {
  try {
    locationArea = area == "city" ? "$locationInfo.city" : "$locationInfo.country";
    let data = await Model.aggregate([
      {
        $project: {
          locationInfo: 1,
          month: { $month: "$created" },
          year: { $year: "$created" }
        }
      },
      {
        $match: {
          month: parseInt(month),
          year: parseInt(year)
        }
      },
      {
        $group: {
          _id: locationArea,
          count: { $sum: 1 }
        }
      }
    ]);

    return data.length;
  } catch (error) {
    throw error;
  }
};

exports.enrollAsHost = async (userId, { contestName, ...data }) => {
  try {
    const { nModified } = await Model.update(
      {
        _id: userId,
        enrolledHosts: {
          $not: {
            $elemMatch: {
              contestName
            }
          }
        }
      },
      {
        $push: {
          enrolledHosts: {
            contestName,
            ...data
          }
        }
      },
      {
        runValidators: true
      }
    );
    if (nModified) await updateTalents(contestName);
    return !!nModified;
  } catch (error) {
    throw error;
  }
};

exports.getUserEnrolledAsHosts = async userId => {
  try {
    const userData = await Model.aggregate([
      {
        $match: { _id: ObjectId(userId) }
      },
      {
        $unwind: "$enrolledHosts"
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledHosts"
        }
      },
      {
        $addFields: {
          lastDayOfMonth: checkLastDayOfMonth()
        }
      },
      {
        $project: {
          contestName: 1,
          enrolledDate: 1,
          "metadata.profilePic": 1,
          _id: 0,
          lastDayOfMonth: 1
        }
      }
    ]);
    return userData;
  } catch (err) {
    throw err;
  }
};

exports.getHostProfile = async (userId, contestName) => {
  try {
    let data = await Model.aggregate([
      {
        $match: {
          _id: ObjectId(userId)
        }
      },
      {
        $unwind: "$enrolledHosts"
      },
      {
        $match: {
          "enrolledHosts.contestName": contestName
        }
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledHosts"
        }
      },
      {
        $lookup: {
          from: "countries",
          let: {
            parentCountryCode: "$metadata.locationInfo.country"
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
          "metadata.locationInfo.countryName": "$countryData.name",
          "metadata.locationInfo.countryFlag": "$countryData.flag"
        }
      },
      {
        $project: {
          'metadata.medias': 0,
          endorsedUsers: 0,
          countryData: 0
        }
      }
    ]);  

    if (data.length > 0) {
      data = data[0];
    }
    return data;

  } catch (err) {
    throw err;
  }
};

exports.getHostMedia = async (contestName, userId, skip, limit) => {
  try {
    const data = await Model.aggregate([
      {
        $match: {
          _id: ObjectId(userId),
          "enrolledHosts.contestName": contestName,
          status: "accepted"          
        }
      },
      {
        $unwind: "$enrolledHosts"
      },
      {
        $match: { "enrolledHosts.contestName": contestName }
      },
      {
        $replaceRoot: {
          newRoot: "$enrolledHosts.metadata"
        }
      },
      {
        $unwind: "$medias"
      },
      {
        $replaceRoot: {
          newRoot: "$medias"
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $sort: { uploaded: -1 }
      }  
    ]);
    return data;
  } catch (error) {
    throw error;
  }
};