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
const excel = require('node-excel-export');
const readXlsxFile = require('read-excel-file/node');

module.exports = app => {

  router.get("/token", function (req, res, next) {
    return res.json(req.authz)
  });

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
            return success(res, { token: token, user: user });
          }
          else
            return fail(res, "Sai mật khẩu")
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
    if (req.authz.role != "admin" && req.authz.role != "teacher")
      return fail(res, "Chỉ admin có thể thực hiện")

    if (!req.query.limit)
      req.query.limit = 10
    if (!req.query.page)
      req.query.page = 1
    if (!req.query.sort)
      req.query.sort = "-datetime"

    query = req.query.search ? {
      $or: [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
        { phone: { $regex: req.query.search, $options: "i" } }
      ]
    } : {}
    if (req.query.active)
      query.active = req.query.active


    UserModel.find(query)
      .select("_id email name role phone datetime active remain")
      .sort(req.query.sort)
      .skip((req.query.page - 1) * req.query.limit)
      .limit(parseInt(req.query.limit))
      .exec((err, users) => {
        if (err) return error(res, err)
        else {
          UserModel.countDocuments(query, (err, totalPage) => {
            if (err) return error(res, err)
            totalPage = Math.ceil(totalPage / req.query.limit)
            previous = req.query.page > 1 ? req.protocol + "://" + req.get("host") + "/api/users?page=" + (Number(req.query.page) - 1) + "&limit=" + req.query.limit : null
            next = req.query.page < totalPage ? req.protocol + "://" + req.get("host") + "/api/users?page=" + (Number(req.query.page) + 1) + "&limit=" + req.query.limit : null
            data = { totalPage: totalPage, page: req.query.page, data: users, previous: previous, next: next }
            return success(res, data)
          })
        }
      })
  })

  router.get("/users/count", (req, res) => {
    if (req.authz.role != "admin")
      return fail(res, "Chỉ admin có thể thực hiện")
    UserModel.countDocuments({ active: 'false' }, (err, count) => {
      if (err) return error(res, err)
      return success(res, { inactiveCount: count })
    })
  })

  router.get("/users/export", (req, res) => {
    if (req.authz.role != "admin")
      return fail(res, "Không đủ quyền để xuất báo cáo tài khoản")
    UserModel.find((err, users) => {
      if (err) return error(res, err)
      if (!users)
        return fail(res, "Không có dữ liệu")

      const specification = {
        email: {
          headerStyle: { font: { bold: true } },
          displayName: 'Email',
          cellFormat: function (value, row) {
            return row.email
          },
          width: 200
        },
        name: {
          headerStyle: { font: { bold: true } },
          displayName: 'Name',
          cellFormat: function (value, row) {
            return row.name
          },
          width: 200
        },
        phone: {
          headerStyle: { font: { bold: true } },
          displayName: 'Phone',
          cellFormat: function (value, row) {
            return row.phone
          },
          width: 100
        },
        role: {
          headerStyle: { font: { bold: true } },
          displayName: "Role",
          cellFormat: function (value, row) {
            return row.role
          },
          width: 80
        },
        active: {
          headerStyle: { font: { bold: true } },
          cellFormat: function (value, row) {
            return (value) ? 'Active' : 'Inactive';
          },
          displayName: "Active",
          width: 50
        },
        remain: {
          headerStyle: { font: { bold: true } },
          displayName: "Số phút còn lại",
          cellFormat: function (value, row) {
            return row.remain
          },
          width: 100
        },
        // password: {
        //   headerStyle: { font: { bold: true } },
        //   displayName: "Password cũ đã mã hóa",
        //   cellFormat: function (value, row) {
        //     return row.password
        //   },
        //   width: 450
        // },
        newpassword: {
          headerStyle: { font: { bold: true } },
          displayName: "Password mới (để trống nếu không đổi mật khẩu)",
          cellFormat: function (value, row) {
            return null
          },
          width: 350
        },
        // _id: {
        //   headerStyle: { font: { bold: true } },
        //   displayName: "userId (không được sửa)",
        //   cellFormat: function (value, row) {
        //     return row._id
        //   },
        //   width: 450
        // },
      }

      const report = excel.buildExport([{
        specification: specification,
        data: users
      }]);

      res.attachment('users.xlsx');
      return res.send(report);
    })
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

  router.post("/users/import", async (req, res) => {
    let response = { updated: 0, new: 0, total: 0 }
    readXlsxFile(req.files.upload.tempFilePath).then((rows) => {
      rows.splice(0, 1)
      promises = rows.map(row => {
        response.total += 1
        return new Promise((resolve, reject) => {
          UserModel.find({ email: row[0] }, (err, user) => {
            if (err) reject(err)
            if (user.length > 0) {
              let data = {
                name: row[1],
                phone: row[2],
                role: row[3],
                active: row[4] == "Active" || row[4] == "active" ? true : false,
                remain: row[5]
              }
              if (row[6])
                bcrypt.hash(row[6], saltRounds, (err, hash) => {
                  if (err) reject(err)
                  data.password = hash
                  UserModel.updateOne({ email: row[0] }, data, err => {
                    if (err) reject(err)
                    response.updated += 1
                    resolve()
                  })
                });
              else
                UserModel.updateOne({ email: row[0] }, data, err => {
                  if (err) reject(err)
                  response.updated += 1
                  resolve()
                })
            }
            else {
              let newPassword = row[6] ? row[6] : Math.random()
              bcrypt.hash(newPassword.toString(), saltRounds, (err, hash) => {
                if (err) reject(err)
                let user = new UserModel({
                  email: row[0],
                  name: row[1],
                  phone: row[2],
                  role: row[3] ? row[3] : "user",
                  active: row[4] == "Active" || row[4] == "active" ? true : false,
                  remain: row[5] ? row[5] : undefined,
                  password: hash
                });
                user.save(err => {
                  if (err) reject(err)
                  response.new += 1
                  resolve()
                });
              });

            }
          })
        })
      })

      Promise.all(promises)
        .then(() => {
          console.log(response)
          return success(res, response)
        })
        .catch(err => {
          return fail(res, "Tải lên thất bại")
        })
    })
      .catch(err => {
        console.error(err)
        return fail(res, "File excel chưa thay đổi từ khi xuất")
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
      if (req.body.active != undefined) user.active = req.body.active
      if (req.body.remain != undefined) user.remain = req.body.remain

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
      return success(res, null, "Kích hoạt thành công " + r.nModified + " tài khoản")
    })
  })

  router.delete("/users/:id", (req, res) => {
    if (req.authz.role != "admin")
      return fail(res, "Chỉ admin có thể xóa tài khoản")
    UserModel.deleteOne({ _id: req.params.id }, (err) => {
      if (err) return err(res, err)
      AnswerModel.deleteMany({ userId: ObjectId(req.params.id) }, err => {
        if (err) return error(res, err)
        return success(res, null, "Xóa tài khoản thành công")
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
