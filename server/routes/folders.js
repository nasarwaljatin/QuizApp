const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const Quiz = require('../models/Quiz');
const verifyAdmin = require('../middleware/verifyAdmin');

// GET /api/folders — get all folders with quiz counts
router.get('/', async (req, res) => {
  try {
    const folders = await Folder.find().sort({ createdAt: 1 }).lean();
    
    // Calculate how many quizzes are in each folder
    const quizzes = await Quiz.find({}, 'folderIds').lean();
    
    const foldersWithCounts = folders.map(f => {
      const count = quizzes.filter(q => 
        q.folderIds && q.folderIds.some(id => id.toString() === f._id.toString())
      ).length;
      return { ...f, quizCount: count };
    });

    res.json(foldersWithCounts);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/folders — create a new folder (Admin only)
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Folder name is required.' });
    }
    
    const trimmedName = name.trim();
    if (trimmedName.toLowerCase() === 'all') {
      return res.status(400).json({ message: '"ALL" is a reserved folder name.' });
    }

    // Check for duplicates (case-insensitive)
    const existing = await Folder.findOne({ 
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } 
    });
    if (existing) {
      return res.status(400).json({ message: 'A folder with this name already exists.' });
    }

    const folder = new Folder({ name: trimmedName });
    await folder.save();
    
    // Return with a default count of 0
    res.status(201).json({ ...folder.toObject(), quizCount: 0 });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /api/folders/:id — delete folder (Admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const folder = await Folder.findByIdAndDelete(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder not found.' });

    // Untag this folder from all quizzes
    await Quiz.updateMany(
      { folderIds: req.params.id },
      { $pull: { folderIds: req.params.id } }
    );

    res.json({ message: 'Folder deleted and removed from all quizzes.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
