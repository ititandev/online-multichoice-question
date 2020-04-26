var express = require("express");
var router = express.Router();
const ExamModel = require("../schema/ExamModel");
const LectureModel = require("../schema/LectureModel")
const AnswerModel = require("../schema/AnswerModel");
const UserModel = require("../schema/UserModel");

const ContentModel = require("../schema/ContentModel");
const LessonModel = require("../schema/LessonModel");

const { success, error, fail } = require("../common");
var ObjectId = require('mongoose').Types.ObjectId;
const excel = require('node-excel-export');


router.get("/exams", (req, res) => {
    if (req.query.status == "done") {
        if (req.authz.role == "anony")
            return fail(res, "Vui lòng đăng nhập trước khi thực hiện")
        AnswerModel.find({
                userId: req.authz.uid,
                status: "done"
            })
            .select("_id point start")
            .populate({
                path: "examId",
                select: "name lessonId",
                populate: {
                    path: 'lessonId',
                    select: 'name contentId',
                    populate: {
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
                    }
                }
            })
            .exec((err, answers) => {
                if (err) return error(res, err)

                o = {}
                for (let answer of answers) {
                    if (!answer.examId)
                        continue
                    if (!o[answer.examId._id])
                        o[answer.examId._id] = answer
                    else {
                        if (o[answer.examId._id].point < answer.point)
                            o[answer.examId._id] = answer
                    }
                }
                data = Object.values(o).sort((a, b) => {
                    return new Date(b.start) - new Date(a.start);
                })

                data.forEach(element => {
                    if (!element || !element.examId || !element.examId.lessonId || !element.examId.lessonId.contentId || !element.examId.lessonId.contentId.subjectId || !element.examId.lessonId.contentId.subjectId.classId) {
                        element._doc.examId = " "
                        element._doc.examName = " "
                        element._doc.lessonName = " "
                        element._doc.contentName = " "
                        element._doc.subjectName = " "
                        element._doc.className = " "
                        element.examId = " "
                    }
                    element._doc.examId = element.examId
                    element._doc.examName = element.examId ? element.examId.name : ""
                    element._doc.lessonName = element.examId.lessonId ? element.examId.lessonId.name : ""
                    element._doc.contentName = element.examId.lessonId.contentId ? element.examId.lessonId.contentId.name : ""
                    element._doc.subjectName = element.examId.lessonId.contentId.subjectId ? element.examId.lessonId.contentId.subjectId.name : ""
                    element._doc.className = element.examId.lessonId.contentId.subjectId.classId ? element.examId.lessonId.contentId.subjectId.classId.name : ""
                    element.examId = element.examId._id
                })
                return success(res, data)
            })
    } else if (req.query.status == "doing") {
        // if (req.authz.role != "admin")
        // return fail(res, "Chỉ admin có thể thống kê")
        AnswerModel.find({
            status: "doing"
        }, (err, answers) => {
            if (err) return error(res, err)

            let answerPromises = answers.map(answer => {
                return new Promise((resolve, reject) => {
                    ExamModel.findById(answer.examId, "time total datetime answer", (err, exam) => {
                        if (err) reject(err)
                        if (!exam)
                            reject("Bài kiểm tra không tồn tài")
                        exam.time = exam.time / 60

                        pass = Math.round((Date.now() - answer.start) / 1000)
                        if (pass >= exam.time * 60) {
                            answer.end = Date.now()
                            answer.remain = 0
                            answer.answer = answer.answer.toUpperCase()
                            answer.correct = 0
                            answer.status = "done"


                            length = Math.min(answer.answer.length, exam.answer.length)
                            for (let i = 0; i < length; i++) {
                                answer.correct += (answer.answer[i] === exam.answer[i])
                            }
                            answer.point = Math.round((answer.correct / exam.total * 10) * 100) / 100
                            AnswerModel.updateOne({ _id: answer.id }, answer, (err, a) => {
                                if (err) reject(err)
                                UserModel.findById(answer.userId, (err, user) => {
                                    if (err) reject(err)
                                    if (user.role != "admin") {
                                        if (user.remain - exam.time <= 0) {
                                            user.active = false
                                            user.remain = 0
                                        } else {
                                            user.active = true
                                            user.remain = user.remain - exam.time
                                        }
                                        UserModel.updateOne({ _id: answer.userId }, user, err => {
                                            if (err) reject(err)
                                            resolve()
                                        })
                                    }
                                    resolve()
                                })
                            })
                        }
                        resolve()
                    })
                })
            })

            Promise.all(answerPromises)
                .then(() => {
                    AnswerModel.countDocuments({ status: "doing" }, (err, count) => {
                        if (err) return error(res, err)
                        return success(res, { doingCount: count })
                    })
                })
                .catch((err) => {
                    return error(res, err)
                })

        })



    } else {
        if (!["admin", "dean", "teacher"].includes(req.authz.role))
            return fail(res, "Không đủ quyền liệt kê tất cả các bài kiểm tra")
        if (!req.query.limit)
            req.query.limit = 10
        if (!req.query.page)
            req.query.page = 1
        if (!req.query.sort)
            req.query.sort = "-datetime"

        query = req.query.search ? {
            name: { $regex: req.query.search, $options: "i" }
        } : {}

        ExamModel.find(query)
            .select("name datetime lessonId password userId plan")
            .populate({
                path: 'lessonId',
                select: 'name contentId',
                populate: {
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
                }
            })
            .populate({
                path: 'userId',
                select: 'name email'
            })
            .sort(req.query.sort)
            .skip((req.query.page - 1) * req.query.limit)
            .limit(parseInt(req.query.limit))
            .exec((err, exams) => {
                if (err) return error(res, err)
                ExamModel.countDocuments(query, (err, totalPage) => {
                    if (err) return error(res, err)
                    totalPage = Math.ceil(totalPage / req.query.limit)
                    previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/exams?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                    next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/exams?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                    exams = exams.map(element => {
                        if (!element || !element.lessonId || !element.lessonId.contentId || !element.lessonId.contentId.subjectId || !element.lessonId.contentId.subjectId.classId)
                            return { _id: element._id }
                        else
                            return {
                                _id: element._id,
                                name: element.name,
                                lessonName: element.lessonId.name,
                                contentName: element.lessonId.contentId.name,
                                subjectName: element.lessonId.contentId.subjectId.name,
                                className: element.lessonId.contentId.subjectId.classId.name,
                                datetime: element.datetime,
                                password: (element.password) ? true : false,
                                userName: element.userId.name,
                                userEmail: element.userId.email,
                                plan: element.plan
                            }
                    })
                    data = { totalPage: totalPage, page: req.query.page, data: exams, previous: previous, next: next }
                    return success(res, data)
                })
            })
    }

})


router.get("/exams/export", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Không đủ quyền xuất báo cáo bài làm")

    ExamModel.find()
        .select("name lessonId examUrl answer explainUrl time password note userId datetime")
        .populate({
            path: 'lessonId',
            select: "name contentId",
            populate: {
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
            }
        })
        .populate({
            path: "userId",
            select: "email name"
        })
        .exec((err, exams) => {
            if (err) return error(res, err)

            const specification = {
                className: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Lớp',
                    cellFormat: function(value, element) {
                        if (!element ||
                            !element.lessonId ||
                            !element.lessonId.contentId ||
                            !element.lessonId.contentId.subjectId ||
                            !element.lessonId.contentId.subjectId.classId)
                            return ""
                        return element.lessonId.contentId.subjectId.classId.name
                    },
                    width: 100
                },
                subjectName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Môn học',
                    cellFormat: function(value, element) {
                        if (!element ||
                            !element.lessonId ||
                            !element.lessonId.contentId ||
                            !element.lessonId.contentId.subjectId)
                            return ""
                        return element.lessonId.contentId.subjectId.name
                    },
                    width: 100
                },
                contentName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Chương',
                    cellFormat: function(value, element) {
                        if (!element ||
                            !element.lessonId ||
                            !element.lessonId.contentId)
                            return ""
                        return element.lessonId.contentId.name
                    },
                    width: 300
                },
                lessonName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Bài',
                    cellFormat: function(value, element) {
                        if (!element ||
                            !element.lessonId)
                            return ""
                        return element.lessonId.name
                    },
                    width: 100
                },
                name: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Đề',
                    cellFormat: function(value, row) {
                        return row.name
                    },
                    width: 200
                },
                examUrl: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Link Đề',
                    cellFormat: function(value, row) {
                        return row.examUrl
                    },
                    width: 200
                },
                answer: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Đáp án',
                    cellFormat: function(value, row) {
                        return row.answer
                    },
                    width: 200
                },
                explainUrl: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Link giải thích',
                    cellFormat: function(value, row) {
                        return row.explainUrl
                    },
                    width: 200
                },
                time: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Thời gian (phút)',
                    cellFormat: function(value, row) {
                        return row.time / 60
                    },
                    width: 120
                },
                password: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Mật khẩu',
                    cellFormat: function(value, row) {
                        return row.password
                    },
                    width: 100
                },
                userEmail: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Email người tạo',
                    cellFormat: function(value, row) {
                        return row.userId ? row.userId.email : ""
                    },
                    width: 200
                },
                userName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Tên người tạo',
                    cellFormat: function(value, row) {
                        return row.userId ? row.userId.name : ""
                    },
                    width: 200
                },
                note: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Ghi chú',
                    cellFormat: function(value, row) {
                        return row.note
                    },
                    width: 400
                },
            }

            const report = excel.buildExport([{
                specification: specification,
                data: exams
            }]);

            res.attachment("exams.xlsx");
            return res.send(report);
        })
})

router.get("/exams/users/:id/export", (req, res) => {
    if (!["admin", "dean", "teacher", "parent"].includes(req.authz.role))
        return fail(res, "Không đủ quyền xuất báo cáo bài làm")

    AnswerModel.find({
            userId: req.params.id,
            status: "done"
        })
        .select("_id point start")
        .populate({
            path: "examId",
            select: "name lessonId",
            populate: {
                path: 'lessonId',
                select: 'name contentId',
                populate: {
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
                }
            }
        })
        .sort("-start")
        .exec((err, answers) => {
            if (err) return error(res, err)

            if (!answers || answers.length == 0)
                return fail(res, "Tài khoản chưa làm đề thi nào")

            const specification = {
                className: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Lớp',
                    cellFormat: function(value, element) {
                        if (!element ||
                            !element.examId ||
                            !element.examId.lessonId ||
                            !element.examId.lessonId.contentId ||
                            !element.examId.lessonId.contentId.subjectId ||
                            !element.examId.lessonId.contentId.subjectId.classId)
                            return ""
                        return element.examId.lessonId.contentId.subjectId.classId.name
                    },
                    width: 100
                },
                subjectName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Môn học',
                    cellFormat: function(value, element) {
                        if (!element ||
                            !element.examId ||
                            !element.examId.lessonId ||
                            !element.examId.lessonId.contentId ||
                            !element.examId.lessonId.contentId.subjectId)
                            return ""
                        return element.examId.lessonId.contentId.subjectId.name
                    },
                    width: 200
                },
                contentName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Chương',
                    cellFormat: function(value, element) {
                        if (!element ||
                            !element.examId ||
                            !element.examId.lessonId ||
                            !element.examId.lessonId.contentId)
                            return ""
                        return element.examId.lessonId.contentId.name
                    },
                    width: 200
                },
                lessonName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Bài',
                    cellFormat: function(value, element) {
                        if (!element ||
                            !element.examId ||
                            !element.examId.lessonId)
                            return ""
                        return element.examId.lessonId.name
                    },
                    width: 200
                },
                time: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Thời gian',
                    cellFormat: function(value, row) {
                        return row.start
                    },
                    width: 400
                },
                point: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Điểm',
                    cellFormat: function(value, row) {
                        return row.point
                    },
                    width: 50
                }
            }

            const report = excel.buildExport([{
                specification: specification,
                data: answers
            }]);

            res.attachment("answers.xlsx");
            return res.send(report);
        })
})

router.get("/exams/:id", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Không đủ quyền thực hiện")
    ExamModel.findById(req.params.id, (err, exam) => {
        if (err) return error(res, err)
        if (!exam)
            return fail(res, "Bài kiểm tra không tồn tại")
        exam.time = exam.time / 60
        return success(res, exam)
    })
})

router.get("/exam/:id", (req, res) => {
    if (req.authz.role == "anony") {
        return fail(res, "Vui lòng đăng nhập trước khi thực hiện")
    } else {
        ExamModel.findById(req.params.id, "name time total datetime password answer plan", (err, exam) => {
            if (err) return error(res, err);
            if (!exam)
                return fail(res, "Bài kiểm tra không tồn tài")
            exam.time = exam.time / 60
            if (exam.password)
                exam._doc.password = true
            else
                exam._doc.password = false
            AnswerModel.findOne({
                userId: new ObjectId(req.authz.uid),
                examId: new ObjectId(req.params.id),
                status: "doing"
            }, (err, answer) => {
                if (err) return error(res, err)
                if (!answer) {
                    AnswerModel.countDocuments({
                        userId: new ObjectId(req.authz.uid),
                        examId: new ObjectId(req.params.id),
                        status: "done"
                    }, (err, done) => {
                        if (err) return error(res, err)
                        if (done > 0)
                            exam._doc.status = "done"
                        else
                            exam._doc.status = null

                        AnswerModel.find({
                                userId: new ObjectId(req.authz.uid),
                                examId: new ObjectId(req.params.id),
                                status: "done"
                            })
                            .select("point _id status start")
                            .sort("-start")
                            .exec((err, answers) => {
                                if (err) return error(res, err)
                                exam._doc.answers = answers
                                exam._doc.answer = undefined
                                return success(res, exam)
                            })
                    })
                } else {
                    pass = Math.round((Date.now() - answer.start) / 1000)
                    if (pass >= exam.time * 60) {
                        answer.end = Date.now()
                        answer.remain = 0
                        answer.answer = answer.answer.toUpperCase()
                        answer.correct = 0
                        answer.status = "done"


                        length = Math.min(answer.answer.length, exam.answer.length)
                        for (let i = 0; i < length; i++) {
                            answer.correct += (answer.answer[i] === exam.answer[i])
                        }
                        answer.point = Math.round((answer.correct / exam.total * 10) * 100) / 100
                        AnswerModel.updateOne({ _id: answer.id }, answer, (err, answer) => {
                            if (err) return error(res, err)
                            exam._doc.status = "done"
                            AnswerModel.find({
                                    userId: new ObjectId(req.authz.uid),
                                    examId: new ObjectId(req.params.id),
                                    status: "done"
                                })
                                .select("point _id status start")
                                .sort("-start")
                                .exec((err, answers) => {
                                    if (err) return error(res, err)
                                    exam._doc.answers = answers
                                    exam.answer = undefined

                                    if (!["admin", "dean", "teacher"].includes(req.authz.role)) {
                                        UserModel.findById(req.authz.uid, (err, user) => {
                                            if (err) return error(res, err)
                                            if (user.remain - exam.time <= 0) {
                                                user.active = false
                                                user.remain = 0
                                            } else {
                                                user.active = true
                                                user.remain = user.remain - exam.time
                                            }
                                            UserModel.updateOne({ _id: req.authz.uid }, user, err => {
                                                if (err) return error(res, err)
                                                return success(res, exam)
                                            })

                                        })
                                    } else
                                        return success(res, exam)
                                })
                        })

                    } else {
                        answer.remain = exam.time * 60 - pass
                        AnswerModel.updateOne({ _id: answer.id }, answer, (err, answer) => {
                            if (err) return error(res, err)
                            exam._doc.status = "doing"
                            AnswerModel.find({
                                    userId: new ObjectId(req.authz.uid),
                                    examId: new ObjectId(req.params.id),
                                    status: "done"
                                })
                                .select("point _id status start")
                                .sort("-start")
                                .exec((err, answers) => {
                                    if (err) return error(res, err)
                                    exam._doc.answers = answers
                                    exam.answer = undefined
                                    return success(res, exam)
                                })
                        })
                    }
                }

            })
        })
    }
})

router.get("/exams/lessons/:id", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Chỉ admin có thể liệt kê tất cả các bài kiểm tra")
    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1
    if (!req.query.sort)
        req.query.sort = "-datetime"

    query = req.query.search ? {
        name: { $regex: req.query.search, $options: "i" },
        lessonId: req.params.id
    } : { lessonId: req.params.id }

    ExamModel.find(query)
        .select("name datetime lessonId password userId plan")
        .populate({
            path: 'lessonId',
            select: 'name contentId',
            populate: {
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
            }
        })
        .populate({
            path: 'userId',
            select: 'name email'
        })
        .sort('-datetime')
        .skip((req.query.page - 1) * req.query.limit)
        .limit(parseInt(req.query.limit))
        .exec((err, exams) => {
            if (err) return error(res, err)
            ExamModel.countDocuments(query, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/exams/lessons/" + req.params.id + "?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/exams/lessons/" + req.params.id + "?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                exams = exams.map(element => {
                    if (!element || !element.lessonId || !element.lessonId.contentId || !element.lessonId.contentId.subjectId || !element.lessonId.contentId.subjectId.classId)
                        return {}
                    else
                        return {
                            _id: element._id,
                            name: element.name,
                            lessonName: element.lessonId.name,
                            contentName: element.lessonId.contentId.name,
                            subjectName: element.lessonId.contentId.subjectId.name,
                            className: element.lessonId.contentId.subjectId.classId.name,
                            datetime: element.datetime,
                            password: (element.password) ? true : false,
                            userName: element.userId.name,
                            userEmail: element.userId.email,
                            plan: element.plan
                        }
                })
                data = { totalPage: totalPage, page: req.query.page, data: exams, previous: previous, next: next }
                return success(res, data)
            })
        })
})

router.get("/examslectures/lessons/:id", (req, res) => {
    ExamModel.find({ lessonId: req.params.id })
        .select("name datetime plan")
        .exec((err, exams) => {
            if (err) return error(res, err)
            if (!exams)
                exams = []
            exams.forEach(element => {
                element._doc.type = "exam"
            });
            LectureModel.find({ lessonId: req.params.id })
                .select("name datetime password plan")
                .exec((err, lectures) => {
                    if (err) return error(res, err)
                    if (!lectures)
                        lectures = []
                    lectures.forEach(element => {
                        element._doc.type = "lecture"
                        element._doc.password = element._doc.password ? true : false
                    });
                    let data = {
                        examslectures: exams.concat(lectures).sort((a, b) => {
                            return a.name.localeCompare(b.name)
                        })
                    }
                    return success(res, data)
                })
        })
})

router.post("/exams", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Chỉ admin có thể tạo bài kiểm tra")
    LessonModel.find({ _id: req.body.lessonId }, (err, lessons) => {
        if (err) return error(res, err)
        if (lessons.length < 1)
            return fail(res, "Bài học không tồn tài")
        ExamModel.find({ name: req.body.name, lessonId: req.body.lessonId }, (err, exams) => {
            if (err) return error(res, err)
            if (exams.length > 0)
                return fail(res, "Bài kiểm tra đã tồn tại")
            if (!req.body.answer || !Number.isInteger(parseInt(req.body.time)))
                return fail(res, "Thiếu thông tin để tạo bài kiểm tra")
            req.body.answer = req.body.answer.toUpperCase().replace(/[^ABCD]/g, '')
            req.body.total = req.body.answer.length
            req.body.time = req.body.time * 60
            if (req.authz.role != "admin" || !req.body.userId)
                req.body.userId = req.authz.uid
            ExamModel.create(req.body, (err, exam) => {
                if (err) return error(res, err)
                return success(res, exam)
            })
        })
    })
})

router.put("/exams/:id", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Chỉ admin có thể chỉnh sửa bài kiểm tra")
    req.body.answer = req.body.answer.toUpperCase().replace(/[^ABCD]/g, '')
    req.body.total = req.body.answer.length
    req.body.time = req.body.time * 60
    ExamModel.findById(req.params.id, (err, exam) => {
        if (err) return error(res, err)
        if (!exam)
            return fail(res, "Bài kiểm tra không tồn tại")
        if (exam.userId != req.authz.uid && ["dean", "teacher"].includes(req.authz.role))
            return fail(res, "Giáo viên không thể chỉnh sửa bài kiểm tra của người khác")
        ExamModel.updateOne({ _id: req.params.id }, req.body, (err, r) => {
            if (err) return error(res, err)
            return success(res, null, "Chỉnh sửa bài kiểm tra thành công")
        })
    })
})

router.delete("/exams/:id", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Chỉ admin có thể xóa bài kiểm tra")
    ExamModel.findById(req.params.id, (err, exam) => {
        if (err) return error(res, err)
        if (!exam)
            return fail(res, "Bài kiểm tra không tồn tại")
        if (exam.userId != req.authz.uid && ["dean", "teacher"].includes(req.authz.role))
            return fail(res, "Giáo viên không thể xóa bài kiểm tra của người khác")
        ExamModel.deleteOne({ _id: req.params.id }, err => {
            if (err) return error(res, err)
            AnswerModel.deleteMany({ examId: ObjectId(req.params.id) }, err => {
                if (err) return error(res, err)
                return success(res, null, "Xóa bài kiểm tra thành công")
            })
        })
    })
})






router.get("/answer/:id", (req, res) => {
    if (req.authz.role == "anony")
        return fail(res, "Vui lòng đăng nhập trước khi thực hiện")
    AnswerModel.findById(req.params.id, (err, answer) => {
        if (err) return error(res, err)
        if (!answer)
            return fail(res, "Bài làm không tồn tài")
        if (answer.userId != req.authz.uid && (!["admin", "dean", "teacher"].includes(req.authz.role)))
            return fail(res, "Chỉ được phép xem bài làm của bạn")
        ExamModel.findById(answer.examId, (err, exam) => {
            if (err) return error(res, err)
            exam.password = undefined
            answer._doc.exam = exam
            return success(res, answer)
        })
    })
})

function getAnswerbyExam(req, res) {
    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1

    AnswerModel.find({
            examId: new ObjectId(req.params.id),
            status: "done"
        })
        .select("point start correct")
        .populate({
            path: "userId",
            select: "name email"
        })
        .populate({
            path: "examId",
            select: "total name"
        })
        .sort('-start')
        .skip((req.query.page - 1) * req.query.limit)
        .limit(parseInt(req.query.limit))
        .exec((err, answers) => {
            if (err) return error(res, err)
            AnswerModel.countDocuments({
                examId: new ObjectId(req.params.id),
                status: "done"
            }, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/answers/exams/" + req.params.id + "?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/answers/exams/" + req.params.id + "?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null

                answers.forEach(element => {
                    element._doc.userEmail = element.userId.email
                    element._doc.userName = element.userId.name
                    element.userId = undefined
                    element._doc.examName = element.examId.name
                    element._doc.total = element.examId.total
                    element.examId = undefined
                });
                return success(res, {
                    totalPage: totalPage,
                    page: req.query.page,
                    data: answers,
                    previous: previous,
                    next: next
                })
            })

        })
}

router.get("/answers/exams/:id", async(req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Chỉ admin có thể thực hiện")

    ExamModel.findById(req.params.id, "time total datetime answer", (err, exam) => {
        if (err) return error(res, err);
        if (!exam)
            return fail(res, "Bài kiểm tra không tồn tài")
        exam.time = exam.time / 60
        AnswerModel.find({
            examId: new ObjectId(req.params.id),
            status: "doing"
        }, (err, answers) => {
            if (err) return error(res, err)

            let answerPromises = answers.map(answer => {
                return new Promise((resolve, reject) => {
                    pass = Math.round((Date.now() - answer.start) / 1000)
                    if (pass >= exam.time * 60) {
                        answer.end = Date.now()
                        answer.remain = 0
                        answer.answer = answer.answer.toUpperCase()
                        answer.correct = 0
                        answer.status = "done"


                        length = Math.min(answer.answer.length, exam.answer.length)
                        for (let i = 0; i < length; i++) {
                            answer.correct += (answer.answer[i] === exam.answer[i])
                        }
                        answer.point = Math.round((answer.correct / exam.total * 10) * 100) / 100
                        AnswerModel.updateOne({ _id: answer.id }, answer, (err, a) => {
                            if (err) reject(err)
                            UserModel.findById(answer.userId, (err, user) => {
                                if (err) reject(err)
                                if (user.role != "admin") {
                                    if (user.remain - exam.time <= 0) {
                                        user.active = false
                                        user.remain = 0
                                    } else {
                                        user.active = true
                                        user.remain = user.remain - exam.time
                                    }
                                    UserModel.updateOne({ _id: answer.userId }, user, err => {
                                        if (err) reject(err)
                                        resolve()
                                    })
                                }
                                resolve()
                            })
                        })
                    }
                    resolve()
                })
            })

            Promise.all(answerPromises)
                .then(() => {
                    getAnswerbyExam(req, res)
                })
                .catch((err) => {
                    return error(res, err)
                })

        })
    })
})

router.get("/answers/exams/:id/export", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Không đủ quyền xuất báo cáo bài làm")

    AnswerModel.find({
            examId: new ObjectId(req.params.id),
            status: "done"
        })
        .select("point start correct")
        .populate({
            path: "userId",
            select: "name email"
        })
        .populate({
            path: "examId",
            select: "total name"
        })
        .sort('-start')
        .exec((err, answers) => {
            if (err) return error(res, err)
            if (!answers || answers.length == 0)
                return fail(res, "Đề thi chưa được làm lần nào")

            const specification = {
                name: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Tên',
                    cellFormat: function(value, row) {
                        return row.userId.name
                    },
                    width: 200
                },
                email: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Email',
                    cellFormat: function(value, row) {
                        return row.userId.email
                    },
                    width: 200
                },
                time: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Thời gian',
                    cellFormat: function(value, row) {
                        return row.start
                    },
                    width: 80
                },
                correct: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Đúng/Tổng số',
                    cellFormat: function(value, row) {
                        return row.correct + "/" + row.examId.total
                    },
                    width: 120
                },
                point: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Điểm',
                    cellFormat: function(value, row) {
                        return row.point
                    },
                    width: 50
                }
            }

            const report = excel.buildExport([{
                specification: specification,
                data: answers
            }]);

            res.attachment(answers[0].examId.name + ".xlsx");
            return res.send(report);
        })
})

router.get("/answers/export", (req, res) => {
    if (!["admin", "dean"].includes(req.authz.role))
        return fail(res, "Không đủ quyền xuất báo cáo bài làm toàn bộ hệ thống")

    if (req.query.start)
        startDate = new Date(req.query.start)
    else {
        startDate = new Date()
        startDate.setMonth(startDate.getMonth() - 1)
    }
    endDate = req.query.end ? new Date(req.query.end) : new Date()
    endDate.setDate(endDate.getDate() + 1)

    AnswerModel.find({
            status: "done",
            start: { $gte: startDate, $lte: endDate }
        })
        .select("point start correct")
        .populate({
            path: "userId",
            select: "name email"
        })
        .populate({
            path: "examId",
            select: "total name",
            populate: {
                path: 'lessonId',
                select: 'name contentId',
                populate: {
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
                }
            }
        })
        .sort('-userId')
        .exec((err, answers) => {
            if (err) return error(res, err)
            if (!answers || answers.length == 0)
                return fail(res, "Không có lần làm bài nào")

            const specification = {
                name: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Tên',
                    cellFormat: function(value, row) {
                        return row.userId.name
                    },
                    width: 200
                },
                email: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Email',
                    cellFormat: function(value, row) {
                        return row.userId.email
                    },
                    width: 200
                },
                time: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Thời gian',
                    cellFormat: function(value, row) {
                        return row.start
                    },
                    width: 80
                },
                className: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Lớp',
                    cellFormat: function(value, row) {
                        return row.examId.lessonId.contentId.subjectId.classId.name
                    },
                    width: 80
                },
                subjectName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Môn',
                    cellFormat: function(value, row) {
                        return row.examId.lessonId.contentId.subjectId.name
                    },
                    width: 100
                },
                contentName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Chương',
                    cellFormat: function(value, row) {
                        return row.examId.lessonId.contentId.name
                    },
                    width: 200
                },
                lessonName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Bài',
                    cellFormat: function(value, row) {
                        return row.examId.lessonId.name
                    },
                    width: 300
                },
                examName: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Tên đề',
                    cellFormat: function(value, row) {
                        return row.examId.name
                    },
                    width: 300
                },
                correct: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Đúng/Tổng số',
                    cellFormat: function(value, row) {
                        return row.correct + "/" + row.examId.total
                    },
                    width: 120
                },
                point: {
                    headerStyle: { font: { bold: true } },
                    displayName: 'Điểm',
                    cellFormat: function(value, row) {
                        return row.point
                    },
                    width: 50
                }
            }

            const report = excel.buildExport([{
                specification: specification,
                data: answers
            }]);

            res.attachment("Thong ke bai lam tu " + startDate.toISOString().split('T')[0] + " toi " + endDate.toISOString().split('T')[0] + ".xlsx");
            return res.send(report);
        })
})

router.post("/answers", (req, res) => {
    if (req.authz.role == "anony")
        return fail(res, "Vui lòng đăng nhập trước khi làm bài kiểm tra")
    ExamModel.findById(req.body.examId, "name time examUrl password contentId total datetime plan", (err, exam) => {
        if (err) return error(res, err)
        if (!exam)
            return fail(res, "Bài kiểm tra không tồn tại")
        if (exam.plan == "pro")
            if (req.authz.plan != "pro")
                return fail(res, "Vui lòng nâng cấp tài khoản để thực hiện")
        if (exam.password) {
            if (!req.body.password)
                return fail(res, "Vui lòng nhập mật khẩu bài kiểm tra")
            if (req.body.password !== exam.password)
                return fail(res, "Sai mật khẩu")
        }
        exam.password = undefined
        AnswerModel.find({
            userId: new ObjectId(req.authz.uid),
            examId: new ObjectId(req.body.examId),
            status: "doing"
        }, (err, answers) => {
            if (err) return error(res, err)
            if (answers.length > 0) {
                return success(res, {
                    answer: answers[0],
                    exam
                })
            } else
                AnswerModel.create({
                    remain: exam.time,
                    answer: "",
                    userId: req.authz.uid,
                    examId: req.body.examId,
                    status: "doing"
                }, (err, answer) => {
                    if (err) return error(res, err)
                    return success(res, { answer, exam }, "Bắt đầu tính thời gian làm bài")
                })
        })
    })
})

router.put("/answers/:id", (req, res) => {
    if (req.authz.role == "anony")
        return fail(res, "Vui lòng đăng nhập trước khi làm bài kiểm tra")
    if (!req.body.status)
        req.body.status = "doing"

    AnswerModel.findById(req.params.id, (err, answer) => {
        if (err) return error(res, err)
        if (!answer)
            return fail(res, "Bài làm không tồn tại")
        if (answer.status === "done")
            return fail(res, "Không được phép cập nhật bài làm đã hoàn thành")
        if (req.body.status == "done") {
            pass = Math.round((Date.now() - answer.start) / 1000)

            req.body.end = Date.now()
            req.body.remain = 0
            req.body.correct = 0
            ExamModel.findById(answer.examId, (err, exam) => {
                if (err) return error(res, err)
                if (!exam)
                    return fail(res, "Bài kiểm tra không tồn tại")
                if (pass - 60 > exam.time)
                    req.body.answer = answer.answer.toUpperCase()
                else
                    req.body.answer = req.body.answer.toUpperCase()

                length = Math.min(req.body.answer.length, exam.answer.length)
                for (let i = 0; i < length; i++) {
                    req.body.correct += (req.body.answer[i] === exam.answer[i])
                }
                req.body.point = Math.round((req.body.correct / exam.total * 10) * 100) / 100
                AnswerModel.updateOne({ _id: req.params.id }, req.body, (err, answers) => {
                    if (err) return error(res, err)
                    if (!["admin", "dean", "teacher"].includes(req.authz.role)) {
                        UserModel.findById(req.authz.uid, (err, user) => {
                            if (err) return error(res, err)
                            if (user.remain - exam.time / 60 <= 0) {
                                user.active = false
                                user.remain = 0
                            } else {
                                user.active = true
                                user.remain = user.remain - exam.time / 60
                            }
                            UserModel.updateOne({ _id: req.authz.uid }, user, err => {
                                if (err) return error(res, err)
                                return success(res, {
                                    _id: req.params.id,
                                    correct: req.body.correct,
                                    total: exam.total,
                                    point: req.body.point
                                }, "Nộp bài thành công")
                            })

                        })
                    } else {
                        return success(res, {
                            _id: req.params.id,
                            correct: req.body.correct,
                            total: exam.total,
                            point: req.body.point
                        }, "Nộp bài thành công")
                    }

                })
            })
        } else {
            AnswerModel.updateOne({ _id: req.params.id }, req.body, (err, answers) => {
                if (err) return error(res, err)
                return success(res, null, "Cập nhật bài làm thành công")
            })
        }
    })
})

router.get("/statistic", async(req, res) => {
    if (!["admin", "dean"].includes(req.authz.role))
        return fail(res, "Không đủ quyền xuất thống kê hệ thống")
    try {
        const examCount = await ExamModel.countDocuments({})
        const lectureCount = await LectureModel.countDocuments({})
        const answerCount = await AnswerModel.countDocuments({})
        const userCount = await UserModel.countDocuments({})

        return success(res, { examCount, lectureCount, answerCount, userCount })
    } catch (err) {
        error(res, err)
    }
})

router.get("/statistic/date", async(req, res) => {
    if (!["admin", "dean"].includes(req.authz.role))
        return fail(res, "Không đủ quyền xuất thống kê hệ thống")

    if (req.query.start)
        startDate = new Date(req.query.start)
    else {
        startDate = new Date()
        startDate.setMonth(startDate.getMonth() - 1)
    }
    endDate = req.query.end ? new Date(req.query.end) : new Date()
    endDate.setDate(endDate.getDate() + 1)

    try {
        const answerByDateCount = await AnswerModel.aggregate(
            [{
                    "$match": {
                        "start": {
                            "$gte": startDate,
                            "$lte": endDate
                        }
                    }
                },

                {
                    "$group": {
                        "_id": {
                            "year": { "$year": "$start" },
                            "month": { "$month": "$start" },
                            "day": { "$dayOfMonth": "$start" }
                        },
                        "date": { "$first": "$start" },
                        "count": { "$sum": 1 }
                    }
                },
                {
                    "$sort": { "date": 1 }
                },
            ]
        )
        return success(res, { answerByDateCount })
    } catch (err) {
        error(res, err)
    }
})

module.exports = router;