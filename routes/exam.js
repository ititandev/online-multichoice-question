var express = require("express");
var router = express.Router();
const ClassModel = require("../schema/ClassModel");
const SubjectModel = require("../schema/SubjectModel");
const ContentModel = require("../schema/ContentModel");
const ExamModel = require("../schema/ExamModel");
const { success, error, fail } = require("../common")


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
            return fail(res, "Class existes")
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
        return success(res, "Edit " + r.nModified + " the class successfully")
    })
})

router.delete("/classes/:id", (req, res) => {
    if (req.authz.role != "admin")
        return fail(res, "Only admin can delete classes")
    ClassModel.deleteOne({_id: req.params.id}, err => {
        if (err) return error(res, err)
        return success(res, "Delete the class successfully")
    })
})


module.exports = router;
