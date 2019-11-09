const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const UserSchema = new Schema({
    email: {type: String, required: true },
    name: {type: String, required: true },
    phone: {type: String, required: true },
    password: {type: String, required: true },
    role: {type: String, required: true, default: "user" },
    datetime: { type: Date, default: Date.now },
    active: {type: Boolean, required: true, default: false},
    remain: {type: Number, required: true}
});
const UserModel = mongoose.model('users', UserSchema);

module.exports = UserModel