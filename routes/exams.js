var express = require("express");
var router = express.Router();
const ContentModel = require("../schema/ContentModel");
const ExamModel = require("../schema/ExamModel");
const AnswerModel = require("../schema/AnswerModel");
const { success, error, fail } = require("../common");



router.get("/exams", (req, res) => {
    if (req.authz.role != 'admin')
        return fail(res, "Chỉ admin có thể liệt kê tất cả các bài kiểm tra")
    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1
    ExamModel.find()
        .select("name datetime contentId password")
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
        .exec((err, exams) => {
            if (err) return error(res, err)
            ExamModel.countDocuments({}, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/exams?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/exams?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                exams = exams.map(element => {
                    return {
                        _id: element._id,
                        name: element.name,
                        contentName: element.contentId.name,
                        subjectName: element.contentId.subjectId.name,
                        className: element.contentId.subjectId.classId.name,
                        datetime: element.datetime,
                        password: (element.password) ? true : false
                    }
                })
                data = { totalPage: totalPage, page: req.query.page, data: exams, previous: previous, next: next }
                return success(res, data)
            })
        })
})

router.get("/exams/:id", (req, res) => {
    if (req.authz.role == "admin") {
        ExamModel.findById(req.params.id, (err, exams) => {
            if (err) return error(res, err)
            return success(res, exams)
        })
    }
    else if (req.authz.role == "user") {
        ExamModel.findById(req.params.id, "name time total datetime password", (err, exam) => {
            if (err) return error(res, err);
            if (exam.password)
                exam.password = true
            else
                exam.password = false
            AnswerModel.countDocuments({
                userId: req.authz.uid,
                examId: req.params.id,
                status: "doing"
            }, (err, doing) => {
                if (err) return error(res, err)
                if (doing.length > 0) {
                    exam.status = "doing"
                    return success(res, exam)
                }
                AnswerModel.countDocuments({
                    userId: req.authz.uid,
                    examId: req.params.id,
                    status: "done"
                }, (err, done) => {
                    if (err) return error(res, err)
                    if (done.length > 0) {
                        exam.status = "done"
                        return success(res, exam)
                    }
                    else { 
                        exam.status = null
                        return success(res, exam) 
                    }

                })

            })


        })
    }
    else
        return fail(res, "Vui lòng đăng nhập trước khi thực hiện")
})

router.get("/exams/contents/:id", (req, res) => {
    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1

    ExamModel.find({ contentId: req.params.id })
        .select("name datetime contentId password")
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
        .exec((err, exams) => {
            if (err) return error(res, err)
            ExamModel.countDocuments({ contentId: req.params.id }, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/exams/contents/" + req.params.id + "?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/exams/contents/" + req.params.id + "?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                exams = exams.map(element => {
                    return {
                        _id: element._id,
                        name: element.name,
                        contentName: element.contentId.name,
                        subjectName: element.contentId.subjectId.name,
                        className: element.contentId.subjectId.classId.name,
                        datetime: element.datetime,
                        password: (element.password) ? true : false
                    }
                })
                data = { totalPage: totalPage, page: req.query.page, data: exams, previous: previous, next: next }
                return success(res, data)
            })
        })
})

router.post("/exams", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể tạo bài kiểm tra")
    ContentModel.find({ _id: req.body.contentId }, (err, contents) => {
        if (err) return error(res, err)
        if (contents.length < 1)
            return fail(res, "Chủ đề không tồn tài")
        ExamModel.find({ name: req.body.name, contentId: req.body.contentId }, (err, exams) => {
            if (err) return error(res, err)
            if (exams.length > 0)
                return fail(res, "Bài kiểm tra đã tồn tại")
            req.body.answer = req.body.answer.toUpperCase().replace(/[^ABCD]/g, '')
            req.body.total = req.body.answer.length
            ExamModel.create(req.body, (err, exam) => {
                if (err) return error(res, err)
                return success(res, exam)
            })
        })
    })
})

router.put("/exams/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể chỉnh sửa bài kiểm tra")
    ExamModel.updateOne({ _id: req.params.id }, req.body, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Chỉnh sửa bài kiểm tra thành công")
    })
})

router.delete("/exams/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể xóa bài kiểm tra")
    ExamModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Xóa bài kiểm tra thành công")
    })
})


router.get("/answers", (req, res) => {
    return;
})

router.post("/answers", (req, res) => {
    if (req.authz.role == "anony")
        return fail(res, "Vui lòng đăng nhập trước khi làm bài kiểm tra")
    ExamModel.findById(req.body.examId, "name time examUrl password contentId total datetime", (err, exam) => {
        if (err) return error(res, err)
        if (!exam)
            return fail(res, "Bài kiểm tra không tồn tại")
        if (exam.password) {
            if (!req.body.password)
                return fail(res, "Vui lòng nhập mật khẩu bài kiểm tra")
            if (req.body.password !== exam.password)
                return fail(res, "Sai mật khẩu")
        }
        exam.password = undefined
        AnswerModel.create({
            remain: exam.time,
            answer: "",
            userId: req.authz.uid,
            examId: req.body.examId
        }, (err, a) => {
            if (err) return error(res, err)
            return success(res, exam, "Bắt đầu tính thời gian làm bài")
        })
    })
})

module.exports = router;
