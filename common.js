
function success(res, data, message) {
    if (!data)
        data = {}
    response = {
        success: true,
        data: data
    }
    if (message)
        response.message = message;
    return res.status(200).json(response)
}


function error(res, error, message) {
    if (!message)
        message = "Đã có lỗi xảy ra"
    if (error)
        console.log(error);
    else
        console.log(message);

    return res.status(400).json({
        success: false,
        message: message
    })
}

function fail(res, message) {
    return res.status(400).json({
        success: false,
        message: message
    })
}

module.exports = {
    success,
    error,
    fail
}