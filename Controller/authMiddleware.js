const jwt = require ('jsonwebtoken')
const asyncHandler = require('express-async-handler')
const User = require('../Models/User')

const protect = asyncHandler(async (req, res, next) => {
    let token

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            //Get token from heder
            token = req.headers.authorization.split(' ')[1]
            //Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET)

            //Get user form the token
            req.user = await User.findById(decoded.id).select('-password')
            next()
        } catch (error) {
            console.log("erreur", error);
            res.status(401)
            return next(new Error('Not authorized'));
            
        }
    }

    if (!token) {
        res.status(401)
        
        return next(new Error('Not authorized, no token'));
    }
});


const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Get the token from the Authorization header

    if (!token) return res.sendStatus(401); // No token, unauthorized

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.sendStatus(403); // Token is invalid, forbidden
        req.userId = decoded.id; // Attach the user ID to the request object
        next(); // Call the next middleware/route handler
    });
};

module.exports = {protect, authenticateToken}