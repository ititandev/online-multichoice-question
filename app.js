var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const { verifyJWTToken } = require("./auth.js");
var usersRouter = require("./routes/users");
const otherRouter = require("./routes/other")
var app = express();

const http = require('http');

var options = {
  host: 'ipv4bot.whatismyipaddress.com',
  port: 80,
  path: '/'
};
http.get(options, function (res) {
  res.on("data", function (chunk) {
    console.log("IP: " + chunk);
  });
}).on('error', function (e) {
  console.log("error: " + e.message);
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");


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


app.use((req, res, next) => {
  verifyJWTToken(req.header("Authorization")).then(payload => {
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

app.use("/api/", usersRouter);
app.use("/api/", otherRouter)



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
