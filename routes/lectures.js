var express = require("express");
var router = express.Router();
const ContentModel = require("../schema/ContentModel");
const LectureModel = require("../schema/LectureModel");
const { success, error, fail } = require("../common");
const excel = require('node-excel-export');


router.get("/lectures", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể liệt kê tất cả các bài giảng")

    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1
    if (!req.query.sort)
        req.query.sort = "-datetime"

    query = req.query.search ? {
        name: { $regex: req.query.search, $options: "i" }
    } : {}

    LectureModel.find(query)
        .populate({
            path: 'contentId',
            select: 'name subjectId',
            populate: {
                path: 'subjectId',
                select: 'classId name',
                populate: {
                    path: 'classId',
                    select: 'name'
                }
            }
        })
        .sort(req.query.sort)
        .skip((req.query.page - 1) * req.query.limit)
        .limit(parseInt(req.query.limit))
        .exec((err, lectures) => {
            if (err) return error(res, err)
            LectureModel.countDocuments(query, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/lectures?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/lectures?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                lectures = lectures.map(element => {
                    if (!element || !element.contentId || !element.contentId.subjectId || !element.contentId.subjectId.classId)
                        return {}
                    else
                        return {
                            _id: element._id,
                            name: element.name,
                            lectureUrl: element.lectureUrl,
                            contentName: element.contentId.name,
                            subjectName: element.contentId.subjectId.name,
                            className: element.contentId.subjectId.classId.name,
                            datetime: element.datetime,
                            password: element.password ? element.password : null
                        }
                })
                data = { totalPage: totalPage, page: req.query.page, data: lectures, previous: previous, next: next }
                return success(res, data)
            })
        })
})

router.get("/lectures/export", (req, res) => {
    LectureModel.find()
        .select("name contentId lectureUrl password userId")
        .populate({
            path: 'contentId',
            select: 'name subjectId',
            populate: {
                path: 'subjectId',
                select: 'classId name',
                populate: {
                    path: 'classId',
                    select: 'name'
                }
            }
        })
        .exec((err, lectures) => {
            if (err) return error(res, err)

            const specification = {
                className: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Lớp',
                    cellFormat: function (value, element) {
                        if (!element
                            || !element.contentId
                            || !element.contentId.subjectId
                            || !element.contentId.subjectId.classId)
                            return ""
                        return element.contentId.subjectId.classId.name
                    },
                    width: 100
                },
                subjectName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Môn học',
                    cellFormat: function (value, element) {
                        if (!element
                            || !element.contentId
                            || !element.contentId.subjectId)
                            return ""
                        return element.contentId.subjectId.name
                    },
                    width: 200
                },
                contentName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Chương',
                    cellFormat: function (value, element) {
                        if (!element
                            || !element.contentId)
                            return ""
                        return element.contentId.name
                    },
                    width: 200
                },
                name: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Bài giảng',
                    cellFormat: function (value, row) {
                        return row.name
                    },
                    width: 200
                },
                examUrl: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Link bài giảng',
                    cellFormat: function (value, row) {
                        return row.lectureUrl
                    },
                    width: 200
                },
                password: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Mật khẩu',
                    cellFormat: function (value, row) {
                        return row.password
                    },
                    width: 100
                },
                userId: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'userId',
                    cellFormat: function (value, row) {
                        return row.userId
                    },
                    width: 100
                }
            }

            const report = excel.buildExport([{
                specification: specification,
                data: lectures
            }]);

            res.attachment("lectures.xlsx");
            return res.send(report);
        })
})

router.get("/lectures/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể thực hiện")

    LectureModel.findById(req.params.id, (err, lecture) => {
        if (err) return error(res, err)
        return success(res, lecture)
    })
})

router.post("/lectures/:id", (req, res) => {
    if (req.authz.role == "anony")
        return fail(res, "Vui lòng đăng nhập trước khi xem bài giảng")

    LectureModel.findById(req.params.id, (err, lecture) => {
        if (err) return error(res, err)
        if (lecture.password)
            if (req.body.password != lecture.password)
                return fail(res, "Sai mật khẩu")
        return success(res, lecture)
    })
})

router.get("/lectures/contents/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher") {
        return fail(res, "Chỉ admin và giáo viên có thể thực hiện")
    }

    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1

    query = req.query.search ? {
        name: { $regex: req.query.search, $options: "i" },
        contentId: req.params.id
    } : { contentId: req.params.id }

    LectureModel.find(query)
        .populate({
            path: 'contentId',
            select: 'name subjectId',
            populate: {
                path: 'subjectId',
                select: 'classId name',
                populate: {
                    path: 'classId',
                    select: 'name'
                }
            }
        })
        .sort('-datetime')
        .skip((req.query.page - 1) * req.query.limit)
        .limit(parseInt(req.query.limit))
        .exec((err, lectures) => {
            if (err) return error(res, err)
            LectureModel.countDocuments(query, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/lectures/contents/" + req.params.id + "?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/lectures/contents/" + req.params.id + "?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                lectures = lectures.map(element => {
                    if (!element || !element.contentId || !element.contentId.subjectId || !element.contentId.subjectId.classId)
                        return {}
                    else
                        return {
                            _id: element._id,
                            name: element.name,
                            lectureUrl: element.lectureUrl,
                            contentName: element.contentId.name,
                            subjectName: element.contentId.subjectId.name,
                            className: element.contentId.subjectId.classId.name,
                            datetime: element.datetime
                        }
                })
                data = { totalPage: totalPage, page: req.query.page, data: lectures, previous: previous, next: next }
                return success(res, data)
            })
        })
})

router.post("/lectures", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể tạo bài giảng")
    ContentModel.find({ _id: req.body.contentId }, (err, contents) => {
        if (err) return error(res, err)
        if (contents.length < 1)
            return fail(res, "Chủ đề không tồn tài")
        LectureModel.find({ name: req.body.name, contentId: req.body.contentId }, (err, lectures) => {
            if (err) return error(res, err)
            if (lectures.length > 0)
                return fail(res, "bài giảng đã tồn tại")
            req.body.userId = req.authz.uid
            LectureModel.create(req.body, (err, lecture) => {
                if (err) return error(res, err)
                return success(res, lecture)
            })
        })
    })
})

router.put("/lectures/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể chỉnh sửa bài giảng")

    LectureModel.findById(req.params.id, (err, lecture) => {
        if (err) return error(res, err)
        if (!lecture)
            return fail(res, "Bài giảng không tồn tại")
        if (lecture.userId != req.authz.uid && req.authz.role == "teacher")
            return fail(res, "Giáo viên không thể chỉnh sửa bài giảng của người khác")
        LectureModel.updateOne({ _id: req.params.id }, req.body, (err, r) => {
            if (err) return error(res, err)
            return success(res, null, "Chỉnh sửa bài giảng thành công")
        })
    })
})

router.delete("/lectures/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể xóa bài giảng")
    LectureModel.findById(req.params.id, (err, lecture) => {
        if (err) return error(res, err)
        if (!lecture)
            return fail(res, "Bài giảng không tồn tại")
        if (lecture.userId != req.authz.uid && req.authz.role == "teacher")
            return fail(res, "Giáo viên không thể xóa bài giảng của người khác")
        LectureModel.deleteOne({ _id: req.params.id }, err => {
            if (err) return error(res, err)
            return success(res, null, "Xóa bài giảng thành công")
        })
    })
})


module.exports = router;