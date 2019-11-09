const { success, error, fail } = require("../common");
const mongoose = require("mongoose");
const multer = require("multer");
require('dotenv').config();
const GridFsStorage = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const crypto = require("crypto");
var express = require("express");
var router = express.Router();

let gfs;


const conn = mongoose.createConnection(process.env.MONGODB_URI);

conn.once("open", () => {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection("images");
    console.log("Connection Successful");
});

const storage = new GridFsStorage({
    url: process.env.MONGODB_URI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err)
                    return reject(err);
                const filename = Math.random() * 10000000000000000 + file.originalname;
                req.filename = filename
                const fileInfo = {
                    filename: filename,
                    bucketName: "images"
                };
                resolve(fileInfo);
            });
        });
    }
});

const upload = multer({ storage });

router.post("/images", upload.single("img"), (req, res, err) => {
    success(res, req.protocol + "://" + req.get("host") + "/api/images/" + req.filename)
});

router.get("/images/:filename", (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) 
            return fail(res, "File not found")

        if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
            // Read output to browser
            const readstream = gfs.createReadStream(file.filename);
            readstream.pipe(res);
        } else {
            res.status(404).json({
                err: "Not an image"
            });
        }
    });
});


module.exports = router;