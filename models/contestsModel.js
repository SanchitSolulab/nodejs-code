const mongoose = require("mongoose");
const db = require("../connections/dbMaster");
// const { contestSettings: { categories } } = require('../config/config');

const contestPrize = new mongoose.Schema({
  image: { type: String, required: true },
  position: { type: Number, required: true, default: 1 }
});

const ContestsSchema = new mongoose.Schema({
  judges: [{ type: mongoose.Schema.Types.ObjectId, ref: "users", required: true }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  //   category: { type: String, required: true/* , enum: Object.keys(categories) */ },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  name: { type: String, required: true, unique: true },
  genderEnable: { type: Boolean, default: false },
  defaultPic: { type: String, required: true },
  votes: { type: Number, default: 0, min: 0 },
  weight: { type: Number, default: 0 },
  voters: [mongoose.Schema.Types.ObjectId],
  talents: { type: Number, default: 0, min: 0 },
  currentPrice: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  currentPriceUnit: { type: String, required: true, default: "USD" },
  contestPrizes: [contestPrize],
  flagGlobal: { type: Boolean, required: true, default: false },
  created: { type: Date, default: Date.now },
  locationInfo: {
    country: String,
    city: String
  }
});

module.exports = db.model("Contest", ContestsSchema);
