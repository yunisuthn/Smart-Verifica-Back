const mongoose = require("mongoose")

const versionSchema = new mongoose.Schema({
    versionNumber: {
        type: String,
        required: true, // e.g., 'v1', 'v2'
    },
    dataJson: {
        type: Object,
        required: true,
    }
}, { _id: false }); // Prevent creating an _id for this sub-document

const fileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    isLocked: {
        type: Boolean,
        default: false
    },
    xml: {
        type: String, // xml file name
        default: ''
    },
    dataXml: {
        type: String, // or Buffer if you expect binary data,
        default: '{}'
    },
    uploadAt: {
        type: Date,
        default: Date.now
    },
    versions: [versionSchema], // Array of version documents
    validation: {
        v1: {
            type: Boolean,
            default: false,
        },
        v2: {
            type: Boolean,
            default: false,
        }
    },
    status: {
        type: String,
        enum: ['progress', 'returned', 'validated'],
        default: 'progress'
    },
    // Additional field for user
    validatedBy: {
        v1: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        v2: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        }
    },
    lockedBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    returnedBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    comment: {
        type: String,
        default: ''
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Pre-save hook to update xml field before saving
fileSchema.pre('save', function (next) {
    if (this.name) {
        // Replace the file extension with .xml
        this.xml = this.name.replace(/\.[^/.]+$/, ".xml");
    }
    next();
});

fileSchema.virtual('workflowStatus').get(function() {
    if (this.status === 'validated') {
        return 'Worked on';
    }
    if (this.isLocked) return 'In progress';
    return 'Pending Assignement';
    
});

module.exports = mongoose.model('File', fileSchema)