const mongoose = require('mongoose');
const db = require('../connections/dbMaster');

const citySchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const stateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cities: [citySchema],
});

const CountrySchema = new mongoose.Schema({
  flag: { type: String, required: true },
  name: { type: String, required: true },
  alpha2Code: { type: String, required: true },
  alpha3Code: { type: String, required: true },
  callingCodes: [String],
  latlng: [Number],
  timezones: [String],
  states: [stateSchema],
});

module.exports = db.model('Country', CountrySchema);
