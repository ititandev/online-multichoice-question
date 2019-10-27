const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ClassSchema = new Schema({
    name: {type: String, required: true },
    datetime: { type: Date, default: Date.now }
});
const ClassModel = mongoose.model('classes', ClassSchema);

module.exports = ClassModel