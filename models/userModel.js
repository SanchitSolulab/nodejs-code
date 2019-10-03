const mongoose = require("mongoose");

mongoose.Promise = Promise;

const bcrypt = require("bcrypt");
// const moment = require('moment');
const db = require("../connections/dbMaster");
const defaultSchema = require("../common/plugins/defaultSchemaAttr");
const {
  ticketSettings: { defaultTickets /* , expiredIn */ },
  userSettings: { roles }
} = require("../config/config");

const MediaSchema = new mongoose.Schema({
  url: String,
  mediaType: { type: String, enum: ["video", "image"], default: "video" },
  description: { type: String, default: '' },
  uploaded: { type: Date, default: Date.now },
  isFeatured: { type: Date, default: null },
  isApproved: { type: Boolean, default: false },
  mediaStatus: {
    type: String,
    enum: ["underReview", "accepted", "rejected"],
    default: "underReview"
  }
});

const EndorsedUserSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  profilePic: String,
  firstName: String,
  lastName: String,
  locationInfo: {
    country: String,
    city: String,
    state: String
  }
});

const EnrolledContestsSchema = new mongoose.Schema(
  {
    contestName: { type: String, required: true },
    contestCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    metadata: {
      profilePic: String,
      firstName: String,
      lastName: String,
      phone: String,
      countryCode: String,
      email: String,
      gender: String,
      medias: [MediaSchema],
      locationInfo: {
        country: String,
        city: String,
        state: String
      }
    },
    aboutSelf: String,
    introductionVideo: [{ type: String, required: false }],
    flagCreatingForSomeoneElse: { type: Boolean, required: true, default: false },
    isMonthlyWinner: { type: Boolean, required: true, default: false },
    winDate: { type: Date },
    enrolledDate: { type: Date, default: Date.now },
    sponsoredTillDate: { type: Date },
    votes: { type: Number, default: 0 },
    weight: { type: Number, default: 0 },
    flagInfoProvidedCorrect: { type: Boolean, required: false, default: false },
    flagAcceptTerms: { type: Boolean, required: false, default: false },
    lastMediaUploadDate:{ type: Date, default: Date.now }
  },
  { _id: false }
);

const EnrolledHostsSchema = new mongoose.Schema(
  {
    contestName: { type: String, required: true },
    contestCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    metadata: {
      profilePic: String,
      firstName: String,
      lastName: String,
      phone: String,
      countryCode: String,
      email: String,      
      medias: [MediaSchema],
      locationInfo: {
        country: String,
        city: String,
        state: String
      }
    },
    aboutSelf: String,
    instagramLink: String,
    status: {
      type: String,
      default: "accepted",
      enum: ["pending", "accepted", "rejected"],
      set(v) {
        return v.toLowerCase().trim();
      }
    },
    endorsedUsers: [EndorsedUserSchema],
    enrolledDate: { type: Date, default: Date.now },    
    lastMediaUploadDate:{ type: Date, default: Date.now }
  },
  { _id: false }
);

const filterSchema = new mongoose.Schema(
  {
    names: [{ type: String, required: true }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true }
  },
  { _id: false }
);

// Define our user schema
const UserSchema = new mongoose.Schema(
  {
    enrolledContests: [EnrolledContestsSchema],
    enrolledHosts: [EnrolledHostsSchema],
    contestFilters: [filterSchema],
    tickets: {
      regular: { type: Number, default: defaultTickets },
      gold: { type: Number, default: 0 },
      platinum: { type: Number, default: 0 }
    },
    lastDateToReceiveDailyReward: { type: Date, default: Date.now },
    firstName: { type: String },
    lastName: { type: String },
    password: {
      type: String,
      required: true,
      minlength: 8,
      //   validate: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})/,
      validate: /^(?=.{8,})/
    },
    // email: {
    //   type: String,
    //   unique: true,
    //   index: true,
    //   validate: [
    //     function emailValidator(email) {
    //       const emailRegex = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
    //       return emailRegex.test(email);
    //     },
    //     'The e-mail is invalid.',
    //   ],
    //   trim: true,
    //   lowercase: true,
    //   required: true,
    //   set(v) {
    //     return `${v}`.toLowerCase();
    //   },
    // },
    email: {
      type: String,
      validate: [
        function emailValidator(email) {
          const emailRegex = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
          return emailRegex.test(email);
        },
        "The e-mail is invalid."
      ],
      trim: true,
      lowercase: true
    },
    gender: {
      type: String,
      default: "male",
      enum: ["male", "female", "others"],
      set(v) {
        return v.toLowerCase().trim();
      }
    },
    profilePic: {
      type: String
    },
    profilePicThumb: {
      type: String,
      default() {
        return this.profilePicThumb || this.profilePic;
      }
    },
    phone: {
      type: String,
      // validate: /^\d{10}$/,
      unique: true,
      index: true
    },
    countryCode: { type: String },
    locationInfo: {
      country: String,
      city: String,
      state: String
    },
    token: { type: String },
    fcmToken: { type: String },
    code: { type: String },
    codeExpiry: { type: Date },
    isBlocked: {
      type: Boolean,
      default: false
    },
    isReported: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      required: true,
      enum: Object.keys(roles),
      default: roles.USER
    },
    referenceCode: { type: String },
    isVerify: { type: Boolean, default: false }
  },
  {
    minimize: false,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
      }
    }
  }
);

UserSchema.pre("save", async function preSave(cb) {
  try {
    // this.tickets.expiryDates = Array(defaultTickets)
    // .fill(true).map((v,i)=>moment().add(expiredIn,'d').toDate())
    this.role = roles.USER;
    this.password = await bcrypt.hash(this.password, 10);
    cb();
  } catch (error) {
    cb(error);
  }
});

UserSchema.methods.encryptPassword = function encryptPassword(password) {
  return bcrypt.hashSync(password, 10);
};

UserSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.password);
};

UserSchema.plugin(defaultSchema);
module.exports = db.model("User", UserSchema);
