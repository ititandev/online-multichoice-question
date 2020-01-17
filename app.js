var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const mongoose = require("mongoose");
const { verifyJWTToken } = require("./auth.js");
var usersRouter = require("./routes/users");
const otherRouter = require("./routes/other")
const classRouter = require("./routes/classes")
const examRouter = require("./routes/exams")
const lectureRouter = require("./routes/lectures")
const imageRouter = require("./routes/images")
const mailer = require('express-mailer');
const fileUpload = require('express-fileupload')


require('dotenv').config();
var app = express();
mailer.extend(app, {
  from: 'no-reply@tracnghiem789.com',
  host: 'smtp.gmail.com', // hostname
  secureConnection: true, // use SSL
  port: 465, // port for secure SMTP
  transportMethod: 'SMTP', // default is SMTP. Accepts anything that nodemailer accepts
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});



app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .catch(error => handleError(error));

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});


app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(fileUpload({
  useTempFiles : true,
  tempFileDir : './upload/'
}));


app.use((req, res, next) => {
  verifyJWTToken(req.header("Authorization"))
    .then(payload => {
      if (!payload.role)
        payload.role = "anony"
      req.authz = payload
      next();
    })
    .catch(err => {
      req.authz = { role: "anony" }
      next();
    })
})

// app.delete("/api/all", (req, res) => {
//     mongoose.connection.db.dropCollection("exams")
//     mongoose.connection.db.dropCollection("lectures")
//     mongoose.connection.db.dropCollection("lessons")
//     mongoose.connection.db.dropCollection("contents")
//     mongoose.connection.db.dropCollection("subjects")
//     mongoose.connection.db.dropCollection("classes")
//     res.json({})
// })

app.use("/api/", usersRouter(app));
app.use("/api/", classRouter);
app.use("/api/", examRouter);
app.use("/api/", lectureRouter);
app.use("/api/", imageRouter);
app.use("/api/", otherRouter);


app.use(function (req, res, next) {
  res.sendFile(__dirname + "/public/index.html");
});


app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
