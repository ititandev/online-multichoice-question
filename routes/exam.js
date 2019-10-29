var express = require("express");
var router = express.Router();
const ClassModel = require("../schema/ClassModel");
const SubjectModel = require("../schema/SubjectModel");
const ContentModel = require("../schema/ContentModel");
const ExamModel = require("../schema/ExamModel");
const { success, error, fail } = require("../common")
const bcrypt = require("bcrypt");
const saltRounds = 10;


router.get("/classes", (req, res) => {
    ClassModel.find((err, classes) => {
        if (err) return error(res, err)
        return success(res, classes)
    })
})

router.post("/classes", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can create classes")
    ClassModel.find({ name: req.body.name }, (err, classes) => {
        if (err) return error(res, err)
        if (classes.length > 0)
            return fail(res, "Class exists")
        ClassModel.create({ name: req.body.name }, (err, c) => {
            if (err) return error(res, err)
            return success(res, c)
        })
    })

})

router.put("/classes/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can edit classes")
    ClassModel.updateOne({ _id: req.params.id }, { name: req.body.name }, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Edit the class successfully")
    })
})

router.delete("/classes/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can delete classes")
    ClassModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Delete the class successfully")
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
        return fail(res, "Only admin can create subjects")
    ClassModel.find({ _id: req.body.classId }, (err, classes) => {
        if (err) return error(res, err)
        if (classes.length < 1)
            return fail(res, "Lớp học không tồn tại")
        SubjectModel.find({ name: req.body.name, classId: req.body.classId }, (err, subjects) => {
            if (err) return error(res, err)
            if (subjects.length > 0)
                return fail(res, "Subject exists")
            SubjectModel.create({ name: req.body.name, classId: req.body.classId }, (err, c) => {
                if (err) return error(res, err)
                return success(res, c)
            })
        })
    })
})

router.put("/subjects/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can edit subjects")
    SubjectModel.updateOne({ _id: req.params.id }, { name: req.body.name }, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Edit the subject successfully")
    })
})

router.delete("/subjects/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can delete subjects")
    SubjectModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Delete the subject successfully")
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
        return fail(res, "Only admin can create contents")
    SubjectModel.find({ _id: req.body.subjectId }, (err, subjects) => {
        if (err) return error(res, err)
        if (subjects.length < 1)
            return fail(res, "Môn học không tồn tại")
        ContentModel.find({ name: req.body.name, subjectId: req.body.subjectId }, (err, contents) => {
            if (err) return error(res, err)
            if (contents.length > 0)
                return fail(res, "Content exists")
            ContentModel.create({ name: req.body.name, subjectId: req.body.subjectId }, (err, c) => {
                if (err) return error(res, err)
                return success(res, c)
            })
        })
    })
})

router.put("/contents/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can edit contents")
    ContentModel.updateOne({ _id: req.params.id }, { name: req.body.name }, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Edit the content successfully")
    })
})

router.delete("/contents/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can delete contents")
    ContentModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Delete the content successfully")
    })
})





router.get("/exams/:id", (req, res) => {
    ExamModel.find({ contentId: req.params.id })
        // .populate("contentId")
        .select("name time total note datetime password")
        .exec((err, exams) => {
            if (err) return error(res, err)
            exams.forEach(element => {
                if (element.password)
                    element.password = true
                else
                    element.password = false
            });
            return success(res, exams)
        })
})

router.post("/exams", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can create exams")
    ContentModel.find({ _id: req.body.contentId }, (err, contents) => {
        if (err) return error(res, err)
        if (contents.length < 1)
            return fail(res, "Chủ đề không tồn tài")
        ExamModel.find({ name: req.body.name, contentId: req.body.contentId }, (err, exams) => {
            if (err) return error(res, err)
            if (exams.length > 0)
                return fail(res, "Exam exists")
            if (req.body.password) {
                bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
                    if (err) return error(res, err)
                    req.body.password = hash
                    ExamModel.create(req.body, (err, exam) => {
                        if (err) return error(res, err)
                        return success(res, exam)
                    })
                })
            } else
                ExamModel.create(req.body, (err, c) => {
                    if (err) return error(res, err)
                    return success(res, c)
                })
        })
    })
})

router.put("/exams/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can edit exams")
    ExamModel.updateOne({ _id: req.params.id }, req.body, (err, r) => {
        if (err) return error(res, err)
        return success(res, null, "Edit the exam successfully")
    })
})

router.delete("/exams/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can delete exams")
    ExamModel.deleteOne({ _id: req.params.id }, err => {
        if (err) return error(res, err)
        return success(res, null, "Delete the exam successfully")
    })
})



router.post("/answers", (req, res) => {
    if (req.authz.role == "anony")
        return fail(res, "Please login before starting the exam")
    ExamModel.create({})
})

module.exports = router;
