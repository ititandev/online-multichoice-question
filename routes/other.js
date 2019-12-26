var express = require("express");
var router = express.Router();
const ConfigModel = require("../schema/ConfigModel");
const { success, error, fail } = require("../common")

const exec = require('child_process').exec;

router.get("/homepage", (req, res) => {
    ConfigModel.findOne({ name: "homepage" }, (err, config) => {
        if (err) return error(res, err)
        if (!config)
            return success(res, " ", "Chưa cài đặt")
        else
            return success(res, config.data)
    })
})

router.put("/homepage", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể cài đặt nội dung trang chủ")

    ConfigModel.findOne({ name: "homepage" }, (err, config) => {
        if (err) return error(res, err)
        if (config) {
            config.data = req.body.homepage
            config.datetime = Date.now()
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

router.get("/backup", async (req, res) => {
    // if (req.authz.role != "admin")
    //     return fail(res, "Chỉ admin có thể backup")


    exec(process.env.MONGODB_BACKUP_CMD, (err, stdout, stderr) => {
            // console.log(stdout);
            // console.log(stderr);
            // if (err !== null) {
            //     console.log(`exec error: ${err}`);
            // }
        });


    // exec(process.env.MONGODB_BACKUP_CMD)
    //     .then(result => {
    //         success(res, result)
    //     })
    //     .catch(err => {
    //         error(res, err)
    //     })


})

router.all("/*", (req, res) => {
    return fail(res, "API không tồn tại, liên hệ nhà phát triển để biết thêm chi tiết.")
})

module.exports = router;
