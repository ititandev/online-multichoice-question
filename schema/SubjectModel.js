const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const SubjectSchema = new Schema({
    name: {type: String, required: true },
    datetime: { type: Date, default: Date.now }
});
const SubjectModel = mongoose.model('subjects', SubjectSchema);

module.exports = SubjectModel