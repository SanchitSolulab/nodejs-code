
const mongoose = require('mongoose');
const db = require('../connections/dbMaster');
const defaultSchema = require('../common/plugins/defaultSchemaAttr');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});

CategorySchema.plugin(defaultSchema);
module.exports = db.model('Category', CategorySchema);
