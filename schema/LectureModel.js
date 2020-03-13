const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const LectureSchema = new Schema({
    name: { type: String, required: true },
    lectureUrl: { type: String, required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'lessons', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
    datetime: { type: Date, default: Date.now },
    password: {type: String, require: false}
});
const LectureModel = mongoose.model('lectures', LectureSchema);

module.exports = LectureModel