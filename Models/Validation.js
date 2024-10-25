const mongoose = require("mongoose")

const validationSchema = new mongoose.Schema({
    document: {
        type: mongoose.Types.ObjectId,
        ref: 'File',
        required: true
    },
    num: {
        type: String,
        enum: ['v1', 'v2'],
        default: 'v1'
    },
    returned: {
        type: Boolean,
        default: false
    },
    json_data: {
        type: String,
        default: '{}'
    },
    state: {
        type: String,
        enum: ['returned', 'validated', 'progress'],
        default: 'progress'
    }
});

module.exports = mongoose.model('Validation', validationSchema)