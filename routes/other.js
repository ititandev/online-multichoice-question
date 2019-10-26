var express = require("express");
var router = express.Router();
const ConfigModel = require("../schema/ConfigModel");
const { success, error, fail } = require("../common")

router.get("/homepage", (req, res) => {
    ConfigModel.findOne({ name: "homepage" }, (err, config) => {
        if (err) return error(res, err)
        if (!config)
            return success(res, " ", "Not configured")
        else
            return success(res, config.data)
    })
})

router.put("/homepage", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can set homepage")

    ConfigModel.findOne({ name: "homepage" }, (err, config) => {
        if (err) return error(res, err)
        if (config) {
            config.data = req.body.homepage
            config.date = undefined
            config.save(err => {
                if (err) return error(res, err)
                return success(res, config.data)
            })
        }
        else {
            ConfigModel.create({ name: "homepage", data: req.body.homepage }, (err, config) => {
                if (err) return error(res, err)
                return success(res, config.data)
            })
        }

    })
})

module.exports = router;
