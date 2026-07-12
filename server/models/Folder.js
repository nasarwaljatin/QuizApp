const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    collation: { locale: 'en', strength: 2 } // case-insensitive index
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Folder', folderSchema);
