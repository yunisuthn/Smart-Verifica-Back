const User = require('../Models/User')

const allUser = async (req, res) => {

    try {

        var allUser = await User.find()
        res.status(200).json(allUser)

    } catch (error) {
        console.error("Erreur pour la liste des utilisateurs", error);
        res.status(500).json({message: 'Erreur du liste des utilisateurs'})
    }

}
module.exports = {
    allUser
}