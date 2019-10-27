const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ContentSchema = new Schema({
    name: {type: String, required: true },
    datetime: { type: Date, default: Date.now }
});
const ContentModel = mongoose.model('contents', ContentSchema);

module.exports = ContentModel