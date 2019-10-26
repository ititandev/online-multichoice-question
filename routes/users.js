var express = require("express");
var router = express.Router();
const mongoose = require("mongoose");
const UserModel = require("../schema/UserModel");
const bcrypt = require("bcrypt");
const http = require('http');
const { success, error, fail } = require("../common")
const { createJWToken, verifyJWTToken } = require("../auth.js");
const saltRounds = 10;


mongoose.connect(
  // "mongodb+srv://admin:admin@omcq-dfqf7.gcp.mongodb.net/omcq?retryWrites=true&w=majority",
  "mongodb://admin:admin123@ds137008.mlab.com:37008/mcq",
  { useNewUrlParser: true }
);



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
      return fail(res, "User exists")

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
        return success(res, null, "Create new user successfully")
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
        return fail(res, "Account does not exist")

      if (user.active == false)
        return fail(res, "Account is not active")

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

router.get("/user", function (req, res, next) {
  if (req.authz.role != "anony") {
    UserModel.findById(req.authz.uid, (err, user) => {
      if (err)
        return error(res, err);
      else {
        user.password = undefined
        return success(res, user)
      }
    });
  }
  else
    return fail(res, "Anonymous can't use this API")
});

router.get("/users", (req, res) => {
  if (req.authz.role == "admin") {
    UserModel.find({}, "_id email name role phone datetime", { skip: 1 }, (err, users) => {
      if (err) return error(res, err)
      else {
        return success(res, users)
      }
    })
  }
  else
    return fail(res, "Only admin can get list of users")
})


router.put("/users", (req, res) => {
  if (req.authz.role == "anony")
    return fail(res, "Anonymous can't use this API")
  UserModel.findById(req.authz.uid, (err, user) => {
    if (err) return error(res, err)
    if (!user) return fail(res, "User not found")
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


router.put("/usersa/:id", (req, res) => {
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
});





router.delete("/users/:id", function (req, res, next) {
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




module.exports = router;
