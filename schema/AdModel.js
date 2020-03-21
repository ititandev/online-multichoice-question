const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AdSchema = new Schema({
    name: {type: String, required: true},
    type: {type: String, required: true},
    linkImage: {type: String, required: true},
    linkClick: {type: String, required: true},
    datetime: { type: Date, default: Date.now, required: true },
    view: {type: Number, default: 0},
    click: {type: Number, default: 0},
    active: {type: Boolean, required: true, default: true},
});
const AdModel = mongoose.model('ads', AdSchema);

module.exports = AdModel