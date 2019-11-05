const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const LectureSchema = new Schema({
    name: { type: String, required: true },
    lectureUrl: { type: String, require: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'contents', required: true },
    datetime: { type: Date, default: Date.now }
});
const LectureModel = mongoose.model('lectures', LectureSchema);

module.exports = LectureModel