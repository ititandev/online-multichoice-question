const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ExamSchema = new Schema({
    name: { type: String, required: true },
    examUrl: { type: String, required: true },
    answer: { type: String, required: true },
    explainUrl: { type: String, required: true },
    time: { type: Number, required: true },
    total: { type: Number, required: true },
    password: { type: String, default: "" },
    note: { type: String, required: false },
    lessonId: { type: Schema.Types.ObjectId, ref: 'lessons', required: true },
    datetime: { type: Date, default: Date.now },
    userId: { type: Schema.Types.ObjectId, ref: 'users', default: Date.now },
    package: {type: String, default: "free"}
});
const ExamModel = mongoose.model('exams', ExamSchema);

module.exports = ExamModel