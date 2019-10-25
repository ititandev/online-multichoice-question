const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const UserSchema = new Schema({
    email: {type: String, required: true },
    name: {type: String, required: true },
    phone: {type: String, required: true },
    password: {type: String, required: true },
    role: {type: String, default: "user" },
    datetime: { type: Date, default: Date.now },
    active: {Type: Boolean, default: false}
});
const UserModel = mongoose.model('users', UserSchema);

module.exports = UserModel