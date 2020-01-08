const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const LessonSchema = new Schema({
    name: {type: String, required: true },
    datetime: { type: Date, default: Date.now },
    contentId: { type: Schema.Types.ObjectId, ref: 'contents', required: true }
});
const LessonModel = mongoose.model('lessons', LessonSchema);

module.exports = LessonModel