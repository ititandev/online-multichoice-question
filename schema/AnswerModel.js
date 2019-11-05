const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AnswerSchema = new Schema({
    start: { type: Date, default: Date.now, required: true },
    end: { type: Date },
    point: { type: Number, default: 0, required: true },
    remain: { type: Number, required: true },
    answer: { type: String },
    status: { type: String, required: true },
    userId: { type: String, ref: 'users', required: true },
    examId: { type: Schema.Types.ObjectId, ref: 'exams', required: true }
});
const AnswerModel = mongoose.model('answers', AnswerSchema);

module.exports = AnswerModel