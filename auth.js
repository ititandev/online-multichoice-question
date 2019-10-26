const jwt = require('jsonwebtoken');

function verifyJWTToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, "ititan", (err, decodedToken) => {
            if (err || !decodedToken) {
                return reject(err)
            }
            resolve(decodedToken)
        })
    })
}


function createJWToken(details, maxAge) {
    if (typeof details !== 'object') {
        details = {}
    }
    if (!maxAge || typeof maxAge !== 'number') {
        maxAge = 43200
    }
    let token = jwt.sign(details,
        "ititan",
        {
            expiresIn: maxAge,
            algorithm: 'HS256'
        })
    return token
}

module.exports = {
    verifyJWTToken,
    createJWToken
}