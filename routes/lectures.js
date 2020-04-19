var express = require("express");
var router = express.Router();
const LessonModel = require("../schema/LessonModel");
const LectureModel = require("../schema/LectureModel");
const { success, error, fail } = require("../common");

router.get("/lectures", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
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
        .exec((err, lectures) => {
            if (err) return error(res, err)
            LectureModel.countDocuments(query, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/lectures?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/lectures?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                lectures = lectures.map(element => {
                    if (!element || !element.lessonId || !element.lessonId.contentId || !element.lessonId.contentId.subjectId || !element.lessonId.contentId.subjectId.classId)
                        return {}
                    else
                        return {
                            _id: element._id,
                            name: element.name,
                            lectureUrl: element.lectureUrl,
                            lessonName: element.lessonId.name,
                            contentName: element.lessonId.contentId.name,
                            subjectName: element.lessonId.contentId.subjectId.name,
                            className: element.lessonId.contentId.subjectId.classId.name,
                            datetime: element.datetime,
                            password: element.password ? element.password : null,
                            userName: element.userId ? element.userId.name : "",
                            userEmail: element.userId ? element.userId.email : "",
                            package: element.package
                        }
                })
                data = { totalPage: totalPage, page: req.query.page, data: lectures, previous: previous, next: next }
                return success(res, data)
            })
        })
})


router.get("/lectures/:id", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
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
        if (!lecture)
            return fail(res, "Bài giảng không tồn tại")
        if (lecture.package == "fee")
            if (req.authz.package != "fee")
                return fail("Vui lòng nâng cấp tài khoản để thực hiện")
        if (lecture.password)
            if (req.body.password != lecture.password)
                return fail(res, "Sai mật khẩu")
        return success(res, lecture)
    })
})

router.get("/lectures/lessons/:id", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role)) 
        return fail(res, "Chỉ admin và giáo viên có thể thực hiện")

    if (!req.query.limit)
        req.query.limit = 10
    if (!req.query.page)
        req.query.page = 1

    query = req.query.search ? {
        name: { $regex: req.query.search, $options: "i" },
        lessonId: req.params.id
    } : { lessonId: req.params.id }

    LectureModel.find(query)
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
        .sort('-datetime')
        .skip((req.query.page - 1) * req.query.limit)
        .limit(parseInt(req.query.limit))
        .exec((err, lectures) => {
            if (err) return error(res, err)
            LectureModel.countDocuments(query, (err, totalPage) => {
                if (err) return error(res, err)
                totalPage = Math.ceil(totalPage / req.query.limit)
                previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/lectures/lessons/" + req.params.id + "?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
                next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/lectures/lessons/" + req.params.id + "?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
                lectures = lectures.map(element => {
                    if (!element || !element.lessonId || !element.lessonId.contentId || !element.lessonId.contentId.subjectId || !element.lessonId.contentId.subjectId.classId)
                        return {}
                    else
                        return {
                            _id: element._id,
                            name: element.name,
                            lectureUrl: element.lectureUrl,
                            lessonName: element.lessonId.name,
                            contentName: element.lessonId.contentId.name,
                            subjectName: element.lessonId.contentId.subjectId.name,
                            className: element.lessonId.contentId.subjectId.classId.name,
                            datetime: element.datetime,
                            password: element.password ? element.password : null,
                            userName: element.userId ? element.userId.name : "",
                            userEmail: element.userId ? element.userId.email : "",
                            package: element.package
                        }
                })
                data = { totalPage: totalPage, page: req.query.page, data: lectures, previous: previous, next: next }
                return success(res, data)
            })
        })
})

router.post("/lectures", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Không đủ quyền tạo bài giảng")
    LessonModel.findById(req.body.lessonId, (err, lesson) => {
        if (err) return error(res, err)
        if (!lesson)
            return fail(res, "Bài học không tồn tài")
        LectureModel.find({ name: req.body.name, lessonId: req.body.lessonId }, (err, lectures) => {
            if (err) return error(res, err)
            if (lectures.length > 0)
                return fail(res, "Bài giảng đã tồn tại")
            if (req.authz.role != "admin" || !req.body.userId)
                req.body.userId = req.authz.uid
            LectureModel.create(req.body, (err, lecture) => {
                if (err) return error(res, err)
                return success(res, lecture)
            })
        })
    })
})

router.put("/lectures/:id", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Chỉ admin có thể chỉnh sửa bài giảng")

    LectureModel.findById(req.params.id, (err, lecture) => {
        if (err) return error(res, err)
        if (!lecture)
            return fail(res, "Bài giảng không tồn tại")
        if (lecture.userId != req.authz.uid && ["dean", "teacher"].includes(req.authz.role))
            return fail(res, "Giáo viên không thể chỉnh sửa bài giảng của người khác")
        LectureModel.updateOne({ _id: req.params.id }, req.body, (err, r) => {
            if (err) return error(res, err)
            return success(res, null, "Chỉnh sửa bài giảng thành công")
        })
    })
})

router.delete("/lectures/:id", (req, res) => {
    if (!["admin", "dean", "teacher"].includes(req.authz.role))
        return fail(res, "Không đủ quyền có thể xóa bài giảng")
    LectureModel.findById(req.params.id, (err, lecture) => {
        if (err) return error(res, err)
        if (!lecture)
            return fail(res, "Bài giảng không tồn tại")
        if (lecture.userId != req.authz.uid && ["dean", "teacher"].includes(req.authz.role))
            return fail(res, "Giáo viên không thể xóa bài giảng của người khác")
        LectureModel.deleteOne({ _id: req.params.id }, err => {
            if (err) return error(res, err)
            return success(res, null, "Xóa bài giảng thành công")
        })
    })
})


module.exports = router;