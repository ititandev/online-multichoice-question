var express = require("express");
var router = express.Router();
const ClassModel = require("../schema/ClassModel");
const SubjectModel = require("../schema/SubjectModel");
const ContentModel = require("../schema/ContentModel");
const { success, error, fail } = require("../common");



router.get("/classes", (req, res) => {
    ClassModel.find((err, classes) => {
        if (err) return error(res, err)
        return success(res, classes)
    })
})

router.get("/classes/subjects", (req, res) => {
    SubjectModel.find()
        .select("_id name")
        .populate("classId", "_id name")
        .exec((err, subjects) => {
            if (err) return error(res, err)
            subjects = subjects.reduce(function (rv, x) {
                if (x.classId)
                    (rv[x.classId.name] = rv[x.classId.name] || []).push({ _id: x._id, name: x.name });
                return rv;
            }, {});
            return success(res, Object.keys(subjects).map((key) => {
                return { className: key, subjects: subjects[key] };
            }))
        })
})

router.post("/classes", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể tạo lớp học")
    ClassModel.find({ name: req.body.name }, (err, classes) => {
        if (err) return error(res, err)
        if (classes.length > 0)
            return fail(res, "Lớp học đã tồn tại")
        ClassModel.create({ name: req.body.name }, (err, c) => {
            if (err) return error(res, err)
            return success(res, c)
        })
    })

})

router.put("/classes/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể chỉnh sửa lớp học")
    ClassModel.updateOne({ _id: req.params.id }, { name: req.body.name }, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Chỉnh sửa lớp học thành công")
    })
})

router.delete("/classes/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể xóa lớp học")
    ClassModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Xóa lớp học thành công")
    })
})




router.get("/subjects/:id", (req, res) => {
    SubjectModel.find({ classId: req.params.id })
        // .populate("classId")
        .exec((err, subjects) => {
            if (err) return error(res, err)
            return success(res, subjects)
        })
})

router.post("/subjects", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể tạo môn học")
    ClassModel.find({ _id: req.body.classId }, (err, classes) => {
        if (err) return error(res, err)
        if (classes.length < 1)
            return fail(res, "Lớp học không tồn tại")
        SubjectModel.find({ name: req.body.name, classId: req.body.classId }, (err, subjects) => {
            if (err) return error(res, err)
            if (subjects.length > 0)
                return fail(res, "Môn học đã tồn tại")
            SubjectModel.create({ name: req.body.name, classId: req.body.classId }, (err, c) => {
                if (err) return error(res, err)
                return success(res, c)
            })
        })
    })
})

router.put("/subjects/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể chỉnh sửa môn học")
    SubjectModel.updateOne({ _id: req.params.id }, { name: req.body.name }, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Chỉnh sửa môn học thành công")
    })
})

router.delete("/subjects/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể xóa môn học")
    SubjectModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Xóa môn học thành công")
    })
})




router.get("/contents/:id", (req, res) => {
    ContentModel.find({ subjectId: req.params.id })
        // .populate("subjectId")
        .exec((err, contents) => {
            if (err) return error(res, err)
            return success(res, contents)
        })
})

router.post("/contents", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể tạo chủ đề")
    SubjectModel.find({ _id: req.body.subjectId }, (err, subjects) => {
        if (err) return error(res, err)
        if (subjects.length < 1)
            return fail(res, "Môn học không tồn tại")
        ContentModel.find({ name: req.body.name, subjectId: req.body.subjectId }, (err, contents) => {
            if (err) return error(res, err)
            if (contents.length > 0)
                return fail(res, "Chủ đề đã tồn tại")
            ContentModel.create({ name: req.body.name, subjectId: req.body.subjectId }, (err, c) => {
                if (err) return error(res, err)
                return success(res, c)
            })
        })
    })
})

router.put("/contents/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể chỉnh sửa chủ đề")
    ContentModel.updateOne({ _id: req.params.id }, { name: req.body.name }, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Chỉnh sửa chủ đề thành công")
    })
})

router.delete("/contents/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Chỉ admin có thể xóa chủ đề")
    ContentModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Xóa chủ đề thành công")
    })
})


module.exports = router;
