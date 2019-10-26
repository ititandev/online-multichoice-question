const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ConfigSchema = new Schema({
    name: {type: String, require: true},
    data: { type: String, require: true, default: "" },
    datetime: { type: Date, default: Date.now }
});
const ConfigModel = mongoose.model('configs', ConfigSchema);

module.exports = ConfigModel