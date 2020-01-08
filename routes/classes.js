var express = require("express");
var router = express.Router();
const ClassModel = require("../schema/ClassModel");
const SubjectModel = require("../schema/SubjectModel");
const ContentModel = require("../schema/ContentModel");
const ExamModel = require("../schema/ExamModel");
const LectureModel = require("../schema/LectureModel");
const { success, error, fail } = require("../common");
var ObjectId = require("mongoose").Types.ObjectId;

router.get("/classes", (req, res) => {
    ClassModel.find((err, classes) => {
        if (err) return error(res, err);
        return success(res, classes);
    });
});

router.get("/classes/subjects", (req, res) => {
    SubjectModel.find()
        .select("_id name")
        .populate("classId", "_id name")
        .exec((err, subjects) => {
            if (err) return error(res, err);
            subjects = subjects.reduce(function (rv, x) {
                if (x.classId)
                    (rv[x.classId.name] = rv[x.classId.name] || []).push({
                        _id: x._id,
                        name: x.name
                    });
                return rv;
            }, {});
            return success(
                res,
                Object.keys(subjects).map(key => {
                    return { className: key, subjects: subjects[key] };
                })
            );
        });
});

router.post("/classes", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể tạo lớp học");
    ClassModel.find({ name: req.body.name }, (err, classes) => {
        if (err) return error(res, err);
        if (classes.length > 0) return fail(res, "Lớp học đã tồn tại");
        ClassModel.create({ name: req.body.name }, (err, c) => {
            if (err) return error(res, err);
            return success(res, c);
        });
    });
});

router.put("/classes/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể chỉnh sửa lớp học");
    ClassModel.updateOne(
        { _id: req.params.id },
        { name: req.body.name },
        (err, r) => {
            if (err) return error(res, err);
            return success(res, null, "Chỉnh sửa lớp học thành công");
        }
    );
});

router.delete("/classes/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể xóa lớp học");

    SubjectModel.countDocuments(
        { classId: ObjectId(req.params.id) },
        (err, count) => {
            if (err) return error(res, err);
            if (count > 0)
                return fail(res, "Vui lòng xóa tất cả môn học của lớp học trước");
            ClassModel.deleteOne({ _id: req.params.id }, err => {
                if (err) return error(res, err);
                return success(res, null, "Xóa lớp học thành công");
            });
        }
    );
});

router.get("/subjects/:id", (req, res) => {
    SubjectModel.find({ classId: req.params.id })
        // .populate("classId")
        .exec((err, subjects) => {
            if (err) return error(res, err);
            return success(res, subjects);
        });
});

router.post("/subjects", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể tạo môn học");
    ClassModel.find({ _id: req.body.classId }, (err, classes) => {
        if (err) return error(res, err);
        if (classes.length < 1) return fail(res, "Lớp học không tồn tại");
        SubjectModel.find(
            { name: req.body.name, classId: req.body.classId },
            (err, subjects) => {
                if (err) return error(res, err);
                if (subjects.length > 0) return fail(res, "Môn học đã tồn tại");
                SubjectModel.create(
                    { name: req.body.name, classId: req.body.classId },
                    (err, c) => {
                        if (err) return error(res, err);
                        return success(res, c);
                    }
                );
            }
        );
    });
});

router.put("/subjects/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể chỉnh sửa môn học");
    SubjectModel.updateOne(
        { _id: req.params.id },
        { name: req.body.name },
        (err, r) => {
            if (err) return error(res, err);
            return success(res, null, "Chỉnh sửa môn học thành công");
        }
    );
});

router.delete("/subjects/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể xóa môn học");
    ContentModel.countDocuments({ subjectId: req.params.id }, (err, count) => {
        if (err) return error(res, err);
        if (count > 0)
            return fail(res, "Vui lòng xóa tất cả chủ đề của môn học trước");
        SubjectModel.deleteOne({ _id: req.params.id }, err => {
            if (err) return error(res, err);
            return success(res, null, "Xóa môn học thành công");
        });
    });
});

router.get("/contents/:id", (req, res) => {
    ContentModel.find({ subjectId: req.params.id })
        // .populate("subjectId")
        .sort("name")
        .exec((err, contents) => {
            if (err) return error(res, err);
            return success(res, contents);
        });
});

router.post("/contents", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể tạo chương");
    SubjectModel.find({ _id: req.body.subjectId }, (err, subjects) => {
        if (err) return error(res, err);
        if (subjects.length < 1) return fail(res, "Môn học không tồn tại");
        ContentModel.find(
            { name: req.body.name, subjectId: req.body.subjectId },
            (err, contents) => {
                if (err) return error(res, err);
                if (contents.length > 0) return fail(res, "Chương đã tồn tại");
                ContentModel.create(
                    { name: req.body.name, subjectId: req.body.subjectId },
                    (err, c) => {
                        if (err) return error(res, err);
                        return success(res, c);
                    }
                );
            }
        );
    });
});

router.put("/contents/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể chỉnh sửa chương");
    ContentModel.updateOne(
        { _id: req.params.id },
        { name: req.body.name },
        (err, r) => {
            if (err) return error(res, err);
            return success(res, null, "Chỉnh sửa chương thành công");
        }
    );
});

router.delete("/contents/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể xóa chương");

    LessonModel.countDocuments({ contentId: req.params.id }, (err, count) => {
        if (err) return error(res, err);
        if (count > 0)
            return fail(res, "Vui lòng xóa tất cả bài học của chương trước");
        ContentModel.deleteOne({ _id: req.params.id }, err => {
            if (err) return error(res, err);
            return success(res, null, "Xóa chương thành công");
        });
    });
});




router.get("/lessons/:id", (req, res) => {
    LessonModel.find({ contentId: req.params.id })
        // .populate("contentId")
        .sort("name")
        .exec((err, lessons) => {
            if (err) return error(res, err);
            return success(res, lessons);
        });
});

router.post("/lessons", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể tạo bài học");
    ContentModel.find({ _id: req.body.contentId }, (err, subjects) => {
        if (err) return error(res, err);
        if (subjects.length < 1) return fail(res, "Chương không tồn tại");
        LessonModel.find(
            { name: req.body.name, contentId: req.body.contentId },
            (err, lessons) => {
                if (err) return error(res, err);
                if (lessons.length > 0) return fail(res, "Bài học đã tồn tại");
                LessonModel.create(
                    { name: req.body.name, contentId: req.body.contentId },
                    (err, c) => {
                        if (err) return error(res, err);
                        return success(res, c);
                    }
                );
            }
        );
    });
});

router.put("/lessons/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể chỉnh sửa bài học");
    LessonModel.updateOne(
        { _id: req.params.id },
        { name: req.body.name },
        (err, r) => {
            if (err) return error(res, err);
            return success(res, null, "Chỉnh sửa bài học thành công");
        }
    );
});

router.delete("/lessons/:id", (req, res) => {
    if (req.authz.role != "admin" && req.authz.role != "teacher")
        return fail(res, "Chỉ admin có thể xóa bài học");

    ExamModel.countDocuments(
        { contentId: ObjectId(req.params.id) },
        (err, count) => {
            if (err) return error(res, err);
            if (count > 0)
                return fail(res, "Vui lòng xóa tất cả các đề thi của bài học trước");
            LectureModel.countDocuments(
                { contentId: ObjectId(req.params.id) },
                (err, count) => {
                    if (err) return error(res, err);
                    if (count > 0)
                        return fail(
                            res,
                            "Vui lòng xóa tất cả các bài giảng của bài học trước"
                        );
                    LessonModel.deleteOne({ _id: req.params.id }, err => {
                        if (err) return error(res, err);
                        return success(res, null, "Xóa bài học thành công");
                    });
                }
            );
        }
    );
});

module.exports = router;
