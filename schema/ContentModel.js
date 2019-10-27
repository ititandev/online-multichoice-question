const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ContentSchema = new Schema({
    name: {type: String, required: true },
    datetime: { type: Date, default: Date.now },
    subjectId: { type: Schema.Types.ObjectId, ref: 'subjects' }
});
const ContentModel = mongoose.model('contents', ContentSchema);

module.exports = ContentModel