const User = require('../Models/User')
const jwt = require("jsonwebtoken")
const bcrypt = require('bcryptjs')
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require('dotenv').config();

const login = async (req, res, next) => {
    const {email, password} = req.body    
    try {
        const user = await User.findOne({email: email})
        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email,
                role: user.role,
                token: generateToken(user._id)
            })
        }else{
            res.json('error')
        }
    } catch (error) {
        next(error)
    }
    
}

const signup = async (req, res, next) => {
    const { name, email, role } = req.body;
    
    const password = generateRandomPassword(8)
    console.log("password", password);
    
    if (!name || !email || !password || !role) {
        return next(new Error('Please add all fields'));
    }

    try {
        const checkUser = await User.findOne({email: email})
        if (checkUser) {
            return next(new Error('User already exist'));
        }
        
        const salt = await bcrypt.genSalt(10)
        const hashedPasword = await bcrypt.hash(password, salt)
        
        const user = await User.create(
            {
                name,
                email,
                password: hashedPasword,
                role
            }
        )
        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id)
            })
        }
        
    } catch (error) {
        next(error); // Passer toute erreur au middleware de gestion des erreurs
    }
    
}

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Vérifie si l'utilisateur existe avec cet email
    const user = await User.findOne({ email });
      
    if (!user) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    // Génère un token sécurisé pour la réinitialisation
    const resetToken = crypto.randomBytes(32).toString("hex");
    // Stocke le token haché dans la base de données avec une date d'expiration
    // const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    // user.resetToken = hashedToken;
    const resetTokenExpiration = Date.now() + 24 * 60 * 60 * 1000; // Expire après 1jrous
    await User.findByIdAndUpdate({_id: user._id}, {resetToken: resetToken, resetTokenExpiration: resetTokenExpiration})
    
    // Génère un lien de réinitialisation de mot de passe
    // const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`

    // Envoie l'email
    const transporter = nodemailer.createTransport({
      // service: 'gmail', // Utilise Gmail comme service, tu peux configurer d'autres services
      // auth: {
      //   user: process.env.EMAIL_USER, // Adresse email de l'expéditeur
      //   pass: process.env.EMAIL_PASSWORD, // Mot de passe de l'email
      // },
      
      host: 'mail.solumada.mg',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
          user: 'solumada-academy@solumada.mg', // your email address
          pass: 'Dev2024', // your email password
      },
    });

    const mailOptions = {
      from: "solumada-academy@solumada.mg",
      to: user.email,
      subject: "Password Reset Request",
      text: `You are receiving this email because you (or someone else) have requested the reset of a password. Please click on the following link, or paste this into your browser to complete the process:\n\n ${resetUrl} \n\n If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    await transporter.sendMail(mailOptions);

    console.log("email envoyé");
    
    res.status(200).json({ success: true, message: "Email sent with password reset instructions" });

  } catch (error) {
    console.error("Error in forgot password: ", error);
    res.status(500).json({ success: false, message: "Error sending email" });
  }
};

const resetPassword= async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {

    
      // const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    // Vérifier si le token est valide et correspond à un utilisateur
    const user = await User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } });
    console.log("user", user);
    
    if (!user) {
      return res.status(400).json({ success: false, message: "Le lien est invalide ou a expiré." });
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Mettre à jour le mot de passe de l'utilisateur
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;

    await user.save();

    res.json({ success: true, message: "Mot de passe réinitialisé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la réinitialisation du mot de passe :", error);
    res.status(500).json({ success: false, message: "Erreur lors de la réinitialisation du mot de passe." });
  }
};

const generateToken = (id) =>{
    return jwt.sign({id}, process.env.JWT_SECRET, {
        expiresIn: '1d'
    })
}

function generateRandomPassword(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters[randomIndex];
  }
  return password;
}
module.exports = {
    login, signup, forgotPassword, resetPassword
}