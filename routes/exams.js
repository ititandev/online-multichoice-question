var express = require("express");
var router = express.Router();
const ContentModel = require("../schema/ContentModel");
const ExamModel = require("../schema/ExamModel");
const LectureModel = require("../schema/LectureModel")
const AnswerModel = require("../schema/AnswerModel");
const UserModel = require("../schema/UserModel");
const { success, error, fail } = require("../common");
var ObjectId = require('mongoose').Types.ObjectId;



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
                    element._doc.examId = element.examId
                    element._doc.examName = element.examId ? element.examId.name : ""
                    element._doc.contentName = element.examId.contentId ? element.examId.contentId.name : ""
                    element._doc.subjectName = element.examId.contentId.subjectId ? element.examId.contentId.subjectId.name : ""
                    element._doc.className = element.examId.contentId.subjectId.classId ? element.examId.contentId.subjectId.classId.name : ""
                    element.examId = element.examId._id
                })
                return success(res, data)
            })
    }
    else {
        if (req.authz.role != "admin" && req.authz.role != "teacher")
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
                        if (!element || !element.contentId || !element.contentId.subjectId || !element.contentId.subjectId.classId)
                            return {}
                        else
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
    }

})

router.get("/exams/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể thực hiện")
    ExamModel.findById(req.params.id, (err, exam) => {
        if (err) return error(res, err)
        exam.time = exam.time / 60
        return success(res, exam)
    })
})

router.get("/exam/:id", (req, res) => {
    if (req.authz.role == "anony") {
        return fail(res, "Vui lòng đăng nhập trước khi thực hiện")
    } else {
        ExamModel.findById(req.params.id, "name time total datetime password answer", (err, exam) => {
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
                                return success(res, exam)
                            })
                    })
                }
                else {
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

                                    if (req.authz.role != "admin" && req.authz.role != "teacher") {
                                        UserModel.findById(req.authz.uid, (err, user) => {
                                            if (err) return error(res, err)
                                            if (user.remain - exam.time <= 0) {
                                                user.active = false
                                                user.remain = 0
                                            }
                                            else {
                                                user.active = true
                                                user.remain = user.remain - exam.time
                                            }
                                            UserModel.updateOne({ _id: req.authz.uid }, user, err => {
                                                if (err) return error(res, err)
                                                return success(res, exam)
                                            })

                                        })
                                    }
                                    else
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
                                    return success(res, exam)
                                })
                        })
                    }
                }

            })
        })
    }
})

router.get("/exams/contents/:id", (req, res) => {
    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1

    ExamModel.find({ contentId: req.params.id })
        .select("name datetime contentId password total time")
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
                    if (!element || !element.contentId || !element.contentId.subjectId || !element.contentId.subjectId.classId)
                        return {}
                    else
                        return {
                            _id: element._id,
                            name: element.name,
                            contentName: element.contentId.name,
                            subjectName: element.contentId.subjectId.name,
                            className: element.contentId.subjectId.classId.name,
                            total: element.total,
                            time: element.time,
                            datetime: element.datetime,
                            password: (element.password) ? true : false
                        }
                })
                data = { totalPage: totalPage, page: req.query.page, data: exams, previous: previous, next: next }
                return success(res, data)
            })
        })
})

router.get("/examslectures/contents/:id", (req, res) => {
    ContentModel.findById(req.params.id)
        .select("name subjectId")
        .populate({
            path: 'subjectId',
            select: 'name',
            populate: {
                path: 'classId',
                select: 'name'
            }
        })
        .exec((err, content) => {
            if (err) return error(res, err)
            if (!content)
                return fail(res, "Chủ đề không tồn tại")
            if (!content.subjectId || !content.subjectId.classId)
                return fail(res, "Chủ đề không thuộc về một môn học hoặc một lớp học nào")

            ExamModel.find({ contentId: req.params.id })
                .select("name datetime")
                .exec((err, exams) => {
                    if (err) return error(res, err)
                    exams.forEach(element => {
                        element._doc.type = "exam"
                    });
                    LectureModel.find({ contentId: req.params.id })
                        .select("name datetime lectureUrl")
                        .exec((err, lectures) => {
                            if (err) return error(res, err)
                            lectures.forEach(element => {
                                element._doc.type = "lecture"
                            });
                            let data = {
                                contentName: content.name,
                                subjectName: content.subjectId.name,
                                className: content.subjectId.classId.name,
                                examslectures: exams.concat(lectures).sort((a, b) => {
                                    return new Date(b.datetime) - new Date(a.datetime);
                                })
                            }
                            return success(res, data)
                        })
                })
        })
})

router.post("/exams", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
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
            req.body.time = req.body.time * 60
            req.body.userId = req.authz.uid
            ExamModel.create(req.body, (err, exam) => {
                if (err) return error(res, err)
                return success(res, exam)
            })
        })
    })
})

router.put("/exams/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể chỉnh sửa bài kiểm tra")
    req.body.answer = req.body.answer.toUpperCase().replace(/[^ABCD]/g, '')
    req.body.total = req.body.answer.length
    req.body.time = req.body.time * 60
    ExamModel.findById(req.params.id, (err, exam) => {
        if (err) return error(res, err)
        if (exam.userId != userId && req.authz.role == "teacher")
            return fail(res, "Giáo viên không thể chỉnh sửa bài kiểm tra của người khác")
        ExamModel.updateOne({ _id: req.params.id }, req.body, (err, r) => {
            if (err) return error(res, err)
            return success(res, null, "Chỉnh sửa bài kiểm tra thành công")
        })
    })
})

router.delete("/exams/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể xóa bài kiểm tra")
    ExamModel.findById(req.params.id, (err, exam) => {
        if (err) return error(res, err)
        if (exam.userId != userId && req.authz.role == "teacher")
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
        if (answer.userId != req.authz.uid && req.authz.role != "admin" && req.authz.role != "teacher")
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

router.get("/answers/exams/:id", async (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
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
                                    }
                                    else {
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
            }
            else
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
                    if (req.authz.role != "admin" && req.authz.role != "teacher") {
                        UserModel.findById(req.authz.uid, (err, user) => {
                            if (err) return error(res, err)
                            if (user.remain - exam.time / 60 <= 0) {
                                user.active = false
                                user.remain = 0
                            }
                            else {
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
                    }
                    else {
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

module.exports = router;
