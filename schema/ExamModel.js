const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ExamSchema = new Schema({
    name: { type: String, required: true },
    examUrl: { type: String, require: true },
    answer: { type: String, required: true },
    explainUrl: { type: String, required: true },
    time: { type: Number, required: true },
    total: { type: Number, required: true },
    password: {type: String, default: ""},
    note: { type: String, required: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'contents', required: true },
    datetime: { type: Date, default: Date.now }
});
const ExamModel = mongoose.model('exams', ExamSchema);

module.exports = ExamModel