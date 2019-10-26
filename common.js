
function success(res, data, message) {
    if (!data)
        data = {}
    response = {
        success: true,
        data: data
    }
    if (message)
        response.message = message;
    res.json(response)
}


function error(res, message) {
    if (!message)
        message = "Some error happen"

    res.json({
        success: false,
        message: message
    })
}

module.exports = {
    success,
    error
}