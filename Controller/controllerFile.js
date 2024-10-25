
const File = require('../Models/File')
const xml2js = require('xml2js');
const fs = require('fs')
const ExcelJS = require('exceljs');

const saveFile = async (fileData) => {
    try {
        const newFile = new File(fileData)
        await newFile.save()
        console.log(`${fileData.type.toUpperCase()} file saved successfully`);
    } catch (error) {
        console.error(`Error saving ${fileData.type.toUpperCase()} file to database:`, error);
        throw new Error(`Error saving ${fileData.type.toUpperCase()} file to database`);
    }
}
const uploadFile = async (req, res) => {
    if (!req.files) {
        return res.status(400).json({ message: 'Aucun fichier téléchargé' });
    }
    try {
        // Enregistrer chaque fichier dans la base de données
        const filePromises = req.files.filter(f => f.originalname.endsWith('.pdf')).map(file => {
            const newFile = new File({
                name: file.originalname,
                uploadAt: new Date(),
            });
            return newFile.save();
        });

        // Attendre que tous les fichiers soient enregistrés
        const savedFiles = await Promise.all(filePromises);

        res.status(200).json({
            message: 'Fichiers téléchargés et enregistrés avec succès',
            files: savedFiles,
        });
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des fichiers:', error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }

}

// Function to read and convert XML to JSON using Promises
function convertXmlToJson(filePath) {
    return new Promise((resolve, reject) => {
        // Read the XML file
        fs.readFile(filePath, 'utf8', (err, data) => {

            if (err) {
                return reject('Error reading XML file: ' + err);
            }

            // Parse the XML data
            xml2js.parseString(data, { explicitArray: false }, (err, result) => {
                if (err) {
                    return reject('Error parsing XML to JSON: ' + err);
                }
                // Resolve the parsed JSON result
                resolve(result);
            });
        });
    });
}

const getFileById = async (req, res) => {
    try {
        const id = req.params.id
        const file = await File.findById(req.params.id);

        if (!req.io) {
            return res.status(500).send('Socket.io instance is not available');
        }

        if (!file.isLocked) {
            file.isLocked = true
            await file.save()
            req.io.emit('file-locked', { id, isLocked: true })
        }

        const xmlJSON = await convertXmlToJson('./uploads/' + file.xml);
        res.status(200).json({ ...file._doc, xmlJSON });
    } catch (error) {
        console.error("Erreur lors de la récupération des fichiers:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des fichiers' })
    }
}

const getFiles = async (req, res) => {
    try {
        const files = await File.find({ name: { $regex: /\.pdf$/i } })
        //test socket

        res.status(200).json(files)
    } catch (error) {
        console.error("Erreur lors de la récupération des fichiers:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des fichiers' })
    }
}

const unlock_file = async (req, res) => {
    try {
        const id = req.params.id;
        const file = await File.findById(id);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (!req.io) {
            return res.status(500).send('Socket.io instance is not available');
        }

        // Si le fichier est verrouillé, le déverrouiller
        file.isLocked = false;
        file.lockedBy = null;
        await file.save();

        // Émettre un événement via Socket.io pour notifier que le fichier est déverrouillé
        req.io.emit('file-unlocked', { id, isLocked: false, lockedBy: null });

        res.status(200).json({ message: 'File unlocked successfully', file });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du fichier:", error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du fichier' });
    }
};

const lock_file = async (req, res) => {
    try {
        const id = req.params.id;
        const file = await File.findByIdAndUpdate(id, {
            isLocked: true,
            lockedBy: req.user._id
        }, { new: true })
        .populate('lockedBy')
        .populate('validatedBy.v1')
        .populate('validatedBy.v2')
        .populate('returnedBy');

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (!req.io) {
            return res.status(500).send('Socket.io instance is not available');
        }

        // Émettre un événement via Socket.io pour notifier que le fichier est déverrouillé
        req.io.emit('file-locked', { id, isLocked: true, lockedBy: file.lockedBy });

        res.status(200).json({ message: 'File unlocked successfully', file });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du fichier:", error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du fichier' });
    }
};

// Method to get prevalidation document: (V1)
const getPrevalidations = async (req, res) => {
    try {
        const files = await File.find({
            'validation.v1': false,
            status: { $nin: ['returned', 'validated'] },
            $expr: { $lt: [{ $size: "$versions" }, 2] }
        })
        .populate('lockedBy')
        .populate('validatedBy.v1')
        .populate('validatedBy.v2')
        .populate('returnedBy');

        res.status(200).json(files)
    } catch (error) {
        console.error("Erreur lors de la récupération des fichiers:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des fichiers prevalidation' })
    }
}

// Method to get prevalidation document: (V1)
const getV2Validations = async (req, res) => {
    try {
        const files = await File.find({ 'validation.v2': false, 'validation.v1': true, versions: { $size: 1 } })
        .populate('lockedBy')
        .populate('validatedBy.v1')
        .populate('validatedBy.v2')
        .populate('returnedBy');

        console.log(files)

        res.status(200).json(files)
    } catch (error) {
        console.error("Erreur lors de la récupération des fichiers:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des fichiers v2' })
    }
}

// get returned validations
const getReturnedValidations = async (req, res) => {
    try {
        const files = await File.find({ 'validation.v2': false, 'validation.v1': false, status: 'returned' })
        .populate('lockedBy')
        .populate('validatedBy.v1')
        .populate('validatedBy.v2')
        .populate('returnedBy');

        res.status(200).json(files)
    } catch (error) {
        console.error("Erreur lors de la récupération des fichiers:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des fichiers v2' })
    }
}


// get validated validations
const getValidatedValidations = async (req, res) => {
    try {
        const files = await File.find({ 'validation.v2': true, 'validation.v1': true, status: 'validated' });

        res.status(200).json(files)
    } catch (error) {
        console.error("Erreur lors de la récupération des fichiers:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des fichiers v2' })
    }
}

const generateExcel = async (req, res) => {
    
    // Créer un nouveau classeur
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Feuille1');

    // Définir les en-têtes des colonnes
    worksheet.columns = [
        { header: 'Id', 
            key: 'id', 
            width: 15, height : 17},
        { header: 'Nom', key: 'nom', width: 60 , height : 17, style: { font: { bold: true,}, alignment: { horizontal: 'center' } } },
        { header: 'Status', key: 'status', width: 30, height : 17, style: {  alignment: { horizontal: 'center' } } },
        { header: 'V1', key: 'v1', width: 30, height : 17 },
        { header: 'V2', key: 'v2', width: 30, height : 17 },
    ];

    var allFile = await File.find()
            .populate('validatedBy.v1', 'name firstname') // Peupler avec les champs `name` et `email` de l'utilisateur v1
            .populate('validatedBy.v2', 'name firstname')
    
    for (let i = 0; i < allFile.length; i++) {
        const element = allFile[i];

        var v1 = (element.v1?.name ?? "") + " " + (element.v1?.firstname ?? "");
        var v2 = (element.v2?.name ?? "") + " " + (element.v2?.firstname ?? "");
        

        console.log("allFile", v1, v2);
        worksheet.addRow({id: parseInt(element._id), nom: element.name, status: element.status, });
        
    }
    // { bold: true, italic: true, color: { argb: 'FFFFA500' } }; // Cellule 'Nom' de la 2ème ligne
    // worksheet.getCell('A2').alignment = { horizontal: 'left' }; // Alignement de la cellule

    console.log("generatefile");
    
    // Styliser la première ligne (les en-têtes)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 16, color: { argb: 'FF0A1F28' } }; // Police en gras et jaune
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1DD1FD' }, // Fond bleu
    };

    headerRow.alignment = { horizontal: 'center' }; // Alignement centré
    headerRow.height = 20; // Hauteur de la ligne
    // Configurer l'en-tête de la réponse pour télécharger le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=fichier_excel.xlsx');

    // Écrire le fichier dans un flux (stream) directement pour éviter de l'enregistrer sur le disque
    await workbook.xlsx.write(res);
    res.end();

    console.log('Fichier Excel généré et prêt à être téléchargé !');
}


module.exports = {uploadFile, getFileById, getFiles, unlock_file, lock_file, getPrevalidations, 
    getV2Validations, getReturnedValidations, getValidatedValidations , generateExcel}