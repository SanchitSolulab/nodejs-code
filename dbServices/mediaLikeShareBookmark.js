const { ObjectId } = require("mongoose").Types;
const Model = require("../models/mediaLikeShareBookmarkModel");

exports.save = async data => {
  try {
    const result = await new Model(data).save();
    return result;
  } catch (error) {
    throw error;
  }
};

exports.getLikeShareBookMarks = async (userId, mediaIds) => {
  try {
    if (!mediaIds || !Array.isArray(mediaIds) || !mediaIds.length || !mediaIds.every(ObjectId.isValid)) {
      throw "Inavild media ids";
    }
    const result = await Model.aggregate([
      {
        $match: {
          mediaId: { $in: mediaIds.map(ObjectId) }
        }
      },
      {
        $addFields: {
          isUserInteracted: { $eq: ["$by", ObjectId(userId)] }
        }
      },
      {
        $sort: {
          isUserInteracted: -1
        }
      },
      {
        $group: {
          _id: { mediaId: "$mediaId", interactionType: "$interactionType" },
          isUserInteracted: { $first: "$isUserInteracted" },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.mediaId",
          likeShareBookmarkCounts: {
            $push: {
              interactionType: "$_id.interactionType",
              count: "$count",
              isUserInteracted: "$isUserInteracted"
            }
          }
        }
      }
    ]);
    return result;
  } catch (error) {
    throw error;
  }
};

exports.removeShareBookmarkMedia = async objData => {
  try {
    const { by, interactionType, mediaId } = objData;
    const data = await Model.findOneAndDelete({
      by: ObjectId(by),
      interactionType,
      mediaId: ObjectId(mediaId)
    });
    return data;
  } catch (error) {
    console.log("error :: ", error);
    throw error;
  }
};
