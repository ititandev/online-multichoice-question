var express = require("express");
var router = express.Router();
const mongoose = require("mongoose");
const UserModel = require("../schema/UserModel");
const ServiceModel = require("../schema/ServiceModel");
const bcrypt = require("bcrypt");
const { createJWToken, verifyJWTToken } = require("../auth.js");
const saltRounds = 10;

mongoose.connect(
  "mongodb://servicy:servicy123@ds151416.mlab.com:51416/servicy",
  { useNewUrlParser: true }
);

router.delete("/users/:id", function(req, res, next) {
  verifyJWTToken(req.header("Authorization")).then(
    payload => {
      userId = req.param("id");
      uid = payload.uid;
      role = payload.role;
      if (role !== "admin")
        return res.json({
          success: false,
          message: "Sorry! Only admin is allowed to delete the user"
        });

      UserModel.findOne({ _id: userId }, (err, data) => {
        if (!data) {
          return res.json({
            success: false,
            message: "the user is not existed",
            data: userId
          });
        } else {
          if (data.role != "provider") {
            UserModel.remove({ _id: userId }, err => {
              if (err)
                return res.json({
                  success: false,
                  message: "Some error happen " + err
                });
            });
            return res.json({
              success: true,
              message: "the user is deleted",
              data: userId
            });
          } else {
            ServiceModel.remove({ provider_id: userId }, err => {
              if (err)
                return res.json({
                  success: false,
                  message: "Some error happen " + err
                });
            });
            UserModel.remove({ _id: userId }, err => {
              if (err)
                return res.json({
                  success: false,
                  message: "Some error happen " + err
                });
            });
            return res.json({
              success: true,
              message: "the user is deleted",
              data: userId
            });
          }
        }
      });
    },
    err => {
      return res.json({
        success: false,
        message: "Authentication failed"
      });
    }
  );
});

router.get("/users", function(req, res, next) {
  verifyJWTToken(req.header("Authorization"))
    .then(payload => {
      if (payload.role != "admin")
        return res.json({
          success: false,
          message: "Only admin can get all users"
        });

      if (req.query.role) {
        arr = [];
        role = parseInt(req.query.role);
        if (role % 2) arr.push("admin");
        role = role >> 1;
        if (role % 2) arr.push("provider");
        role = role >> 1;
        if (role % 2) arr.push("user");

        query = {
          role: {
            $in: arr
          }
        };
      } else query = {};

      UserModel.find(query, (err, data) => {
        if (err) {
          return res.json({
            success: false,
            message: "Some error happen"
          });
        } else
          res.json({
            success: true,
            data: data
          });
      });
    })
    .catch(err => {
      return res.json({
        success: false,
        message: "Authentication failed " + err
      });
    });
});

router.put("/users/:id", (req, res) => {
  verifyJWTToken(req.header("Authorization"))
    .then(payload => {
      UserModel.findById(req.params.id, (err, user) => {
        if (err)
          return res.json({
            success: false,
            message: "Some error happen " + err
          });
        if (!user)
          return res.json({
            success: false,
            message: "User not found"
          });
        if (req.body.role && payload.role != "admin")
          return res.json({
            success: false,
            message: "Only admin can modify role of user"
          });
        if (payload.uid != req.params.id && payload.role != "admin")
          return res.json({
            success: false,
            message: "Only admin can modify other user"
          });
        delete req.body._id;
        delete req.body.email;

        if (req.body.password) {
          hash = bcrypt.hashSync(req.body.password, saltRounds);
          user.password = hash;
          delete req.body.password;
        }

        for (var prop in req.body) user[prop] = req.body[prop];

        user.save(err => {
          if (err)
            return res.json({
              success: false,
              message: "Some error happen " + err
            });
          delete user.password;
          return res.json({
            success: true,
            data: user
          });
        });
      });
    })
    .catch(err => {
      return res.json({
        success: false,
        message: "Authentication failed"
      });
    });
});

router.post("/login", function(req, res, next) {
  UserModel.findOne(
    {
      email: req.body.email
    },
    (err, user) => {
      if (err) {
        return res.json({
          success: false,
          message: "Some error happen"
        });
      }

      if (!user) {
        return res.json({
          success: false,
          message: "Account does not exist"
        });
      }

      if (req.query.role)
        if (req.query.role != user.role)
          return res.json({
            success: false,
            message: "Please login as provider/admin on your page"
          });

      bcrypt.compare(req.body.password, user.password, (err, result) => {
        if (result) {
          token = createJWToken(
            {
              uid: user._id,
              role: user.role
            },
            604800
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
            message: "Password is wrong"
          });
      });
    }
  );
});

router.post("/signup", (req, res) => {
  UserModel.find({ email: req.body.email }, (err, data) => {
    if (err) {
      return res.json({
        success: false,
        message: "Some error happen" + err
      });
    }
    if (data.length > 0)
      return res.json({
        success: false,
        message: "User exists"
      });

    bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
      if (!req.body.avatar)
        req.body.avatar =
          "https://us.v-cdn.net/6022045/uploads/defaultavatar.png";
      user = new UserModel({
        email: req.body.email,
        password: hash,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        role: "user",
        avatar: req.body.avatar,
        phone: req.body.phone
      });
      user.save(err => {
        if (err)
          return res.json({
            success: false,
            message: "Some error happen" + err
          });
        return res.json({
          success: true,
          message: "Create new user successfully",
          data: user
        });
      });
    });
  });
});

router.get("/checktoken/:token", function(req, res, next) {
  verifyJWTToken(req.param("token"))
    .then(any => {
      res.json(any);
    })
    .catch(err => {
      res.send(err);
    });
});

module.exports = router;
