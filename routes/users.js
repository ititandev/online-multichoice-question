var express = require("express");
var router = express.Router();
const UserModel = require("../schema/UserModel");
const bcrypt = require("bcrypt");
const http = require('http');
const { success, error, fail } = require("../common")
const { createJWToken, verifyJWTToken } = require("../auth.js");
const AnswerModel = require("../schema/AnswerModel");
var ObjectId = require('mongoose').Types.ObjectId;
const saltRounds = 10;


module.exports = app => {

  router.get("/u", (req, res, next) => {
    UserModel.find((err, data) => {
      return success(res, data)
    })
  })

  router.get("/token", function (req, res, next) {
    return res.json(req.authz)
  });


  router.get("/ip", (req, res, next) => {
    var options = {
      host: 'ipv4bot.whatismyipaddress.com',
      port: 80,
      path: '/'
    };
    http.get(options, function (r) {
      r.on("data", function (chunk) {
        str = "IP: " + chunk
        console.log(str);
        return res.json({ "ip": str })
      });
    }).on('error', function (e) {
      console.log("error: " + e.message);
    });
  }
  );

  router.post("/signup", (req, res) => {
    UserModel.find({ email: req.body.email }, (err, data) => {
      if (err) {
        return error(res, err)
      }

      if (data.length > 0)
        return fail(res, "Tài khoản đã tồn tại")

      bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
        user = new UserModel({
          email: req.body.email,
          name: req.body.name,
          phone: req.body.phone,
          password: hash
        });

        user.save(err => {
          if (err)
            return error(res, err)
          return success(res, null, "Tạo tài khoản thành công")
        });
      });
    });
  });

  router.post("/login", function (req, res, next) {
    UserModel.findOne(
      {
        email: req.body.email
      },
      (err, user) => {
        if (err)
          return err(res, err)

        if (!user)
          return fail(res, "Tài khoản không tồn tại")

        if (user.active == false)
          return fail(res, "Tài khoản chưa được kích hoạt")

        bcrypt.compare(req.body.password, user.password, (err, result) => {
          if (result) {
            token = createJWToken(
              {
                uid: user._id,
                role: user.role
              },
              82800
            );
            res.set("Authorization", token);
            delete user.password;
            return res.json({
              success: true,
              data: { token: token, user: user }
            });
          } else
            return res.json({
              success: false,
              message: "Sai mật khẩu"
            });
        });
      }
    );
  });

  router.get("/user", function (req, res, next) {
    if (req.authz.role != "anony") {
      UserModel.findById(req.authz.uid, (err, user) => {
        if (err) return error(res, err);
        if (!user)
          return fail(res, "Tài khoản không tồn tại")
        user.password = undefined
        if (!user.active)
          return fail(res, "Tài khoản chưa được kích hoạt hoặc hết hạn sử dụng. Liên hệ admin để kích hoạt tài khoản")
        return success(res, user)
      });
    }
    else
      return fail(res, "Vui lòng đăng nhập trước khi thực hiện")
  });

  router.get("/users", (req, res) => {
    if (req.authz.role == "admin") {
      if (!req.query.limit)
        req.query.limit = 10
      if (!req.query.page)
        req.query.page = 1

      UserModel.find(req.query.active ? { active: req.query.active } : {})
        .select("_id email name role phone datetime active")
        .sort('email')
        .skip((req.query.page - 1) * req.query.limit)
        .limit(parseInt(req.query.limit))
        .exec((err, users) => {
          if (err) return error(res, err)
          else {
            UserModel.countDocuments(req.query.active ? { active: req.query.active } : {}, (err, totalPage) => {
              if (err) return error(res, err)
              totalPage = Math.ceil(totalPage / req.query.limit)
              previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/users?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
              next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/users?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
              data = { totalPage: totalPage, page: req.query.page, data: users, previous: previous, next: next }
              return success(res, data)
            })
          }
        })
    }
    else
      return fail(res, "Chỉ admin có thể get list of users")
  })

  router.post("/users", (req, res) => {
    if (req.authz.role != "admin")
      return fail(res, "Chỉ admin có thể tạo tài khoản")
    UserModel.find({ email: req.body.email }, (err, data) => {
      if (err) {
        return error(res, err)
      }

      if (data.length > 0)
        return fail(res, "Tài khoản đã tồn tại")

      bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
        user = new UserModel({
          email: req.body.email,
          name: req.body.name,
          phone: req.body.phone,
          password: hash,
          active: true,
          role: req.body.role
        });

        user.save(err => {
          if (err)
            return error(res, err)
          return success(res, null, "Tạo tài khoản thành công")
        });
      });
    })
  })

  router.put("/users", (req, res) => {
    if (req.authz.role == "anony")
      return fail(res, "Ẩn danh không thể sử dụng API này")
    UserModel.findById(req.authz.uid, (err, user) => {
      if (err) return error(res, err)
      if (!user) return fail(res, "Tài khoản không tồn tại")
      if (req.body.name) user.name = req.body.name
      if (req.body.phone) user.phone = req.body.phone
      if (req.body.password) {
        hash = bcrypt.hashSync(req.body.password, saltRounds);
        user.password = hash;
      }
      user.save(err => {
        if (err) return error(res, err)
        user.password = undefined
        return success(res, user)
      })
    })
  })

  router.put("/users/:id", (req, res) => {
    if (req.authz.role != "admin")
      return fail(res, "Chỉ admin có thể chỉnh sửa tài khoản")
    UserModel.findById(req.params.id, (err, user) => {
      if (err) return error(res, err)
      if (!user) return fail(res, "Tài khoản không tồn tại")
      if (req.body.email) user.email = req.body.email
      if (req.body.name) user.name = req.body.name
      if (req.body.phone) user.phone = req.body.phone
      if (req.body.role) user.role = req.body.role
      if (req.body.active) {
        user.active = req.body.active
        user.remain = 18000
      }
      if (req.body.password) {
        hash = bcrypt.hashSync(req.body.password, saltRounds);
        user.password = hash;
      }
      user.save(err => {
        if (err) return error(res, err)
        user.password = undefined
        return success(res, user)
      })
    })
  })

  router.put("/active", (req, res) => {
    if (req.authz.role != "admin")
      return fail(res, "Chỉ admin có thể modify other user")
    UserModel.updateMany({ active: false }, { active: true, remain: 18000 }, (err, r) => {
      if (err) return error(res, err)
      return success(res, "Kích hoạt thành công " + r.nModified + " tài khoản")
    })
  })

  router.delete("/users/:id", (req, res) => {
    if (req.authz.role != "admin")
      return fail(res, "Chỉ admin có thể xóa tài khoản")
    UserModel.deleteOne({ _id: req.params.id }, (err) => {
      if (err) return err(res, err)
      AnswerModel.deleteMany({ userId: ObjectId(req.params.id) }, err => {
        if (err) return error(res, err)
        return success(res, "Xóa tài khoản thành công")
      })
    })
  })



  router.get('/forgot/:email', function (req, res, next) {
    UserModel.findOne({ email: req.params.email }, (err, user) => {
      if (!user)
        return fail(res, "Tài khoản không tồn tại")
      newPassword = Math.floor(Math.random() * 1000000).toString()
      bcrypt.hash(newPassword, saltRounds, (err, hash) => {
        UserModel.updateOne({ email: req.params.email }, { password: hash }, err => {
          if (err) return error(res, err)
          app.mailer.send('email', {
            to: req.params.email,
            subject: 'Reset password',
            newPassword: newPassword
          }, err => {
            if (err) return error(res, err)
            return success(res, null, "Kiểm tra email để lấy mật khẩu mới");
          });
        })
      })

    })
  });


  return router
};
