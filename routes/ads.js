var express = require("express");
var router = express.Router();
const AdModel = require("../schema/AdModel");
const { success, error, fail } = require("../common");
var ObjectId = require("mongoose").Types.ObjectId;


router.get("/ad", (req, res) => {

    AdModel.find({ active: true, type: "horizontal" }, (err, horizontal) => {
        if (err) return error(res, err)

        if (horizontal.length > 0) {
            while (horizontal.length < 1) {
                idx = Math.floor(Math.random() * horizontal.length);
                addElement = horizontal[Math.floor(Math.random() * horizontal.length)];
                horizontal.splice(idx, 0, addElement)
            }
            while (horizontal.length > 1) {
                idx = Math.floor(Math.random() * horizontal.length);
                horizontal.splice(idx, 1);
            }
        }

        AdModel.find({ active: true, type: "vertical" }, (err, vertical) => {
            if (err) return error(res, err)
            if (vertical.length > 0) {
                while (vertical.length < 2) {
                    idx = Math.floor(Math.random() * vertical.length);
                    addElement = vertical[Math.floor(Math.random() * vertical.length)];
                    vertical.splice(idx, 0, addElement)
                }
                while (vertical.length > 2) {
                    idx = Math.floor(Math.random() * vertical.length);
                    vertical.splice(idx, 1);
                }
            }

            return success(res, { horizontal, vertical })
        })
    })
})

router.get("/ads", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể thực hiện")
    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1
    if (!req.query.sort)
        req.query.sort = "-datetime"

    query = req.query.search ? { name: { $regex: req.query.search, $options: "i" } } : {}
    if (req.query.active)
        query.active = req.query.active

    AdModel.find(query)
        .select("_id name type linkImage view active datetime")
        .sort(req.query.sort)
        .skip((req.query.page - 1) * req.query.limit)
        .limit(parseInt(req.query.limit))
        .exec((err, ads) => {
            if (err) return error(res, err)
            AdModel.countDocuments(query, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/ads?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/ads?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                data = { totalPage: totalPage, page: req.query.page, data: ads, previous: previous, next: next }
                return success(res, data)
            })
        })
})

router.get("/ads/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể thực hiện")
    AdModel.findById(req.params.id, (err, ad) => {
        if (err) return error(res, err)
        if (!ad)
            return fail(res, "Quảng cáo không tồn tại")
        return success(res, ad)
    })
})

router.post("/ads", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể thực hiện")
    if (!(req.body.name && req.body.type && req.body.linkImage && req.body.linkClick))
        return fail(req, "Thiếu thông tin cần thiết để tạo quảng cáo")

    AdModel.create(req.body, (err, ad) => {
        if (err) return error(res, err)
        return success(res, ad)
    })
})

router.put("/ads/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể thực hiện")
    AdModel.updateOne({ _id: req.params.id }, req.body, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Chỉnh sửa quảng cáo thành công")
    })
})

router.delete("/ads/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể thực hiện")
    AdModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Xóa quảng cáo thành công")
    })
})

module.exports = router