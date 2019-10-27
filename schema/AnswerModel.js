const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AnswerSchema = new Schema({
    start: { type: Date, default: Date.now, required: true },
    end: { type: Date },
    point: { type: Number, default: 0, required: true },
    remain: { type: Number, required: true },
    answer: { type: String, required: true, default: "" },
    userId: { type: String, ref: 'users' },
    examId: { type: Schema.Types.ObjectId, ref: 'exams', required: true }
});
const AnswerModel = mongoose.model('Answers', AnswerSchema);

module.exports = AnswerModel